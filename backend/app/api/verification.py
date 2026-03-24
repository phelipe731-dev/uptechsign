"""Public document verification endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import build_rate_limit_key, get_client_ip, get_user_agent
from app.config import settings
from app.database import get_db
from app.models.document import Document
from app.models.document_file import DocumentFile
from app.models.signatory import Signatory
from app.services.audit_service import append_audit_log
from app.services.institutional_signature_service import get_institutional_signature_info
from app.services.rate_limit_service import rate_limiter
from app.schemas.verification import (
    PublicVerificationResponse,
    VerificationFileResponse,
    VerificationIntegrityResponse,
    VerificationSignatoryResponse,
)
from app.utils.file_storage import resolve_path

router = APIRouter()

FILE_LABELS = {
    "source_docx": "DOCX original",
    "generated_pdf": "PDF base",
    "signed_pdf": "PDF assinado",
    "certificate_pdf": "Certificado de assinatura",
}


def _enforce_public_rate_limit(request: Request, scope: str, *, extra: str | None = None) -> None:
    result = rate_limiter.hit(
        build_rate_limit_key(request, scope, extra=extra),
        settings.PUBLIC_VERIFICATION_RATE_LIMIT,
        settings.PUBLIC_RATE_LIMIT_WINDOW_SECONDS,
    )
    if result.allowed:
        return

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Muitas consultas em pouco tempo. Tente novamente em {result.retry_after_seconds}s.",
        headers={"Retry-After": str(result.retry_after_seconds)},
    )


def _mask_email(email: str | None) -> str:
    if not email:
        return "-"
    local, _, domain = email.partition("@")
    if not domain:
        return "-"
    if len(local) <= 2:
        return f"{local[:1]}***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


def _mask_cpf(cpf: str | None) -> str:
    if not cpf:
        return "-"
    digits = "".join(ch for ch in cpf if ch.isdigit())
    if len(digits) != 11:
        return "***"
    return f"***.{digits[3:6]}.{digits[6:9]}-**"


def _mask_phone(phone: str | None) -> str:
    if not phone:
        return "-"
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 4:
        return "***"
    return f"{'*' * max(0, len(digits) - 4)}{digits[-4:]}"


def _restrict_ip(ip: str | None) -> str:
    return "Disponivel apenas na auditoria interna" if ip else "-"


def _restrict_user_agent(user_agent: str | None) -> str:
    return "Disponivel apenas na auditoria interna" if user_agent else "-"


async def _get_document_by_code(db: AsyncSession, code: str) -> Document:
    result = await db.execute(select(Document).where(Document.verification_code == code))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Codigo de verificacao nao encontrado.",
        )
    return document


async def _get_latest_files(db: AsyncSession, document_id: str) -> dict[str, DocumentFile]:
    result = await db.execute(
        select(DocumentFile)
        .where(
            DocumentFile.document_id == document_id,
            DocumentFile.is_current == True,
        )
        .order_by(DocumentFile.created_at.desc())
    )
    return {file.kind: file for file in result.scalars().all()}


async def _get_signatories(db: AsyncSession, document_id: str) -> list[Signatory]:
    result = await db.execute(
        select(Signatory)
        .where(Signatory.document_id == document_id)
        .order_by(Signatory.signing_order.asc(), Signatory.created_at.asc())
    )
    return result.scalars().all()


def _identity_phone(signatory: Signatory) -> str | None:
    if not signatory.identity_phone_number:
        return None
    if signatory.identity_phone_country_code:
        return f"{signatory.identity_phone_country_code} {signatory.identity_phone_number}"
    return signatory.identity_phone_number


async def _record_public_audit(
    db: AsyncSession,
    document: Document,
    request: Request,
    action: str,
    details: dict | None = None,
) -> None:
    await append_audit_log(
        db,
        actor_type="public",
        document_id=document.id,
        action=action,
        details=details,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    await db.commit()


@router.get("/{code}", response_model=PublicVerificationResponse)
async def get_verification_details(
    code: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    _enforce_public_rate_limit(request, "verify-details", extra=code)
    document = await _get_document_by_code(db, code)
    files = await _get_latest_files(db, str(document.id))
    signatories = await _get_signatories(db, str(document.id))
    try:
        integrity_info = get_institutional_signature_info()
    except Exception:
        integrity_info = VerificationIntegrityResponse(
            configured=False,
            signer_name=None,
            issuer_name=None,
            certificate_serial=None,
            valid_until=None,
            profile=None,
        )
    else:
        integrity_info = VerificationIntegrityResponse(**integrity_info.as_dict())

    await _record_public_audit(
        db,
        document,
        request,
        "document.verified_public",
        {"verification_code": document.verification_code},
    )

    hashes = [
        VerificationFileResponse(
            id=file.id,
            kind=file.kind,
            label=FILE_LABELS.get(file.kind, file.kind),
            sha256=file.sha256,
            created_at=file.created_at,
            download_url=(
                f"/api/verify/{document.verification_code}/{file.kind}"
                if kind in {"signed_pdf", "certificate_pdf"}
                else ""
            ),
        )
        for kind in ["generated_pdf", "signed_pdf", "certificate_pdf", "source_docx"]
        if (file := files.get(kind))
    ]

    signatory_items = [
        VerificationSignatoryResponse(
            id=signatory.id,
            name=signatory.name,
            email=_mask_email(signatory.email),
            cpf=_mask_cpf(signatory.cpf),
            role_label=signatory.role_label,
            status=signatory.status,
            signing_order=signatory.signing_order,
            auth_method=signatory.auth_method,
            auth_require_email_otp=signatory.auth_require_email_otp,
            viewed_at=signatory.viewed_at,
            identity_name=signatory.identity_name,
            identity_email=_mask_email(signatory.identity_email),
            identity_phone=_mask_phone(_identity_phone(signatory)),
            identity_confirmed_at=signatory.identity_confirmed_at,
            otp_sent_at=signatory.otp_sent_at,
            otp_verified_at=signatory.verified_at,
            terms_accepted_at=signatory.terms_accepted_at,
            accepted_terms_version=signatory.accepted_terms_version,
            signed_at=signatory.signed_at,
            refused_at=signatory.refused_at,
            signature_mode=(signatory.signature_data or {}).get("signature_mode"),
            ip_address_at_sign=_restrict_ip(str(signatory.ip_address_at_sign) if signatory.ip_address_at_sign else None),
            user_agent_at_sign=_restrict_user_agent(signatory.user_agent_at_sign),
        )
        for signatory in signatories
    ]

    return PublicVerificationResponse(
        document_id=document.id,
        document_title=document.title,
        status=document.status,
        source_type=document.source_type,
        verification_code=document.verification_code,
        verification_url=f"{settings.BASE_URL}/verify/{document.verification_code}",
        created_at=document.created_at,
        completed_at=document.completed_at,
        signatories_count=len(signatories),
        signed_signatories_count=sum(1 for signatory in signatories if signatory.status == "signed"),
        public_data_masked=True,
        integrity=integrity_info,
        hashes=hashes,
        signatories=signatory_items,
    )


@router.get("/{code}/{kind}")
async def download_verification_file(
    code: str,
    kind: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    _enforce_public_rate_limit(request, "verify-download", extra=code)
    if kind not in {"signed_pdf", "certificate_pdf"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao disponivel.")

    document = await _get_document_by_code(db, code)
    files = await _get_latest_files(db, str(document.id))
    file = files.get(kind)
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado.")

    abs_path = resolve_path(file.path)
    if not abs_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo nao encontrado no disco.")

    await _record_public_audit(
        db,
        document,
        request,
        "document.downloaded_public",
        {
            "verification_code": document.verification_code,
            "kind": kind,
        },
    )

    return FileResponse(
        path=str(abs_path),
        filename=abs_path.name,
        media_type="application/pdf",
    )
