"""Add signatory identity confirmation and persisted OTP fields.

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-19 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("signatories", sa.Column("phone_country_code", sa.String(length=8), nullable=True))
    op.add_column("signatories", sa.Column("phone_number", sa.String(length=20), nullable=True))
    op.add_column(
        "signatories",
        sa.Column("auth_require_email_otp", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "signatories",
        sa.Column("auth_require_full_name", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "signatories",
        sa.Column("auth_require_cpf", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("signatories", sa.Column("identity_confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signatories", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signatories", sa.Column("identity_name", sa.String(length=255), nullable=True))
    op.add_column("signatories", sa.Column("identity_email", sa.String(length=255), nullable=True))
    op.add_column("signatories", sa.Column("identity_phone_country_code", sa.String(length=8), nullable=True))
    op.add_column("signatories", sa.Column("identity_phone_number", sa.String(length=20), nullable=True))
    op.add_column("signatories", sa.Column("otp_code_hash", sa.String(length=64), nullable=True))
    op.add_column("signatories", sa.Column("otp_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("signatories", sa.Column("otp_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "signatories",
        sa.Column("otp_attempts", sa.Integer(), nullable=False, server_default="0"),
    )

    op.execute("UPDATE signatories SET auth_require_email_otp = true WHERE auth_require_email_otp IS NULL")
    op.execute("UPDATE signatories SET auth_require_full_name = true WHERE auth_require_full_name IS NULL")
    op.execute("UPDATE signatories SET auth_require_cpf = false WHERE auth_require_cpf IS NULL")
    op.execute("UPDATE signatories SET otp_attempts = 0 WHERE otp_attempts IS NULL")

    op.alter_column("signatories", "auth_require_email_otp", server_default=None)
    op.alter_column("signatories", "auth_require_full_name", server_default=None)
    op.alter_column("signatories", "auth_require_cpf", server_default=None)
    op.alter_column("signatories", "otp_attempts", server_default=None)


def downgrade() -> None:
    op.drop_column("signatories", "otp_attempts")
    op.drop_column("signatories", "otp_expires_at")
    op.drop_column("signatories", "otp_sent_at")
    op.drop_column("signatories", "otp_code_hash")
    op.drop_column("signatories", "identity_phone_number")
    op.drop_column("signatories", "identity_phone_country_code")
    op.drop_column("signatories", "identity_email")
    op.drop_column("signatories", "identity_name")
    op.drop_column("signatories", "verified_at")
    op.drop_column("signatories", "identity_confirmed_at")
    op.drop_column("signatories", "auth_require_cpf")
    op.drop_column("signatories", "auth_require_full_name")
    op.drop_column("signatories", "auth_require_email_otp")
    op.drop_column("signatories", "phone_number")
    op.drop_column("signatories", "phone_country_code")
