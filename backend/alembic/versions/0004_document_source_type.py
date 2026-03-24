"""add document source type

Revision ID: 0004_document_source_type
Revises: 0003
Create Date: 2026-03-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0004_document_source_type"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("source_type", sa.String(length=20), nullable=False, server_default="template"),
    )
    op.create_index(op.f("ix_documents_source_type"), "documents", ["source_type"], unique=False)

    op.execute(
        """
        UPDATE documents
        SET source_type = CASE
            WHEN template_id IS NULL THEN 'manual'
            ELSE 'template'
        END
        """
    )

    op.alter_column("documents", "source_type", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_documents_source_type"), table_name="documents")
    op.drop_column("documents", "source_type")
