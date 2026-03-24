"""Signatory schemas."""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.schemas.signature_field import PublicSignatureFieldResponse


class SignatoryCreate(BaseModel):
    name: str
    email: EmailStr
    cpf: Optional[str] = None
    phone_country_code: Optional[str] = None
    phone_number: Optional[str] = None
    role_label: Optional[str] = None
    signing_order: int = Field(default=0, ge=0)
    auth_method: str = "otp_email"
    auth_require_email_otp: bool = True
    auth_require_full_name: bool = True
    auth_require_cpf: bool = False

    @model_validator(mode="after")
    def validate_auth_requirements(self) -> "SignatoryCreate":
        if self.auth_require_cpf and not self.cpf:
            raise ValueError("Informe o CPF quando a validacao por CPF estiver habilitada.")
        return self


class SignatoryUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    cpf: Optional[str] = None
    phone_country_code: Optional[str] = None
    phone_number: Optional[str] = None
    role_label: Optional[str] = None
    signing_order: Optional[int] = Field(default=None, ge=0)
    auth_method: Optional[str] = None
    auth_require_email_otp: Optional[bool] = None
    auth_require_full_name: Optional[bool] = None
    auth_require_cpf: Optional[bool] = None


class SignatoryResponse(BaseModel):
    id: UUID
    name: str
    email: str
    cpf: Optional[str] = None
    phone_country_code: Optional[str] = None
    phone_number: Optional[str] = None
    role_label: Optional[str] = None
    signing_order: int
    token: str
    status: str
    auth_method: str
    auth_require_email_otp: bool
    auth_require_full_name: bool
    auth_require_cpf: bool
    sent_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    identity_confirmed_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    signed_at: Optional[datetime] = None
    refused_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SendRequest(BaseModel):
    signatories: list[SignatoryCreate] = Field(default_factory=list)


class IdentityConfirmRequest(BaseModel):
    full_name: str
    email: EmailStr
    cpf: Optional[str] = None
    phone_country_code: Optional[str] = None
    phone_number: Optional[str] = None


class SignRequest(BaseModel):
    typed_name: str
    signature_mode: Literal["drawn", "typed"] = "drawn"
    signature_image_base64: Optional[str] = None
    selfie_image_base64: Optional[str] = None
    field_values: dict[str, str] = Field(default_factory=dict)
    accept_terms: bool = False

    @model_validator(mode="after")
    def validate_signature_payload(self) -> "SignRequest":
        if not self.typed_name.strip():
            raise ValueError("Informe o nome da assinatura.")
        if self.signature_mode == "drawn" and not self.signature_image_base64:
            raise ValueError("Desenhe a assinatura para continuar.")
        if self.selfie_image_base64 and len(self.selfie_image_base64) > 6_000_000:
            raise ValueError("A selfie enviada esta muito grande. Tente novamente com uma imagem menor.")
        if not self.accept_terms:
            raise ValueError("Aceite os termos antes de concluir a assinatura.")
        return self


class RefuseRequest(BaseModel):
    reason: Optional[str] = None


class OtpVerifyRequest(BaseModel):
    code: str


class PublicDocumentInfo(BaseModel):
    document_title: str
    signatory_name: str
    signatory_role: Optional[str] = None
    status: str
    identity_confirmed: bool
    requires_otp: bool
    require_full_name: bool
    require_email: bool
    require_cpf: bool
    terms_version: str
    terms_summary: str
    fields: list[PublicSignatureFieldResponse] = []
