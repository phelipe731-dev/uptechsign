"""Template schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class TemplateFieldDef(BaseModel):
    key: str
    label: str  # exact placeholder text in DOCX: [label]
    display_label: Optional[str] = None  # user-friendly label for the form UI
    required: bool = False
    display_order: int = 0


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    version: int
    fields: list[TemplateFieldDef] = []
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
