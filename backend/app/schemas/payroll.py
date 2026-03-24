"""Schemas for payroll batch generation."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.template import TemplateFieldDef


class PayrollBatchItemResponse(BaseModel):
    id: UUID
    row_number: int
    employee_label: Optional[str] = None
    status: str
    row_data: dict = Field(default_factory=dict)
    field_data: dict = Field(default_factory=dict)
    pdf_filename: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PayrollBatchListItemResponse(BaseModel):
    id: UUID
    name: str
    template_id: UUID
    template_name: Optional[str] = None
    status: str
    total_rows: int
    generated_rows: int
    failed_rows: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    zip_ready: bool = False

    model_config = {"from_attributes": True}


class PayrollBatchResponse(BaseModel):
    id: UUID
    name: str
    template_id: UUID
    template_name: Optional[str] = None
    status: str
    csv_filename: Optional[str] = None
    headers: list[str] = Field(default_factory=list)
    column_mapping: dict = Field(default_factory=dict)
    total_rows: int
    generated_rows: int
    failed_rows: int
    zip_sha256: Optional[str] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    template_fields: list[TemplateFieldDef] = Field(default_factory=list)
    preview_items: list[PayrollBatchItemResponse] = Field(default_factory=list)
    preview_truncated: bool = False
    zip_ready: bool = False

    model_config = {"from_attributes": True}


class PayrollBatchImportResponse(BaseModel):
    batch: PayrollBatchResponse


class PayrollBatchMappingUpdate(BaseModel):
    column_mapping: dict[str, str]


class PayrollBatchGenerateResponse(BaseModel):
    batch: PayrollBatchResponse
    message: str
