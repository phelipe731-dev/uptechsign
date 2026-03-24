"""Public signing API endpoints - no auth required."""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import build_rate_limit_key, get_client_ip, get_user_agent
from app.config import settings
from app.database import get_db
from app.models.document import Document
from app.models.document_file import DocumentFile
from app.models.signature_field import SignatureField
from app.models.signatory import Signatory
from app.models.user import User
from app.schemas.signatory import (
    IdentityConfirmRequest,
    OtpVerifyRequest,
    PublicDocumentInfo,
    RefuseRequest,
    SignRequest,
)
from app.services.email_service import (
    send_document_completed,
    send_otp,
    send_refusal_notification,
    send_signing_confirmation,
    send_signing_request,
)
from app.services.geolocation_service import lookup_ip_geolocation
from app.services.otp_service import generate_otp, get_resend_cooldown_remaining, invalidate_otp, verify_otp
from app.services.pdf_service import generate_partial_signed_document, generate_signed_document
from app.services.rate_limit_service import rate_limiter
from app.services.signature_service import (
    check_all_signed,
    check_signing_order,
    complete_document,
    get_next_signatories_to_notify,
    get_signatory_by_token,
    record_audit,
    record_event,
    update_partial_document_pdf,
)
from app.utils.file_storage import resolve_path

router = APIRouter()

TOKEN_ERROR = "Link invalido ou expirado."


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _normalize_digits(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    return digits or None


def _enforce_public_rate_limit(
    request: Request,
    scope: str,
    limit: int,
    *,
    extra: str | None = None,
) -> None:
    result = rate_limiter.hit(
        build_rate_limit_key(request, scope, extra=extra),
        limit,
        settings.PUBLIC_RATE_LIMIT_WINDOW_SECONDS,
    )
    if result.allowed:
        return

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Muitas tentativas para esta operacao. Tente novamente em {result.retry_after_seconds}s.",
        headers={"Retry-After": str(result.retry_after_seconds)},
    )


