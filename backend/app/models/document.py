"""Document model - generated document instances."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid, utcnow
from app.utils.security import generate_verification_code

# Status: generated | sent | in_signing | completed | refused | expired | cancelled
DOCUMENT_STATUSES = [
    "generated",
    "sent",
    "in_signing",
    "completed",
    "refused",
    "expired",
    "cancelled",
]

DOCUMENT_SOURCE_TYPES = ["template", "manual"]


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    template_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("templates.id"), nullable=True)
    verification_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True, default=generate_verification_code)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="template", index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="generated", index=True)
    field_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    current_signing_order: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_activity_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    template = relationship("Template", back_populates="documents")
    created_by_user = relationship("User", back_populates="documents")
    files = relationship("DocumentFile", back_populates="document", cascade="all, delete-orphan")
    signatories = relationship("Signatory", back_populates="document", cascade="all, delete-orphan")
    signature_fields = relationship("SignatureField", back_populates="document", cascade="all, delete-orphan")
    signature_events = relationship("SignatureEvent", back_populates="document", cascade="all, delete-orphan")
