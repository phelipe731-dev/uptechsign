"""Document schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    template_id: UUID
    title: str
    field_data: dict


class DocumentFileResponse(BaseModel):
    id: UUID
    kind: str
    sha256: str
    version_number: int
    is_current: bool
    superseded_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: UUID
    title: str
    template_id: Optional[UUID] = None
    template_name: Optional[str] = None
    verification_code: str
    source_type: str = "template"
    status: str
    field_data: dict
    created_by_id: Optional[UUID] = None
    current_signing_order: int = 0
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    signatories_count: int = 0
    signed_signatories_count: int = 0
    pending_signatories_count: int = 0
    files: list[DocumentFileResponse] = []

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    id: UUID
    title: str
    status: str
    template_id: Optional[UUID] = None
    template_name: Optional[str] = None
    verification_code: str
    source_type: str = "template"
    created_at: datetime
    last_activity_at: Optional[datetime] = None
    signatories_count: int = 0
    signed_signatories_count: int = 0

    model_config = {"from_attributes": True}


class PaginatedDocuments(BaseModel):
    items: list[DocumentListResponse]
    total: int
    page: int
    per_page: int
