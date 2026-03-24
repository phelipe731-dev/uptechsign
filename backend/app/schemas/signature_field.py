"""Signature field schemas."""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


FieldType = Literal["signature", "initials", "text"]


class SignatureFieldCreate(BaseModel):
    signatory_id: UUID
    page: int = Field(default=1, ge=1)
    field_type: FieldType = "signature"
    label: Optional[str] = None
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)
    required: bool = True


class SignatureFieldUpdate(BaseModel):
    signatory_id: Optional[UUID] = None
    page: Optional[int] = Field(default=None, ge=1)
    field_type: Optional[FieldType] = None
    label: Optional[str] = None
    x: Optional[float] = Field(default=None, ge=0, le=1)
    y: Optional[float] = Field(default=None, ge=0, le=1)
    width: Optional[float] = Field(default=None, gt=0, le=1)
    height: Optional[float] = Field(default=None, gt=0, le=1)
    required: Optional[bool] = None
    value: Optional[str] = None


class SignatureFieldResponse(BaseModel):
    id: UUID
    document_id: UUID
    signatory_id: UUID
    page: int
    field_type: FieldType
    label: Optional[str] = None
    x: float
    y: float
    width: float
    height: float
    required: bool
    value: Optional[str] = None
    filled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PublicSignatureFieldResponse(BaseModel):
    id: UUID
    page: int
    field_type: FieldType
    label: Optional[str] = None
    x: float
    y: float
    width: float
    height: float
    required: bool
    value: Optional[str] = None

    model_config = {"from_attributes": True}
