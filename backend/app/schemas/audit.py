"""Audit log schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    actor_type: str
    actor_id: Optional[UUID] = None
    actor_label: Optional[str] = None
    document_id: Optional[UUID] = None
    document_title: Optional[str] = None
    action: str
    details: Optional[dict] = None
    chain_scope: str
    prev_entry_hash: Optional[str] = None
    entry_hash: str
    chain_ok: Optional[bool] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
