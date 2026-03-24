"""add user signature profile and document verification code

Revision ID: 0005_user_signature_verification
Revises: 0004_document_source_type
Create Date: 2026-03-19 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005_user_signature_verification"
down_revision = "0004_document_source_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("signature_data", sa.JSON(), nullable=True))
    op.add_column(
        "documents",
        sa.Column("verification_code", sa.String(length=64), nullable=True),
    )
    op.execute(
        """
        UPDATE documents
        SET verification_code = substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 24)
        WHERE verification_code IS NULL
        """
    )
    op.alter_column("documents", "verification_code", nullable=False)
    op.create_index(op.f("ix_documents_verification_code"), "documents", ["verification_code"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_documents_verification_code"), table_name="documents")
    op.drop_column("documents", "verification_code")
    op.drop_column("users", "signature_data")
