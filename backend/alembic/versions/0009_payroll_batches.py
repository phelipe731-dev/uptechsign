"""add payroll batch tables

Revision ID: 0009_payroll_batches
Revises: 0008_audit_chain_files
Create Date: 2026-03-24 18:30:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0009_payroll_batches"
down_revision = "0008_audit_chain_files"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payroll_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("csv_filename", sa.String(length=255), nullable=True),
        sa.Column("headers", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("column_mapping", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("generated_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("zip_path", sa.String(length=500), nullable=True),
        sa.Column("zip_sha256", sa.String(length=64), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payroll_batches_created_by_id"), "payroll_batches", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_payroll_batches_created_at"), "payroll_batches", ["created_at"], unique=False)
    op.create_index(op.f("ix_payroll_batches_status"), "payroll_batches", ["status"], unique=False)
    op.create_index(op.f("ix_payroll_batches_template_id"), "payroll_batches", ["template_id"], unique=False)

    op.create_table(
        "payroll_batch_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("employee_label", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("row_data", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("field_data", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("pdf_path", sa.String(length=500), nullable=True),
        sa.Column("pdf_sha256", sa.String(length=64), nullable=True),
        sa.Column("pdf_filename", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["payroll_batches.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payroll_batch_items_batch_id"), "payroll_batch_items", ["batch_id"], unique=False)
    op.create_index(op.f("ix_payroll_batch_items_status"), "payroll_batch_items", ["status"], unique=False)

    op.alter_column("payroll_batches", "status", server_default=None)
    op.alter_column("payroll_batches", "headers", server_default=None)
    op.alter_column("payroll_batches", "column_mapping", server_default=None)
    op.alter_column("payroll_batches", "total_rows", server_default=None)
    op.alter_column("payroll_batches", "generated_rows", server_default=None)
    op.alter_column("payroll_batches", "failed_rows", server_default=None)
    op.alter_column("payroll_batch_items", "status", server_default=None)
    op.alter_column("payroll_batch_items", "row_data", server_default=None)
    op.alter_column("payroll_batch_items", "field_data", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_payroll_batch_items_status"), table_name="payroll_batch_items")
    op.drop_index(op.f("ix_payroll_batch_items_batch_id"), table_name="payroll_batch_items")
    op.drop_table("payroll_batch_items")

    op.drop_index(op.f("ix_payroll_batches_template_id"), table_name="payroll_batches")
    op.drop_index(op.f("ix_payroll_batches_status"), table_name="payroll_batches")
    op.drop_index(op.f("ix_payroll_batches_created_at"), table_name="payroll_batches")
    op.drop_index(op.f("ix_payroll_batches_created_by_id"), table_name="payroll_batches")
    op.drop_table("payroll_batches")
