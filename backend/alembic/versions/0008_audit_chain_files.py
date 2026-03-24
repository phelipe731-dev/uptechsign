"""add tamper-evident audit chain and document file versions

Revision ID: 0008_audit_chain_files
Revises: 0007_signatory_geolocation
Create Date: 2026-03-24 15:00:00.000000
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "0008_audit_chain_files"
down_revision = "0007_signatory_geolocation"
branch_labels = None
depends_on = None


def _normalize_for_hash(value):
    if isinstance(value, dict):
        return {str(key): _normalize_for_hash(value[key]) for key in sorted(value.keys(), key=str)}
    if isinstance(value, (list, tuple)):
        return [_normalize_for_hash(item) for item in value]
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    return value


def _build_chain_scope(document_id):
    return f"document:{document_id}" if document_id else "global"


def _compute_entry_hash(*, chain_scope, actor_type, actor_id, document_id, action, details, ip_address, user_agent, created_at, prev_entry_hash):
    payload = {
        "chain_scope": chain_scope,
        "actor_type": actor_type,
        "actor_id": _normalize_for_hash(actor_id),
        "document_id": _normalize_for_hash(document_id),
        "action": action,
        "details": _normalize_for_hash(details or {}),
        "ip_address": str(ip_address or ""),
        "user_agent": user_agent or "",
        "created_at": _normalize_for_hash(created_at),
        "prev_entry_hash": prev_entry_hash or "",
    }
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("chain_scope", sa.String(length=120), nullable=True))
    op.add_column("audit_logs", sa.Column("prev_entry_hash", sa.String(length=64), nullable=True))
    op.add_column("audit_logs", sa.Column("entry_hash", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_audit_logs_chain_scope"), "audit_logs", ["chain_scope"], unique=False)
    op.create_index(op.f("ix_audit_logs_entry_hash"), "audit_logs", ["entry_hash"], unique=False)

    op.add_column(
        "document_files",
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "document_files",
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("document_files", sa.Column("superseded_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_document_files_is_current"), "document_files", ["is_current"], unique=False)

    connection = op.get_bind()

    audit_logs = sa.table(
        "audit_logs",
        sa.column("id", sa.Integer()),
        sa.column("actor_type", sa.String()),
        sa.column("actor_id", postgresql.UUID(as_uuid=True)),
        sa.column("document_id", postgresql.UUID(as_uuid=True)),
        sa.column("action", sa.String()),
        sa.column("details", sa.JSON()),
        sa.column("ip_address", sa.String()),
        sa.column("user_agent", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("chain_scope", sa.String()),
        sa.column("prev_entry_hash", sa.String()),
        sa.column("entry_hash", sa.String()),
    )

    audit_rows = connection.execute(
        sa.select(
            audit_logs.c.id,
            audit_logs.c.actor_type,
            audit_logs.c.actor_id,
            audit_logs.c.document_id,
            audit_logs.c.action,
            audit_logs.c.details,
            audit_logs.c.ip_address,
            audit_logs.c.user_agent,
            audit_logs.c.created_at,
        ).order_by(audit_logs.c.created_at.asc(), audit_logs.c.id.asc())
    ).mappings().all()

    previous_hash_by_scope: dict[str, str | None] = {}
    for row in audit_rows:
        chain_scope = _build_chain_scope(row["document_id"])
        previous_hash = previous_hash_by_scope.get(chain_scope)
        entry_hash = _compute_entry_hash(
            chain_scope=chain_scope,
            actor_type=row["actor_type"],
            actor_id=row["actor_id"],
            document_id=row["document_id"],
            action=row["action"],
            details=row["details"],
            ip_address=row["ip_address"],
            user_agent=row["user_agent"],
            created_at=row["created_at"],
            prev_entry_hash=previous_hash,
        )
        connection.execute(
            sa.update(audit_logs)
            .where(audit_logs.c.id == row["id"])
            .values(
                chain_scope=chain_scope,
                prev_entry_hash=previous_hash,
                entry_hash=entry_hash,
            )
        )
        previous_hash_by_scope[chain_scope] = entry_hash

    op.alter_column("audit_logs", "chain_scope", nullable=False)
    op.alter_column("audit_logs", "entry_hash", nullable=False)

    document_files = sa.table(
        "document_files",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("document_id", postgresql.UUID(as_uuid=True)),
        sa.column("kind", sa.String()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("version_number", sa.Integer()),
        sa.column("is_current", sa.Boolean()),
        sa.column("superseded_at", sa.DateTime(timezone=True)),
    )

    file_rows = connection.execute(
        sa.select(
            document_files.c.id,
            document_files.c.document_id,
            document_files.c.kind,
            document_files.c.created_at,
        ).order_by(
            document_files.c.document_id.asc(),
            document_files.c.kind.asc(),
            document_files.c.created_at.asc(),
            document_files.c.id.asc(),
        )
    ).mappings().all()

    grouped_files: dict[tuple[str, str], list[dict]] = {}
    for row in file_rows:
        grouped_files.setdefault((row["document_id"], row["kind"]), []).append(row)

    for rows in grouped_files.values():
        for index, row in enumerate(rows, start=1):
            next_row = rows[index] if index < len(rows) else None
            connection.execute(
                sa.update(document_files)
                .where(document_files.c.id == row["id"])
                .values(
                    version_number=index,
                    is_current=next_row is None,
                    superseded_at=next_row["created_at"] if next_row else None,
                )
            )

    op.alter_column("document_files", "version_number", server_default=None)
    op.alter_column("document_files", "is_current", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_document_files_is_current"), table_name="document_files")
    op.drop_column("document_files", "superseded_at")
    op.drop_column("document_files", "is_current")
    op.drop_column("document_files", "version_number")

    op.drop_index(op.f("ix_audit_logs_entry_hash"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_chain_scope"), table_name="audit_logs")
    op.drop_column("audit_logs", "entry_hash")
    op.drop_column("audit_logs", "prev_entry_hash")
    op.drop_column("audit_logs", "chain_scope")
