"""add approximate sign geolocation fields

Revision ID: 0007_signatory_geolocation
Revises: 0006_terms_acceptance
Create Date: 2026-03-24 00:15:01.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0007_signatory_geolocation"
down_revision = "0006_terms_acceptance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signatories", sa.Column("sign_latitude", sa.String(length=40), nullable=True))
    op.add_column("signatories", sa.Column("sign_longitude", sa.String(length=40), nullable=True))
    op.add_column("signatories", sa.Column("sign_location_label", sa.String(length=255), nullable=True))
    op.add_column("signatories", sa.Column("sign_location_source", sa.String(length=60), nullable=True))


def downgrade() -> None:
    op.drop_column("signatories", "sign_location_source")
    op.drop_column("signatories", "sign_location_label")
    op.drop_column("signatories", "sign_longitude")
    op.drop_column("signatories", "sign_latitude")
