"""User schemas."""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserSignatureData(BaseModel):
    default_mode: Literal["drawn", "typed"] = "drawn"
    typed_name: str = ""
    signature_image_base64: Optional[str] = None
    initials: Optional[str] = None
    updated_at: Optional[datetime] = None


class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None


class UserResponse(UserBase):
    id: UUID
    role: str
    is_active: bool
    signature_data: Optional[UserSignatureData] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserSignatureUpdate(BaseModel):
    default_mode: Literal["drawn", "typed"] = "drawn"
    typed_name: str = ""
    signature_image_base64: Optional[str] = None
    initials: Optional[str] = None
