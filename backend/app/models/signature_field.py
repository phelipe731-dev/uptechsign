"""Signature field model - positioned fields bound to a signatory."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid, utcnow

SIGNATURE_FIELD_TYPES = [
    "signature",
    "initials",
    "text",
]


class SignatureField(Base):
    __tablename__ = "signature_fields"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    document_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    signatory_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("signatories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False, default="signature")
    label: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[float] = mapped_column(Float, nullable=False)
    height: Mapped[float] = mapped_column(Float, nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    filled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    document = relationship("Document", back_populates="signature_fields")
    signatory = relationship("Signatory", back_populates="signature_fields")
