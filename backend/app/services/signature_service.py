"""Signature service: token management, signing order, completion check."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_file import DocumentFile
from app.models.signatory import Signatory
from app.models.signature_event import SignatureEvent
from app.services.audit_service import append_audit_log
from app.services.document_file_service import create_document_file_version
from app.utils.security import generate_signing_token


async def create_signatories(
    db: AsyncSession,
    document_id: str,
    signatories_data: list[dict],
) -> list[Signatory]:
    """Create signatory records for a document."""
    created = []
    for data in signatories_data:
        require_email_otp = data.get("auth_require_email_otp", True)
        sig = Signatory(
            document_id=document_id,
            name=data["name"],
            email=data["email"],
            cpf=data.get("cpf"),
            phone_country_code=data.get("phone_country_code"),
            phone_number=data.get("phone_number"),
            role_label=data.get("role_label"),
            signing_order=data.get("signing_order", 0),
            token=generate_signing_token(),
            auth_method=data.get("auth_method", "otp_email" if require_email_otp else "none"),
            auth_require_email_otp=require_email_otp,
            auth_require_full_name=data.get("auth_require_full_name", True),
            auth_require_cpf=data.get("auth_require_cpf", False),
            status="pending",
        )
        db.add(sig)
        created.append(sig)
    await db.flush()
    return created


async def get_signatory_by_token(db: AsyncSession, token: str) -> Signatory | None:
    """Find a signatory by their unique token."""
    result = await db.execute(
        select(Signatory).where(Signatory.token == token)
    )
    return result.scalar_one_or_none()


async def check_signing_order(db: AsyncSession, signatory: Signatory) -> tuple[bool, str | None]:
    """
    Check if this signatory is allowed to sign based on signing order.
    Returns (can_sign, error_message).
    """
    if signatory.signing_order == 0:
        return True, None

    # Check if all signatories with lower order have signed
    result = await db.execute(
        select(Signatory).where(
            Signatory.document_id == signatory.document_id,
            Signatory.signing_order < signatory.signing_order,
            Signatory.signing_order > 0,
            Signatory.status != "signed",
        )
    )
    pending = result.scalars().all()
    if pending:
        return False, "Aguardando assinatura de outros signatários na ordem definida."
    return True, None


async def record_event(
    db: AsyncSession,
    signatory: Signatory,
    event: str,
    ip: str | None = None,
    ua: str | None = None,
    metadata: dict | None = None,
) -> SignatureEvent:
    """Record a signature event."""
    evt = SignatureEvent(
        signatory_id=signatory.id,
        document_id=signatory.document_id,
        event=event,
        ip_address=ip,
        user_agent=ua,
        metadata_=metadata,
    )
    db.add(evt)
    return evt


async def record_audit(
    db: AsyncSession,
    signatory: Signatory,
    action: str,
    ip: str | None = None,
    ua: str | None = None,
    details: dict | None = None,
) -> None:
    """Record an audit log entry for a signatory action."""
    await append_audit_log(
        db,
        actor_type="signatory",
        actor_id=signatory.id,
        document_id=signatory.document_id,
        action=action,
        details=details,
        ip_address=ip,
        user_agent=ua,
    )


async def check_all_signed(db: AsyncSession, document_id: str) -> bool:
    """Check if all signatories have signed."""
    result = await db.execute(
        select(Signatory).where(
            Signatory.document_id == document_id,
            Signatory.status != "signed",
            Signatory.status != "refused",
        )
    )
    pending = result.scalars().all()
    return len(pending) == 0


async def get_next_signatories_to_notify(
    db: AsyncSession,
    document_id: str,
    completed_order: int,
) -> list[Signatory]:
    """Return the next signing batch once the current order is fully completed."""
    if completed_order <= 0:
        return []

    current_order_result = await db.execute(
        select(Signatory).where(
            Signatory.document_id == document_id,
            Signatory.signing_order == completed_order,
            ~Signatory.status.in_(["signed", "refused"]),
        )
    )
    if current_order_result.scalars().first():
        return []

    next_order_result = await db.execute(
        select(Signatory.signing_order)
        .where(
            Signatory.document_id == document_id,
            Signatory.signing_order > completed_order,
            ~Signatory.status.in_(["signed", "refused"]),
        )
        .order_by(Signatory.signing_order.asc())
        .limit(1)
    )
    next_order = next_order_result.scalar_one_or_none()
    if next_order is None:
        return []

    signatories_result = await db.execute(
        select(Signatory).where(
            Signatory.document_id == document_id,
            Signatory.signing_order == next_order,
            ~Signatory.status.in_(["signed", "refused"]),
        )
    )
    return signatories_result.scalars().all()


async def complete_document(
    db: AsyncSession,
    document: Document,
    signed_pdf_path: str,
    signed_pdf_hash: str,
    cert_pdf_path: str,
    cert_pdf_hash: str,
) -> None:
    """Mark document as completed and store final files."""
    document.status = "completed"
    document.completed_at = datetime.now(timezone.utc)
    document.last_activity_at = datetime.now(timezone.utc)
    document.current_signing_order = 0

    await upsert_document_file(db, document.id, "signed_pdf", signed_pdf_path, signed_pdf_hash)
    await upsert_document_file(db, document.id, "certificate_pdf", cert_pdf_path, cert_pdf_hash)

    await append_audit_log(
        db,
        actor_type="system",
        document_id=document.id,
        action="document.completed",
        details={"title": document.title},
    )


async def upsert_document_file(
    db: AsyncSession,
    document_id: str,
    kind: str,
    absolute_path: str,
    sha256: str,
) -> DocumentFile:
    """Create a new version for a document file kind and keep previous ones archived."""
    return await create_document_file_version(db, document_id, kind, absolute_path, sha256)


async def update_partial_document_pdf(
    db: AsyncSession,
    document: Document,
    signed_pdf_path: str,
    signed_pdf_hash: str,
) -> None:
    """Store the latest partial signed PDF while the document is still in progress."""
    await upsert_document_file(db, document.id, "signed_pdf", signed_pdf_path, signed_pdf_hash)
    await append_audit_log(
        db,
        actor_type="system",
        document_id=document.id,
        action="document.partial_pdf_updated",
        details={"title": document.title},
    )
