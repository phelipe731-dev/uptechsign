"""Signatory model - people who need to sign a document."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import INET, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid, utcnow

# Status: pending | sent | viewed | identity_confirmed | otp_verified | signed | refused
SIGNATORY_STATUSES = [
    "pending",
    "sent",
    "viewed",
    "identity_confirmed",
    "otp_verified",
    "signed",
    "refused",
]


class Signatory(Base):
    __tablename__ = "signatories"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    document_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    cpf: Mapped[Optional[str]] = mapped_column(String(14), nullable=True)
    phone_country_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    role_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    signing_order: Mapped[int] = mapped_column(Integer, default=0)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    auth_method: Mapped[str] = mapped_column(String(30), nullable=False, default="otp_email")
    auth_require_email_otp: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    auth_require_full_name: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    auth_require_cpf: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    # Timestamps
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    viewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    identity_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    refused_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    refusal_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Confirmed identity details
    identity_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    identity_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    identity_phone_country_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    identity_phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    accepted_terms_version: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    terms_accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    terms_accepted_ip: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    terms_accepted_user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # OTP challenge metadata
    otp_code_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    otp_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    otp_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    otp_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Signature data
    signature_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    sign_latitude: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    sign_longitude: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    sign_location_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sign_location_source: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    ip_address_at_sign: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    user_agent_at_sign: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    document = relationship("Document", back_populates="signatories")
    signature_fields = relationship("SignatureField", back_populates="signatory", cascade="all, delete-orphan")
    events = relationship("SignatureEvent", back_populates="signatory", cascade="all, delete-orphan")
