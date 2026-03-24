"""Document API routes: create, upload, list, detail, download."""

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.document_file import DocumentFile
from app.models.signature_field import SignatureField
from app.models.signatory import Signatory
from app.models.template import Template
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.schemas.document import DocumentCreate, DocumentResponse, PaginatedDocuments
from app.schemas.signatory import SendRequest, SignatoryResponse
from app.services.audit_service import append_audit_log, verify_audit_chain
from app.services.document_generator import generate_document
from app.services.document_file_service import create_document_file_version, supersede_current_document_files
from app.services.email_service import send_signing_request
from app.services.signature_service import create_signatories
from app.utils.file_storage import document_dir, random_filename, resolve_path
from app.utils.security import sha256_file

router = APIRouter()


def _serialize_file(file: DocumentFile) -> dict:
    return {
        "id": file.id,
        "kind": file.kind,
        "sha256": file.sha256,
        "version_number": file.version_number,
        "is_current": file.is_current,
        "superseded_at": file.superseded_at,
        "created_at": file.created_at,
    }


def _serialize_document(document: Document) -> dict:
    files = sorted(
        [file for file in (document.files or []) if file.is_current],
        key=lambda item: item.created_at,
    )
    signatories = list(document.signatories or [])
    signed_count = sum(1 for signatory in signatories if signatory.status == "signed")
    pending_count = sum(1 for signatory in signatories if signatory.status not in ("signed", "refused"))

    return {
        "id": document.id,
        "title": document.title,
        "template_id": document.template_id,
        "template_name": document.template.name if document.template else None,
        "verification_code": document.verification_code,
        "source_type": document.source_type,
        "status": document.status,
        "field_data": document.field_data or {},
        "created_by_id": document.created_by_id,
        "current_signing_order": document.current_signing_order,
        "expires_at": document.expires_at,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
        "completed_at": document.completed_at,
        "last_activity_at": document.last_activity_at,
        "signatories_count": len(signatories),
        "signed_signatories_count": signed_count,
        "pending_signatories_count": pending_count,
        "files": [_serialize_file(file) for file in files],
    }


def _serialize_document_list_item(document: Document) -> dict:
    signatories = list(document.signatories or [])
    signed_count = sum(1 for signatory in signatories if signatory.status == "signed")

    return {
        "id": document.id,
        "title": document.title,
        "status": document.status,
        "template_id": document.template_id,
        "template_name": document.template.name if document.template else None,
        "verification_code": document.verification_code,
        "source_type": document.source_type,
        "created_at": document.created_at,
        "last_activity_at": document.last_activity_at,
        "signatories_count": len(signatories),
        "signed_signatories_count": signed_count,
    }


def _serialize_audit(
    log: AuditLog,
    document_title: str | None = None,
    *,
    chain_ok: bool | None = None,
) -> dict:
    details = log.details or {}
    actor_label = None
    if isinstance(details, dict):
        actor_label = (
            details.get("signatory_name")
            or details.get("signatory")
            or details.get("email")
            or details.get("title")
        )

    return {
        "id": log.id,
        "actor_type": log.actor_type,
        "actor_id": log.actor_id,
        "actor_label": actor_label,
        "document_id": log.document_id,
        "document_title": document_title,
        "action": log.action,
        "details": log.details,
        "chain_scope": log.chain_scope,
        "prev_entry_hash": log.prev_entry_hash,
        "entry_hash": log.entry_hash,
        "chain_ok": chain_ok,
        "ip_address": str(log.ip_address) if log.ip_address else None,
        "user_agent": log.user_agent,
        "created_at": log.created_at,
    }


def _validate_pdf_upload(file: UploadFile, content: bytes) -> None:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas arquivos PDF sao aceitos.",
        )
    if not content.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo PDF invalido ou corrompido.",
        )


def _default_title_from_filename(filename: str | None) -> str:
    stem = Path(filename or "documento").stem.replace("_", " ").replace("-", " ").strip()
    return stem or "Documento sem titulo"


