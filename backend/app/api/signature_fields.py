"""Authenticated signature field CRUD endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.document import Document
from app.models.signature_field import SignatureField
from app.models.signatory import Signatory
from app.models.user import User
from app.schemas.signature_field import SignatureFieldCreate, SignatureFieldResponse, SignatureFieldUpdate
from app.services.audit_service import append_audit_log

router = APIRouter()


async def _get_document(db: AsyncSession, document_id: UUID) -> Document:
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")
    return document


async def _get_field(db: AsyncSession, field_id: UUID) -> SignatureField:
    result = await db.execute(select(SignatureField).where(SignatureField.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campo nao encontrado.")
    return field


async def _validate_signatory(db: AsyncSession, document_id: UUID, signatory_id: UUID) -> None:
    result = await db.execute(
        select(Signatory).where(
            Signatory.id == signatory_id,
            Signatory.document_id == document_id,
        )
    )
    signatory = result.scalar_one_or_none()
    if not signatory:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Signatario invalido para este documento.")


def _validate_bounds(x: float, y: float, width: float, height: float) -> None:
    if x + width > 1 or y + height > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O campo precisa caber integralmente dentro da pagina.",
        )


@router.get("/documents/{document_id}/fields", response_model=list[SignatureFieldResponse])
async def list_signature_fields(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """List positioned fields for a document."""
    await _get_document(db, document_id)
    result = await db.execute(
        select(SignatureField)
        .where(SignatureField.document_id == document_id)
        .order_by(SignatureField.page, SignatureField.created_at)
    )
    return result.scalars().all()


@router.post("/documents/{document_id}/fields", response_model=SignatureFieldResponse, status_code=status.HTTP_201_CREATED)
async def create_signature_field(
    document_id: UUID,
    body: SignatureFieldCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a positioned field on the document PDF."""
    document = await _get_document(db, document_id)
    if document.status != "generated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Os campos so podem ser alterados antes do envio.",
        )

    await _validate_signatory(db, document_id, body.signatory_id)
    _validate_bounds(body.x, body.y, body.width, body.height)

    field = SignatureField(document_id=document_id, **body.model_dump())
    db.add(field)
    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document_id,
        action="field.created",
        details={"field_type": field.field_type, "page": field.page},
    )
    await db.commit()
    await db.refresh(field)
    return field


@router.patch("/fields/{field_id}", response_model=SignatureFieldResponse)
async def update_signature_field(
    field_id: UUID,
    body: SignatureFieldUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a positioned field."""
    field = await _get_field(db, field_id)
    document = await _get_document(db, field.document_id)
    if document.status != "generated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Os campos so podem ser alterados antes do envio.",
        )

    updates = body.model_dump(exclude_unset=True)
    if "signatory_id" in updates:
        await _validate_signatory(db, document.id, updates["signatory_id"])

    next_x = updates.get("x", field.x)
    next_y = updates.get("y", field.y)
    next_width = updates.get("width", field.width)
    next_height = updates.get("height", field.height)
    _validate_bounds(next_x, next_y, next_width, next_height)

    for key, value in updates.items():
        setattr(field, key, value)

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="field.updated",
        details={"field_id": str(field.id), "fields": list(updates.keys())},
    )
    await db.commit()
    await db.refresh(field)
    return field


@router.delete("/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signature_field(
    field_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a positioned field."""
    field = await _get_field(db, field_id)
    document = await _get_document(db, field.document_id)
    if document.status != "generated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Os campos so podem ser alterados antes do envio.",
        )

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="field.deleted",
        details={"field_id": str(field.id), "field_type": field.field_type},
    )
    await db.delete(field)
    await db.commit()
