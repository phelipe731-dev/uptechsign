"""Add signature_fields table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-19 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "signature_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "signatory_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("signatories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("page", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("field_type", sa.String(length=20), nullable=False, server_default="signature"),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("height", sa.Float(), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("filled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_signature_fields_document_id", "signature_fields", ["document_id"])
    op.create_index("ix_signature_fields_signatory_id", "signature_fields", ["signatory_id"])

    op.alter_column("signature_fields", "page", server_default=None)
    op.alter_column("signature_fields", "field_type", server_default=None)
    op.alter_column("signature_fields", "required", server_default=None)


def downgrade() -> None:
    op.drop_table("signature_fields")
