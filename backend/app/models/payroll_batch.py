"""Payroll batch model for bulk payslip generation."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid, utcnow

PAYROLL_BATCH_STATUSES = [
    "draft",
    "generating",
    "completed",
    "completed_with_errors",
    "failed",
]


class PayrollBatch(Base):
    __tablename__ = "payroll_batches"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("templates.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", index=True)
    csv_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    headers: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    column_mapping: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generated_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    zip_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    zip_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    template = relationship("Template")
    created_by_user = relationship("User")
    items = relationship("PayrollBatchItem", back_populates="batch", cascade="all, delete-orphan")
