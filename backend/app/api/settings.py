"""Settings API for institutional configuration, SMTP and email templates."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_admin_user
from app.config import settings
from app.models.user import User
from app.schemas.settings import (
    EmailTemplateEntry,
    EmailTemplatesResponse,
    EmailTemplatesUpdate,
    InstitutionSettingsResponse,
    InstitutionSettingsUpdate,
    PublicProfileResponse,
    SmtpSettingsResponse,
    SmtpSettingsUpdate,
    TestEmailRequest,
)
from app.services.app_settings_service import (
    load_settings_overrides,
    save_settings_overrides,
    update_settings_overrides,
)
from app.services.email_service import DEFAULT_EMAIL_TEMPLATES, get_email_templates, send_test_email
from app.services.institutional_signature_service import get_institutional_signature_info

router = APIRouter()


def _smtp_response(overrides: dict) -> SmtpSettingsResponse:
    host = overrides.get("SMTP_HOST", settings.SMTP_HOST)
    return SmtpSettingsResponse(
        smtp_host=host,
        smtp_port=overrides.get("SMTP_PORT", settings.SMTP_PORT),
        smtp_user=overrides.get("SMTP_USER", settings.SMTP_USER),
        smtp_password_set=bool(overrides.get("SMTP_PASSWORD") or settings.SMTP_PASSWORD),
        smtp_from=overrides.get("SMTP_FROM", settings.SMTP_FROM),
        smtp_from_name=overrides.get("SMTP_FROM_NAME", settings.SMTP_FROM_NAME),
        configured=bool(host),
    )


def _resolve_certificate_filename(overrides: dict) -> str | None:
    raw = overrides.get("INSTITUTIONAL_PFX_PATH") or settings.INSTITUTIONAL_PFX_PATH
    if not raw:
        return None
    return Path(raw).name


def _institution_response(overrides: dict) -> InstitutionSettingsResponse:
    certificate_filename = _resolve_certificate_filename(overrides)
    signature_name = overrides.get("INSTITUTIONAL_SIGNATURE_NAME", settings.INSTITUTIONAL_SIGNATURE_NAME)
    signature_profile = overrides.get(
        "INSTITUTIONAL_SIGNATURE_PROFILE",
        settings.INSTITUTIONAL_SIGNATURE_PROFILE,
    )
    password_set = bool(overrides.get("INSTITUTIONAL_PFX_PASSWORD") or settings.INSTITUTIONAL_PFX_PASSWORD)
    legal_entity_name = overrides.get("LEGAL_ENTITY_NAME", settings.LEGAL_ENTITY_NAME)
    legal_address = overrides.get("LEGAL_ADDRESS", settings.LEGAL_ADDRESS)
    support_email = overrides.get("SUPPORT_EMAIL", settings.SUPPORT_EMAIL)
    support_whatsapp = overrides.get("SUPPORT_WHATSAPP", settings.SUPPORT_WHATSAPP)
    support_url = overrides.get("SUPPORT_URL", settings.SUPPORT_URL)
    privacy_contact_email = overrides.get("PRIVACY_CONTACT_EMAIL", settings.PRIVACY_CONTACT_EMAIL)
    dpa_contact_email = overrides.get("DPA_CONTACT_EMAIL", settings.DPA_CONTACT_EMAIL)

    certificate_error = None
    signer_name = None
    issuer_name = None
    certificate_serial = None
    valid_until = None
    certificate_configured = False
    try:
        info = get_institutional_signature_info()
    except Exception as exc:
        certificate_error = str(exc)
    else:
        certificate_configured = info.configured
        signer_name = info.signer_name
        issuer_name = info.issuer_name
        certificate_serial = info.certificate_serial
        valid_until = info.valid_until

    return InstitutionSettingsResponse(
        certificate_configured=certificate_configured,
        certificate_uploaded=bool(certificate_filename),
        certificate_filename=certificate_filename,
        certificate_password_set=password_set,
        signature_name=signature_name,
        signature_profile=signature_profile,
        signer_name=signer_name,
        issuer_name=issuer_name,
        certificate_serial=certificate_serial,
        valid_until=valid_until,
        certificate_error=certificate_error,
        legal_entity_name=legal_entity_name,
        legal_address=legal_address,
        support_email=support_email,
        support_whatsapp=support_whatsapp,
        support_url=support_url,
        privacy_contact_email=privacy_contact_email,
        dpa_contact_email=dpa_contact_email,
    )


def _public_profile_response(overrides: dict | None = None) -> PublicProfileResponse:
    current = overrides or load_settings_overrides()
    base_url = settings.BASE_URL.rstrip("/")
    return PublicProfileResponse(
        app_name=current.get("PUBLIC_APP_NAME", settings.PUBLIC_APP_NAME),
        legal_entity_name=current.get("LEGAL_ENTITY_NAME", settings.LEGAL_ENTITY_NAME),
        legal_address=current.get("LEGAL_ADDRESS", settings.LEGAL_ADDRESS),
        support_email=current.get("SUPPORT_EMAIL", settings.SUPPORT_EMAIL),
        support_whatsapp=current.get("SUPPORT_WHATSAPP", settings.SUPPORT_WHATSAPP),
        support_url=current.get("SUPPORT_URL", settings.SUPPORT_URL),
        privacy_contact_email=current.get("PRIVACY_CONTACT_EMAIL", settings.PRIVACY_CONTACT_EMAIL),
        dpa_contact_email=current.get("DPA_CONTACT_EMAIL", settings.DPA_CONTACT_EMAIL),
        base_url=base_url,
        terms_url=f"{base_url}/terms",
        privacy_url=f"{base_url}/privacy",
        dpa_url=f"{base_url}/dpa",
        legal_terms_version=settings.LEGAL_TERMS_VERSION,
    )


@router.get("/smtp", response_model=SmtpSettingsResponse)
async def get_smtp_settings(_admin: User = Depends(get_admin_user)):
    return _smtp_response(load_settings_overrides())


@router.put("/smtp", response_model=SmtpSettingsResponse)
async def update_smtp_settings(
    body: SmtpSettingsUpdate,
    _admin: User = Depends(get_admin_user),
):
    updates = {
        "SMTP_HOST": body.smtp_host,
        "SMTP_PORT": body.smtp_port,
        "SMTP_USER": body.smtp_user,
        "SMTP_FROM": body.smtp_from,
        "SMTP_FROM_NAME": body.smtp_from_name,
    }
    if body.smtp_password:
        updates["SMTP_PASSWORD"] = body.smtp_password

    overrides = update_settings_overrides(updates)
    return _smtp_response(overrides)


@router.post("/smtp/test", status_code=status.HTTP_200_OK)
async def test_smtp(body: TestEmailRequest, _admin: User = Depends(get_admin_user)):
    if not settings.SMTP_HOST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP nao configurado. Salve as configuracoes antes de testar.",
        )
    try:
        await send_test_email(body.to)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao enviar e-mail: {exc}",
        )
    return {"message": f"E-mail de teste enviado para {body.to}."}


@router.get("/institution", response_model=InstitutionSettingsResponse)
async def get_institution_settings(_admin: User = Depends(get_admin_user)):
    return _institution_response(load_settings_overrides())


@router.get("/public-profile", response_model=PublicProfileResponse)
async def get_public_profile_settings(_admin: User = Depends(get_admin_user)):
    return _public_profile_response(load_settings_overrides())


@router.get("/public-profile/public", response_model=PublicProfileResponse)
async def get_public_profile_public():
    return _public_profile_response(load_settings_overrides())


@router.put("/institution", response_model=InstitutionSettingsResponse)
async def update_institution_settings(
    body: InstitutionSettingsUpdate,
    _admin: User = Depends(get_admin_user),
):
    updates = {
        "INSTITUTIONAL_SIGNATURE_NAME": body.signature_name.strip() or "Uptech Sign",
        "INSTITUTIONAL_SIGNATURE_PROFILE": body.signature_profile.strip() or "PAdES-B-B",
        "LEGAL_ENTITY_NAME": body.legal_entity_name.strip() or "Uptech Sign",
        "LEGAL_ADDRESS": body.legal_address.strip(),
        "SUPPORT_EMAIL": body.support_email.strip(),
        "SUPPORT_WHATSAPP": body.support_whatsapp.strip(),
        "SUPPORT_URL": body.support_url.strip(),
        "PRIVACY_CONTACT_EMAIL": body.privacy_contact_email.strip(),
        "DPA_CONTACT_EMAIL": body.dpa_contact_email.strip(),
    }
    if body.certificate_password:
        updates["INSTITUTIONAL_PFX_PASSWORD"] = body.certificate_password

    overrides = update_settings_overrides(updates)
    return _institution_response(overrides)


@router.post("/institution/certificate", response_model=InstitutionSettingsResponse)
async def upload_institution_certificate(
    file: UploadFile = File(...),
    _admin: User = Depends(get_admin_user),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pfx", ".p12"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie um certificado no formato .pfx ou .p12.",
        )

    settings.CERTIFICATES_PATH.mkdir(parents=True, exist_ok=True)
    target_name = f"institutional-certificate{suffix}"
    target_path = settings.CERTIFICATES_PATH / target_name
    target_path.write_bytes(await file.read())

    overrides = load_settings_overrides()
    overrides["INSTITUTIONAL_PFX_PATH"] = target_name
    save_settings_overrides(overrides)

    from app.services.app_settings_service import apply_runtime_overrides

    apply_runtime_overrides(overrides)
    return _institution_response(overrides)


@router.get("/email-templates", response_model=EmailTemplatesResponse)
async def get_configured_email_templates(_admin: User = Depends(get_admin_user)):
    templates = []
    configured = get_email_templates()
    for key, default_template in DEFAULT_EMAIL_TEMPLATES.items():
        item = configured[key]
        templates.append(
            EmailTemplateEntry(
                key=key,
                label=str(default_template["label"]),
                description=str(default_template["description"]),
                placeholders=list(default_template["placeholders"]),
                subject=str(item["subject"]),
                body_html=str(item["body_html"]),
            )
        )
    return EmailTemplatesResponse(templates=templates)


@router.put("/email-templates", response_model=EmailTemplatesResponse)
async def update_email_templates(
    body: EmailTemplatesUpdate,
    _admin: User = Depends(get_admin_user),
):
    current = load_settings_overrides()
    next_templates = current.get("EMAIL_TEMPLATES", {})

    for template in body.templates:
        if template.key not in DEFAULT_EMAIL_TEMPLATES:
            continue
        next_templates[template.key] = {
            "subject": template.subject,
            "body_html": template.body_html,
        }

    current["EMAIL_TEMPLATES"] = next_templates
    save_settings_overrides(current)

    from app.services.app_settings_service import apply_runtime_overrides

    apply_runtime_overrides(current)
    return await get_configured_email_templates(_admin)
