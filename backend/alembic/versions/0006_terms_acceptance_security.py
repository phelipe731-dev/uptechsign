"""add signatory terms acceptance metadata

Revision ID: 0006_terms_acceptance
Revises: 0005_user_signature_verification
Create Date: 2026-03-24 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0006_terms_acceptance"
down_revision = "0005_user_signature_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signatories", sa.Column("accepted_terms_version", sa.String(length=40), nullable=True))
    op.add_column("signatories", sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signatories", sa.Column("terms_accepted_ip", postgresql.INET(), nullable=True))
    op.add_column("signatories", sa.Column("terms_accepted_user_agent", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("signatories", "terms_accepted_user_agent")
    op.drop_column("signatories", "terms_accepted_ip")
    op.drop_column("signatories", "terms_accepted_at")
    op.drop_column("signatories", "accepted_terms_version")