def _store_uploaded_pdf_sync(document_id: str, content: bytes) -> tuple[str, str]:
    doc_path = document_dir(document_id) / random_filename(".pdf")
    doc_path.write_bytes(content)
    return str(doc_path), sha256_file(doc_path)


async def _load_document_with_relations(db: AsyncSession, document_id: UUID | str) -> Document | None:
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .options(
            selectinload(Document.files),
            selectinload(Document.template),
            selectinload(Document.signatories),
        )
    )
    return result.scalar_one_or_none()


async def _delete_document_artifacts(
    db: AsyncSession,
    document_id: UUID | str,
    *,
    remove_fields: bool,
    remove_source_docx: bool,
) -> None:
    kinds = ["generated_pdf"]
    if remove_source_docx:
        kinds.append("source_docx")

    await supersede_current_document_files(db, str(document_id), kinds)

    if remove_fields:
        fields_result = await db.execute(
            select(SignatureField).where(SignatureField.document_id == document_id)
        )
        for field in fields_result.scalars().all():
            await db.delete(field)


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    body: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a document from a DOCX template and generate the initial PDF."""
    result = await db.execute(select(Template).where(Template.id == body.template_id, Template.is_active == True))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template nao encontrado.")

    template_abs_path = str(settings.TEMPLATES_PATH / template.file_path)

    document = Document(
        title=body.title,
        template_id=template.id,
        source_type="template",
        field_data=body.field_data,
        created_by_id=user.id,
        status="generated",
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(document)
    await db.flush()

    docx_path, pdf_path, docx_hash, pdf_hash = await generate_document(
        template_abs_path,
        body.field_data,
        str(document.id),
        template_fields=template.fields if template.fields else None,
    )

    await create_document_file_version(db, str(document.id), "source_docx", docx_path, docx_hash)
    await create_document_file_version(db, str(document.id), "generated_pdf", pdf_path, pdf_hash)

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="document.created",
        details={"template": template.name, "title": body.title},
    )

    await db.commit()

    fresh_document = await _load_document_with_relations(db, document.id)
    if not fresh_document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")
    return _serialize_document(fresh_document)


@router.post("/upload-pdf", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document_from_pdf(
    title: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a draft document directly from an uploaded PDF."""
    content = await file.read()
    _validate_pdf_upload(file, content)

    document = Document(
        title=title.strip() or _default_title_from_filename(file.filename),
        template_id=None,
        source_type="manual",
        field_data={},
        created_by_id=user.id,
        status="generated",
        last_activity_at=datetime.now(timezone.utc),
    )
    db.add(document)
    await db.flush()

    pdf_path, pdf_hash = await asyncio.to_thread(_store_uploaded_pdf_sync, str(document.id), content)

    await create_document_file_version(db, str(document.id), "generated_pdf", pdf_path, pdf_hash)
    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="document.pdf_uploaded",
        details={"title": document.title, "filename": file.filename or "documento.pdf"},
    )

    await db.commit()

    fresh_document = await _load_document_with_relations(db, document.id)
    if not fresh_document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")
    return _serialize_document(fresh_document)


