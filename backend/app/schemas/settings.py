"""Schemas for runtime-configurable institution settings."""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SmtpSettingsUpdate(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_from_name: str = ""


class SmtpSettingsResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password_set: bool
    smtp_from: str
    smtp_from_name: str
    configured: bool


class TestEmailRequest(BaseModel):
    to: EmailStr


class InstitutionSettingsUpdate(BaseModel):
    signature_name: str = "Uptech Sign"
    signature_profile: str = "PAdES-B-B"
    certificate_password: str = ""
    legal_entity_name: str = "Uptech Sign"
    legal_address: str = ""
    support_email: str = ""
    support_whatsapp: str = ""
    support_url: str = ""
    privacy_contact_email: str = ""
    dpa_contact_email: str = ""


class InstitutionSettingsResponse(BaseModel):
    certificate_configured: bool
    certificate_uploaded: bool
    certificate_filename: Optional[str] = None
    certificate_password_set: bool
    signature_name: str
    signature_profile: str
    signer_name: Optional[str] = None
    issuer_name: Optional[str] = None
    certificate_serial: Optional[str] = None
    valid_until: Optional[str] = None
    certificate_error: Optional[str] = None
    legal_entity_name: str
    legal_address: str
    support_email: str
    support_whatsapp: str
    support_url: str
    privacy_contact_email: str
    dpa_contact_email: str


class PublicProfileResponse(BaseModel):
    app_name: str
    legal_entity_name: str
    legal_address: str
    support_email: str
    support_whatsapp: str
    support_url: str
    privacy_contact_email: str
    dpa_contact_email: str
    base_url: str
    terms_url: str
    privacy_url: str
    dpa_url: str
    legal_terms_version: str


class EmailTemplateEntry(BaseModel):
    key: str
    label: str
    description: str
    placeholders: list[str] = Field(default_factory=list)
    subject: str
    body_html: str


class EmailTemplatesResponse(BaseModel):
    templates: list[EmailTemplateEntry] = Field(default_factory=list)


class EmailTemplatesUpdate(BaseModel):
    templates: list[EmailTemplateEntry] = Field(default_factory=list)
