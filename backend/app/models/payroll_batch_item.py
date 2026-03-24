"""Individual row/item inside a payroll batch."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid, utcnow

PAYROLL_BATCH_ITEM_STATUSES = [
    "pending",
    "generated",
    "failed",
]


class PayrollBatchItem(Base):
    __tablename__ = "payroll_batch_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    batch_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payroll_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    employee_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", index=True)
    row_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    field_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    pdf_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    pdf_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    batch = relationship("PayrollBatch", back_populates="items")