@router.get("/", response_model=PaginatedDocuments)
async def list_documents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    template_id: UUID | None = None,
    source_filter: str | None = Query(None, alias="source"),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """List documents with pagination and filters."""
    sort_expr = func.coalesce(Document.last_activity_at, Document.created_at)
    base_query = select(
        Document.id,
        sort_expr.label("sort_date"),
        Document.created_at.label("created_at"),
    ).select_from(Document).outerjoin(
        Signatory, Signatory.document_id == Document.id
    )

    if status_filter:
        base_query = base_query.where(Document.status == status_filter)

    if template_id:
        base_query = base_query.where(Document.template_id == template_id)

    if source_filter in {"template", "manual"}:
        base_query = base_query.where(Document.source_type == source_filter)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        base_query = base_query.where(
            or_(
                Document.title.ilike(pattern),
                cast(Document.id, String).ilike(pattern),
                Signatory.name.ilike(pattern),
                Signatory.email.ilike(pattern),
                Signatory.cpf.ilike(pattern),
            )
        )

    base_query = base_query.group_by(Document.id, sort_expr, Document.created_at)
    total_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = total_result.scalar() or 0

    paged_result = await db.execute(
        base_query.order_by(sort_expr.desc(), Document.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    ordered_ids = [row.id for row in paged_result.all()]

    if not ordered_ids:
        return PaginatedDocuments(items=[], total=total, page=page, per_page=per_page)

    documents_result = await db.execute(
        select(Document)
        .where(Document.id.in_(ordered_ids))
        .options(
            selectinload(Document.template),
            selectinload(Document.signatories),
        )
    )
    documents = documents_result.scalars().all()
    documents_by_id = {document.id: document for document in documents}
    items = [_serialize_document_list_item(documents_by_id[document_id]) for document_id in ordered_ids]

    return PaginatedDocuments(items=items, total=total, page=page, per_page=per_page)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get a document with related files and signatory counts."""
    document = await _load_document_with_relations(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")
    return _serialize_document(document)


@router.post("/{document_id}/upload-pdf", response_model=DocumentResponse)
async def replace_document_pdf(
    document_id: UUID,
    title: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Replace the draft PDF before the document is sent for signature."""
    result = await db.execute(
        select(Document)
        .where(Document.id == document_id)
        .options(
            selectinload(Document.files),
            selectinload(Document.template),
            selectinload(Document.signatories),
        )
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")

    if document.status != "generated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O PDF so pode ser substituido enquanto o documento estiver em rascunho.",
        )

    content = await file.read()
    _validate_pdf_upload(file, content)

    await _delete_document_artifacts(
        db,
        document.id,
        remove_fields=True,
        remove_source_docx=True,
    )

    pdf_path, pdf_hash = await asyncio.to_thread(_store_uploaded_pdf_sync, str(document.id), content)

    document.source_type = "manual"
    document.template_id = None
    document.last_activity_at = datetime.now(timezone.utc)
    if title.strip():
        document.title = title.strip()

    await create_document_file_version(db, str(document.id), "generated_pdf", pdf_path, pdf_hash)
    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="document.pdf_replaced",
        details={
            "title": document.title,
            "filename": file.filename or "documento.pdf",
            "fields_reset": True,
        },
    )
    await db.commit()

    fresh_document = await _load_document_with_relations(db, document.id)
    if not fresh_document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")
    return _serialize_document(fresh_document)


@router.get("/{document_id}/files/{file_id}/download")
async def download_file(
    document_id: UUID,
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download a stored document file."""
    result = await db.execute(
        select(DocumentFile).where(
            DocumentFile.id == file_id,
            DocumentFile.document_id == document_id,
        )
    )
    document_file = result.scalar_one_or_none()
    if not document_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado.")

    abs_path = resolve_path(document_file.path)
    if not abs_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado no disco.")

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document_id,
        action="document.downloaded",
        details={
            "file_kind": document_file.kind,
            "file_id": str(document_file.id),
            "version_number": document_file.version_number,
        },
    )
    await db.commit()

    ext = abs_path.suffix.lower()
    media_type = (
        "application/pdf"
        if ext == ".pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return FileResponse(path=str(abs_path), media_type=media_type, filename=f"{document_file.kind}{ext}")


@router.get("/{document_id}/signatories", response_model=list[SignatoryResponse])
async def get_document_signatories(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get signatories for a document."""
    result = await db.execute(
        select(Signatory)
        .where(Signatory.document_id == document_id)
        .order_by(Signatory.signing_order, Signatory.created_at)
    )
    return result.scalars().all()


@router.post("/{document_id}/send", response_model=list[SignatoryResponse])
async def send_for_signing(
    document_id: UUID,
    body: SendRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Send a generated document for signing."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")

    if document.status != "generated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documento ja foi enviado para assinatura.",
        )

    existing_result = await db.execute(
        select(Signatory)
        .where(Signatory.document_id == document.id)
        .order_by(Signatory.signing_order, Signatory.created_at)
    )
    signatories = existing_result.scalars().all()

    if not signatories and body.signatories:
        signatories = await create_signatories(
            db,
            str(document.id),
            [signatory.model_dump() for signatory in body.signatories],
        )

    if not signatories:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Adicione pelo menos um signatario.")

    now = datetime.now(timezone.utc)
    for signatory in signatories:
        signatory.status = "sent"
        signatory.sent_at = now

    document.status = "sent"
    positive_orders = sorted({signatory.signing_order for signatory in signatories if signatory.signing_order > 0})
    document.current_signing_order = positive_orders[0] if positive_orders else 0
    document.last_activity_at = now

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="document.sent",
        details={
            "title": document.title,
            "signatories_count": len(signatories),
            "signatories": [signatory.name for signatory in signatories],
        },
    )
    await db.commit()

    fresh_result = await db.execute(
        select(Signatory)
        .where(Signatory.document_id == document.id)
        .order_by(Signatory.signing_order, Signatory.created_at)
    )
    fresh_signatories = fresh_result.scalars().all()

    positive_orders = sorted(
        {signatory.signing_order for signatory in fresh_signatories if signatory.signing_order > 0}
    )
    first_order = positive_orders[0] if positive_orders else None

    for signatory in fresh_signatories:
        if signatory.signing_order == 0 or first_order is None or signatory.signing_order == first_order:
            signing_url = f"{settings.BASE_URL}/sign/{signatory.token}"
            asyncio.create_task(
                send_signing_request(
                    signatory.email,
                    signatory.name,
                    document.title,
                    signing_url,
                    signatory.role_label,
                )
            )

    return fresh_signatories