async def _get_valid_signatory(db: AsyncSession, token: str) -> tuple[Signatory, Document]:
    """Get signatory and document, validating token and availability."""
    sig = await get_signatory_by_token(db, token)
    if not sig:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TOKEN_ERROR)

    result = await db.execute(select(Document).where(Document.id == sig.document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=TOKEN_ERROR)

    if doc.expires_at and doc.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Este documento expirou.")

    if doc.status in ("cancelled", "expired"):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Este documento nao esta mais disponivel.")

    if sig.status in ("signed", "refused"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Voce ja respondeu a este documento.")

    return sig, doc


async def _get_signatory_fields(db: AsyncSession, signatory_id: str) -> list[SignatureField]:
    result = await db.execute(
        select(SignatureField)
        .where(SignatureField.signatory_id == signatory_id)
        .order_by(SignatureField.page, SignatureField.created_at)
    )
    return result.scalars().all()


@router.get("/{token}", response_model=PublicDocumentInfo)
async def get_signing_info(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get document info for the public signing page."""
    _enforce_public_rate_limit(request, "sign-info", settings.PUBLIC_LINK_RATE_LIMIT)
    sig, doc = await _get_valid_signatory(db, token)
    fields = await _get_signatory_fields(db, str(sig.id))

    if not sig.viewed_at:
        now = datetime.now(timezone.utc)
        sig.viewed_at = now
        if sig.status == "sent":
            sig.status = "viewed"
        await record_event(db, sig, "link_opened", get_client_ip(request), get_user_agent(request))
        await record_audit(
            db,
            sig,
            "signature.viewed",
            get_client_ip(request),
            get_user_agent(request),
            {"signatory_name": sig.name},
        )
        doc.last_activity_at = now
        await db.commit()

    return PublicDocumentInfo(
        document_title=doc.title,
        signatory_name=sig.name,
        signatory_role=sig.role_label,
        status=sig.status,
        identity_confirmed=bool(sig.identity_confirmed_at),
        requires_otp=sig.auth_require_email_otp,
        require_full_name=sig.auth_require_full_name,
        require_email=True,
        require_cpf=sig.auth_require_cpf,
        terms_version=settings.LEGAL_TERMS_VERSION,
        terms_summary=settings.LEGAL_TERMS_ACCEPTANCE_TEXT,
        fields=fields,
    )


@router.get("/{token}/pdf")
async def get_signing_pdf(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Serve the PDF for in-browser viewing."""
    _enforce_public_rate_limit(request, "sign-pdf", settings.PUBLIC_PDF_RATE_LIMIT, extra=token)
    _sig, doc = await _get_valid_signatory(db, token)

    result = await db.execute(
        select(DocumentFile)
        .where(
            DocumentFile.document_id == doc.id,
            DocumentFile.kind == "generated_pdf",
            DocumentFile.is_current == True,
        )
        .order_by(DocumentFile.created_at.desc())
        .limit(1)
    )
    pdf_file = result.scalar_one_or_none()
    if not pdf_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF nao encontrado.")

    abs_path = resolve_path(pdf_file.path)
    if not abs_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF nao encontrado no disco.")

    return FileResponse(
        path=str(abs_path),
        media_type="application/pdf",
        headers={"Content-Disposition": "inline"},
    )


@router.post("/{token}/confirm-identity")
async def confirm_identity(
    token: str,
    body: IdentityConfirmRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Confirm signatory identity before OTP/signing."""
    _enforce_public_rate_limit(request, "sign-identity", settings.PUBLIC_IDENTITY_RATE_LIMIT, extra=token)
    sig, doc = await _get_valid_signatory(db, token)

    normalized_email = _normalize_email(body.email)
    if normalized_email != _normalize_email(sig.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O email informado nao corresponde ao destinatario do documento.",
        )

    if sig.auth_require_full_name and not body.full_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome completo.")

    if sig.auth_require_cpf:
        provided_cpf = _normalize_digits(body.cpf)
        expected_cpf = _normalize_digits(sig.cpf)
        if not provided_cpf:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o CPF para continuar.")
        if expected_cpf and provided_cpf != expected_cpf:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CPF nao confere com o cadastro.")

    now = datetime.now(timezone.utc)
    sig.identity_name = body.full_name.strip()
    sig.identity_email = normalized_email
    sig.identity_phone_country_code = body.phone_country_code or sig.phone_country_code
    sig.identity_phone_number = _normalize_digits(body.phone_number) or sig.phone_number
    sig.identity_confirmed_at = now

    if sig.status in ("pending", "sent", "viewed"):
        sig.status = "identity_confirmed"

    await record_event(db, sig, "identity_confirmed", get_client_ip(request), get_user_agent(request))
    await record_audit(
        db,
        sig,
        "identity.confirmed",
        get_client_ip(request),
        get_user_agent(request),
        {"signatory_name": sig.name},
    )
    doc.last_activity_at = now
    await db.commit()

    return {
        "message": "Identidade confirmada com sucesso.",
        "requires_otp": sig.auth_require_email_otp,
    }


@router.post("/{token}/otp/request")
async def request_otp(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Request an OTP code to be sent to the signatory email."""
    _enforce_public_rate_limit(
        request,
        "sign-otp-request",
        settings.PUBLIC_OTP_REQUEST_RATE_LIMIT,
        extra=token,
    )
    sig, doc = await _get_valid_signatory(db, token)

    if not sig.identity_confirmed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirme sua identidade antes de solicitar o codigo.",
        )

    can_sign, error = await check_signing_order(db, sig)
    if not can_sign:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error)

    cooldown_remaining = get_resend_cooldown_remaining(sig)
    if cooldown_remaining > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Aguarde {cooldown_remaining}s para solicitar um novo codigo.",
        )

    code = generate_otp(sig)
    await record_event(db, sig, "otp_requested", get_client_ip(request), get_user_agent(request))
    await record_audit(
        db,
        sig,
        "otp.sent",
        get_client_ip(request),
        get_user_agent(request),
        {"signatory_name": sig.name},
    )
    doc.last_activity_at = datetime.now(timezone.utc)
    await db.commit()

    asyncio.create_task(send_otp(sig.email, sig.name, code, doc.title))

    return {
        "message": "Codigo enviado para seu email.",
        "email_hint": _mask_email(sig.email),
        "cooldown_seconds": 60,
        "debug_code": code if settings.DEBUG_EXPOSE_OTP else None,
    }


@router.post("/{token}/otp/verify")
async def verify_otp_code(
    token: str,
    body: OtpVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify the OTP code sent by email."""
    _enforce_public_rate_limit(
        request,
        "sign-otp-verify",
        settings.PUBLIC_OTP_VERIFY_RATE_LIMIT,
        extra=token,
    )
    sig, doc = await _get_valid_signatory(db, token)

    if not sig.identity_confirmed_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirme sua identidade antes de validar o codigo.",
        )

    can_sign, error = await check_signing_order(db, sig)
    if not can_sign:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error)

    success, error = verify_otp(sig, body.code)
    if not success:
        await record_event(
            db,
            sig,
            "otp_failed",
            get_client_ip(request),
            get_user_agent(request),
            {"error": error},
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    sig.status = "otp_verified"
    sig.verified_at = datetime.now(timezone.utc)
    await record_event(db, sig, "otp_verified", get_client_ip(request), get_user_agent(request))
    await record_audit(
        db,
        sig,
        "otp.verified",
        get_client_ip(request),
        get_user_agent(request),
        {"signatory_name": sig.name},
    )
    doc.last_activity_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Codigo verificado com sucesso."}


@router.post("/{token}/sign")
async def submit_signature(
    token: str,
    body: SignRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Submit the actual signature after identity and OTP checks."""
    _enforce_public_rate_limit(
        request,
        "sign-submit",
        settings.PUBLIC_SIGN_SUBMIT_RATE_LIMIT,
        extra=token,
    )
    sig, doc = await _get_valid_signatory(db, token)

    if not sig.identity_confirmed_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Confirme sua identidade antes de assinar.",
        )

    if sig.auth_require_email_otp and sig.status != "otp_verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verifique o codigo OTP antes de assinar.",
        )

    can_sign, error = await check_signing_order(db, sig)
    if not can_sign:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error)

    ip = get_client_ip(request)
    ua = get_user_agent(request)
    now = datetime.now(timezone.utc)
    geolocation = lookup_ip_geolocation(ip)
    signature_name = body.typed_name.strip()
    signature_image = body.signature_image_base64 if body.signature_mode == "drawn" else None
    fields = await _get_signatory_fields(db, str(sig.id))
    provided_field_values = {str(field_id): value.strip() for field_id, value in body.field_values.items()}

    for field in fields:
        if field.field_type != "text":
            continue

        value = provided_field_values.get(str(field.id), "").strip()
        if field.required and not value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Preencha o campo '{field.label or 'Texto'}' antes de assinar.",
            )

        field.value = value or None
        field.filled_at = now if value else None

    sig.status = "signed"
    sig.signed_at = now
    sig.accepted_terms_version = settings.LEGAL_TERMS_VERSION
    sig.terms_accepted_at = sig.terms_accepted_at or now
    sig.terms_accepted_ip = sig.terms_accepted_ip or ip
    sig.terms_accepted_user_agent = sig.terms_accepted_user_agent or ua
    sig.signature_data = {
        "typed_name": signature_name,
        "signature_mode": body.signature_mode,
        "signature_image_base64": signature_image,
        "identity_name": sig.identity_name,
        "terms_acceptance": {
            "version": settings.LEGAL_TERMS_VERSION,
            "summary": settings.LEGAL_TERMS_ACCEPTANCE_TEXT,
        },
        "field_values": {
            str(field.id): field.value
            for field in fields
            if field.field_type == "text" and field.value
        },
    }
    sig.ip_address_at_sign = ip
    sig.user_agent_at_sign = ua
    sig.sign_latitude = geolocation.latitude if geolocation else None
    sig.sign_longitude = geolocation.longitude if geolocation else None
    sig.sign_location_label = geolocation.label if geolocation else None
    sig.sign_location_source = geolocation.source if geolocation else None

    invalidate_otp(sig)

    await record_event(db, sig, "terms_accepted", ip, ua, {"version": settings.LEGAL_TERMS_VERSION})
    await record_audit(
        db,
        sig,
        "terms.accepted",
        ip,
        ua,
        {
            "version": settings.LEGAL_TERMS_VERSION,
            "statement": settings.LEGAL_TERMS_ACCEPTANCE_TEXT,
            "signatory_name": sig.name,
        },
    )
    await record_event(db, sig, "signed", ip, ua)
    await record_audit(db, sig, "signature.signed", ip, ua, {"signatory_name": sig.name})

    doc.last_activity_at = now
    if doc.status in ("sent", "generated"):
        doc.status = "in_signing"

    await db.flush()

    all_signed = await check_all_signed(db, str(doc.id))
    next_signatories: list[Signatory] = []
    pdf_result = await db.execute(
        select(DocumentFile)
        .where(
            DocumentFile.document_id == doc.id,
            DocumentFile.kind == "generated_pdf",
            DocumentFile.is_current == True,
        )
        .order_by(DocumentFile.created_at.desc())
        .limit(1)
    )
    pdf_file = pdf_result.scalar_one_or_none()

    if pdf_file:
        original_pdf_path = str(resolve_path(pdf_file.path))

        signed_signatories_result = await db.execute(
            select(Signatory)
            .where(
                Signatory.document_id == doc.id,
                Signatory.status == "signed",
            )
            .order_by(Signatory.signing_order, Signatory.signed_at)
        )
        signed_signatories = signed_signatories_result.scalars().all()

        signatories_data = []
        for signed_sig in signed_signatories:
            signatories_data.append(
                {
                    "id": str(signed_sig.id),
                    "name": signed_sig.name,
                    "email": signed_sig.email,
                    "cpf": signed_sig.cpf,
                    "role_label": signed_sig.role_label,
                    "signing_order": signed_sig.signing_order,
                    "token": signed_sig.token,
                    "status": signed_sig.status,
                    "auth_method": signed_sig.auth_method,
                    "auth_require_email_otp": signed_sig.auth_require_email_otp,
                    "sent_at": signed_sig.sent_at.isoformat() if signed_sig.sent_at else None,
                    "viewed_at": signed_sig.viewed_at.isoformat() if signed_sig.viewed_at else None,
                    "identity_confirmed_at": (
                        signed_sig.identity_confirmed_at.isoformat()
                        if signed_sig.identity_confirmed_at
                        else None
                    ),
                    "identity_name": signed_sig.identity_name,
                    "identity_email": signed_sig.identity_email,
                    "identity_phone_country_code": signed_sig.identity_phone_country_code,
                    "identity_phone_number": signed_sig.identity_phone_number,
                    "otp_sent_at": signed_sig.otp_sent_at.isoformat() if signed_sig.otp_sent_at else None,
                    "verified_at": signed_sig.verified_at.isoformat() if signed_sig.verified_at else None,
                    "terms_accepted_at": (
                        signed_sig.terms_accepted_at.isoformat() if signed_sig.terms_accepted_at else None
                    ),
                    "accepted_terms_version": signed_sig.accepted_terms_version,
                    "signed_at": signed_sig.signed_at.isoformat() if signed_sig.signed_at else None,
                    "refused_at": signed_sig.refused_at.isoformat() if signed_sig.refused_at else None,
                    "sign_latitude": signed_sig.sign_latitude,
                    "sign_longitude": signed_sig.sign_longitude,
                    "sign_location_label": signed_sig.sign_location_label,
                    "sign_location_source": signed_sig.sign_location_source,
                    "ip_address_at_sign": str(signed_sig.ip_address_at_sign) if signed_sig.ip_address_at_sign else None,
                    "user_agent_at_sign": signed_sig.user_agent_at_sign,
                    "signature_data": signed_sig.signature_data,
                }
            )

        fields_result = await db.execute(
            select(SignatureField)
            .where(SignatureField.document_id == doc.id)
            .order_by(SignatureField.page, SignatureField.created_at)
        )
        fields_data = []
        for field in fields_result.scalars().all():
            fields_data.append(
                {
                    "id": str(field.id),
                    "signatory_id": str(field.signatory_id),
                    "page": field.page,
                    "field_type": field.field_type,
                    "label": field.label,
                    "x": field.x,
                    "y": field.y,
                    "width": field.width,
                    "height": field.height,
                    "required": field.required,
                    "value": field.value,
                }
            )

        if all_signed:
            signed_path, signed_hash, cert_path, cert_hash = await generate_signed_document(
                str(doc.id),
                doc.title,
                str(doc.id),
                doc.created_at,
                original_pdf_path,
                signatories_data,
                fields_data,
                doc.verification_code,
                f"{settings.BASE_URL}/verify/{doc.verification_code}",
            )
            await complete_document(db, doc, signed_path, signed_hash, cert_path, cert_hash)
        else:
            partial_signed_path, partial_signed_hash = await generate_partial_signed_document(
                str(doc.id),
                original_pdf_path,
                signatories_data,
                fields_data,
            )
            await update_partial_document_pdf(db, doc, partial_signed_path, partial_signed_hash)

    if not all_signed:
        next_signatories = await get_next_signatories_to_notify(db, str(doc.id), sig.signing_order)
        if next_signatories:
            doc.current_signing_order = next_signatories[0].signing_order

    await db.commit()

    creator_result = await db.execute(select(User).where(User.id == doc.created_by_id))
    creator = creator_result.scalar_one_or_none()
    if creator:
        doc_url = f"{settings.BASE_URL}/documents/{doc.id}"
        if all_signed:
            asyncio.create_task(send_document_completed(creator.email, doc.title, doc_url))
        else:
            remaining_result = await db.execute(
                select(Signatory).where(
                    Signatory.document_id == doc.id,
                    Signatory.status.in_(["pending", "sent", "viewed", "identity_confirmed", "otp_verified"]),
                )
            )
            remaining = len(remaining_result.scalars().all())
            asyncio.create_task(send_signing_confirmation(creator.email, doc.title, sig.name, remaining))

            for next_sig in next_signatories:
                signing_url = f"{settings.BASE_URL}/sign/{next_sig.token}"
                asyncio.create_task(
                    send_signing_request(next_sig.email, next_sig.name, doc.title, signing_url, next_sig.role_label)
                )

    return {
        "message": "Documento assinado com sucesso.",
        "document_completed": all_signed,
    }


