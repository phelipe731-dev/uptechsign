"""Tamper-evident audit trail helpers."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


def build_audit_chain_scope(document_id: str | UUID | None) -> str:
    if document_id:
        return f"document:{document_id}"
    return "global"


def _normalize_for_hash(value: Any) -> Any:
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
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def compute_audit_entry_hash(
    *,
    chain_scope: str,
    actor_type: str,
    actor_id: str | UUID | None,
    document_id: str | UUID | None,
    action: str,
    details: dict[str, Any] | None,
    ip_address: str | None,
    user_agent: str | None,
    created_at: datetime,
    prev_entry_hash: str | None,
) -> str:
    payload = {
        "chain_scope": chain_scope,
        "actor_type": actor_type,
        "actor_id": _normalize_for_hash(actor_id),
        "document_id": _normalize_for_hash(document_id),
        "action": action,
        "details": _normalize_for_hash(details or {}),
        "ip_address": ip_address or "",
        "user_agent": user_agent or "",
        "created_at": _normalize_for_hash(created_at),
        "prev_entry_hash": prev_entry_hash or "",
    }
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


async def append_audit_log(
    db: AsyncSession,
    *,
    actor_type: str,
    action: str,
    actor_id: str | UUID | None = None,
    document_id: str | UUID | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    created_at: datetime | None = None,
    chain_scope_override: str | None = None,
) -> AuditLog:
    chain_scope = chain_scope_override or build_audit_chain_scope(document_id)
    previous_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.chain_scope == chain_scope)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(1)
    )
    previous_entry = previous_result.scalar_one_or_none()
    previous_hash = previous_entry.entry_hash if previous_entry else None

    log_created_at = created_at or datetime.now(timezone.utc)
    entry_hash = compute_audit_entry_hash(
        chain_scope=chain_scope,
        actor_type=actor_type,
        actor_id=actor_id,
        document_id=document_id,
        action=action,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=log_created_at,
        prev_entry_hash=previous_hash,
    )
    audit = AuditLog(
        actor_type=actor_type,
        actor_id=actor_id,
        document_id=document_id,
        chain_scope=chain_scope,
        action=action,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        prev_entry_hash=previous_hash,
        entry_hash=entry_hash,
        created_at=log_created_at,
    )
    db.add(audit)
    await db.flush()
    return audit


def verify_audit_chain(logs: list[AuditLog]) -> dict[int, bool]:
    previous_hash_by_scope: dict[str, str | None] = {}
    verification: dict[int, bool] = {}

    for log in sorted(logs, key=lambda item: (item.chain_scope, item.created_at, item.id)):
        expected_prev = previous_hash_by_scope.get(log.chain_scope)
        expected_hash = compute_audit_entry_hash(
            chain_scope=log.chain_scope,
            actor_type=log.actor_type,
            actor_id=log.actor_id,
            document_id=log.document_id,
            action=log.action,
            details=log.details,
            ip_address=str(log.ip_address) if log.ip_address else None,
            user_agent=log.user_agent,
            created_at=log.created_at,
            prev_entry_hash=expected_prev,
        )
        is_valid = log.prev_entry_hash == expected_prev and log.entry_hash == expected_hash
        verification[log.id] = is_valid
        previous_hash_by_scope[log.chain_scope] = log.entry_hash

    return verification