@router.post("/{document_id}/signatories/{signatory_id}/resend", status_code=status.HTTP_204_NO_CONTENT)
async def resend_signing_link(
    document_id: UUID,
    signatory_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Resend the signing request email to a specific signatory."""
    result = await db.execute(
        select(Signatory).where(
            Signatory.id == signatory_id,
            Signatory.document_id == document_id,
        )
    )
    signatory = result.scalar_one_or_none()
    if not signatory:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signatario nao encontrado.")

    if signatory.status in ("signed", "refused"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signatario ja finalizou a assinatura.",
        )

    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    document = doc_result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")

    signing_url = f"{settings.BASE_URL}/sign/{signatory.token}"
    asyncio.create_task(
        send_signing_request(
            signatory.email,
            signatory.name,
            document.title,
            signing_url,
            signatory.role_label,
        )
    )

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="signature.resent",
        details={"signatory": signatory.name, "email": signatory.email},
    )
    await db.commit()


@router.post("/{document_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel a document and invalidate all signing links."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")

    if document.status in ("completed", "cancelled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Documento nao pode ser cancelado.")

    document.status = "cancelled"
    document.last_activity_at = datetime.now(timezone.utc)

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        document_id=document.id,
        action="document.cancelled",
        details={"title": document.title},
    )
    await db.commit()


@router.get("/{document_id}/audit", response_model=list[AuditLogResponse])
async def get_document_audit(
    document_id: UUID,
    action_filter: str | None = Query(None, alias="action"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get chronological audit trail for a document."""
    document = await _load_document_with_relations(db, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento nao encontrado.")

    query = select(AuditLog).where(AuditLog.document_id == document_id)
    if action_filter:
        query = query.where(AuditLog.action == action_filter)

    result = await db.execute(query.order_by(AuditLog.created_at.asc(), AuditLog.id.asc()))
    logs = result.scalars().all()
    integrity_map = verify_audit_chain(logs)
    return [_serialize_audit(log, document.title, chain_ok=integrity_map.get(log.id)) for log in logs]
