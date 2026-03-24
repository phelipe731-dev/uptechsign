"""SignatureEvent model - granular events during signing flow."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import INET, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, utcnow

# Events: link_opened | identity_confirmed | otp_requested | otp_verified | otp_failed | terms_accepted | signed | refused
SIGNATURE_EVENTS = [
    "link_opened",
    "identity_confirmed",
    "otp_requested",
    "otp_verified",
    "otp_failed",
    "terms_accepted",
    "signed",
    "refused",
]


class SignatureEvent(Base):
    __tablename__ = "signature_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    signatory_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("signatories.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    event: Mapped[str] = mapped_column(String(30), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    signatory = relationship("Signatory", back_populates="events")
    document = relationship("Document", back_populates="signature_events")