@router.post("/{token}/refuse")
async def refuse_signature(
    token: str,
    body: RefuseRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Refuse to sign the document."""
    _enforce_public_rate_limit(
        request,
        "sign-refuse",
        settings.PUBLIC_REFUSAL_RATE_LIMIT,
        extra=token,
    )
    sig, doc = await _get_valid_signatory(db, token)

    ip = get_client_ip(request)
    ua = get_user_agent(request)

    sig.status = "refused"
    sig.refused_at = datetime.now(timezone.utc)
    sig.refusal_reason = body.reason

    invalidate_otp(sig)

    await record_event(db, sig, "refused", ip, ua, {"reason": body.reason})
    await record_audit(
        db,
        sig,
        "signature.refused",
        ip,
        ua,
        {"signatory_name": sig.name, "reason": body.reason or ""},
    )

    doc.last_activity_at = datetime.now(timezone.utc)
    doc.status = "refused"

    await db.commit()

    creator_result = await db.execute(select(User).where(User.id == doc.created_by_id))
    creator = creator_result.scalar_one_or_none()
    if creator:
        asyncio.create_task(send_refusal_notification(creator.email, doc.title, sig.name, body.reason))

    return {"message": "Assinatura recusada."}


def _mask_email(email: str) -> str:
    """Mask email: john.doe@example.com -> j***e@example.com"""
    parts = email.split("@")
    if len(parts) != 2:
        return email
    local = parts[0]
    if len(local) <= 2:
        return f"{local[0]}***@{parts[1]}"
    return f"{local[0]}***{local[-1]}@{parts[1]}"
