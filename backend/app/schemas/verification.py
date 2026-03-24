"""Public verification schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class VerificationFileResponse(BaseModel):
    id: UUID
    kind: str
    label: str
    sha256: str
    created_at: datetime
    download_url: str


class VerificationSignatoryResponse(BaseModel):
    id: UUID
    name: str
    email: str
    cpf: Optional[str] = None
    role_label: Optional[str] = None
    status: str
    signing_order: int
    auth_method: str
    auth_require_email_otp: bool
    viewed_at: Optional[datetime] = None
    identity_name: Optional[str] = None
    identity_email: Optional[str] = None
    identity_phone: Optional[str] = None
    identity_confirmed_at: Optional[datetime] = None
    otp_sent_at: Optional[datetime] = None
    otp_verified_at: Optional[datetime] = None
    terms_accepted_at: Optional[datetime] = None
    accepted_terms_version: Optional[str] = None
    signed_at: Optional[datetime] = None
    refused_at: Optional[datetime] = None
    signature_mode: Optional[str] = None
    selfie_captured: bool = False
    ip_address_at_sign: Optional[str] = None
    user_agent_at_sign: Optional[str] = None


class VerificationIntegrityResponse(BaseModel):
    configured: bool
    signer_name: Optional[str] = None
    issuer_name: Optional[str] = None
    certificate_serial: Optional[str] = None
    valid_until: Optional[str] = None
    profile: Optional[str] = None


class PublicVerificationResponse(BaseModel):
    document_id: UUID
    document_title: str
    status: str
    source_type: str
    verification_code: str
    verification_url: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    signatories_count: int
    signed_signatories_count: int
    public_data_masked: bool = True
    integrity: VerificationIntegrityResponse
    hashes: list[VerificationFileResponse] = []
    signatories: list[VerificationSignatoryResponse] = []
