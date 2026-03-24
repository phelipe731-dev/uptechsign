"""Authenticated signatory CRUD endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.document import Document
from app.models.signatory import Signatory
from app.models.user import User
from app.schemas.signatory import SignatoryCreate, SignatoryResponse, SignatoryUpdate
from app.services.audit_service import append_audit_log
from app.services.signature_service import create_signatories

router = APIRouter()


async def _get_document(db: AsyncSession, document_id: UUID) -> Document:
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")
    return document


async def _get_signatory(db: AsyncSession, signatory_id: UUID) -> Signatory:
    result = await db.execute(select(Signatory).where(Signatory.id == signatory_id))
    signatory = result.scalar_one_or_none()
    if not signatory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signatario nao encontrado.")
    return signatory


@router.post("/documents/{document_id}/signatories", response_model=SignatoryResponse, status_code=status.HTTP_201_CREATED)
async def create_signatory(
    document_id: UUID,
    body: SignatoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a signatory while the document is still editable."""
    document = await _get_document(db, document_id)
    if document.status != "generated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Os signatarios so podem ser alterados antes do envio.",
        )

    [signatory] = await create_signatories(db, str(document.id), [body.model_dump()])

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="signatory.created",
        details={"name": signatory.name, "email": signatory.email},
    )
    await db.commit()
    await db.refresh(signatory)
    return signatory


@router.patch("/signatories/{signatory_id}", response_model=SignatoryResponse)
async def update_signatory(
    signatory_id: UUID,
    body: SignatoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a signatory before the document is sent."""
    signatory = await _get_signatory(db, signatory_id)
    document = await _get_document(db, signatory.document_id)

    if document.status != "generated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Os signatarios so podem ser alterados antes do envio.",
        )

    updates = body.model_dump(exclude_unset=True)
    if "auth_require_email_otp" in updates and "auth_method" not in updates:
        updates["auth_method"] = "otp_email" if updates["auth_require_email_otp"] else "none"
    if "auth_require_cpf" in updates and updates["auth_require_cpf"] and not (updates.get("cpf") or signatory.cpf):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o CPF para exigir essa validacao.")

    for key, value in updates.items():
        setattr(signatory, key, value)

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="signatory.updated",
        details={"signatory_id": str(signatory.id), "fields": list(updates.keys())},
    )
    await db.commit()
    await db.refresh(signatory)
    return signatory


@router.delete("/signatories/{signatory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signatory(
    signatory_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a signatory before sending the document."""
    signatory = await _get_signatory(db, signatory_id)
    document = await _get_document(db, signatory.document_id)

    if document.status != "generated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Os signatarios so podem ser alterados antes do envio.",
        )

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="signatory.deleted",
        details={"signatory_id": str(signatory.id), "name": signatory.name},
    )
    await db.delete(signatory)
    await db.commit()
