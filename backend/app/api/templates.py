"""Templates API — CRUD + DOCX upload + field auto-detection."""

import re
import uuid as _uuid
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user, get_current_user
from app.config import settings
from app.database import get_db
from app.models.template import Template
from app.models.user import User
from app.schemas.template import TemplateResponse
from app.services.document_generator import label_to_key, parse_template_placeholders

router = APIRouter()


def _slug_from_name(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug.strip())
    return slug[:100] or "template"


def _ensure_unique_slug(base: str, existing_slugs: set[str]) -> str:
    slug = base
    i = 2
    while slug in existing_slugs:
        slug = f"{base}-{i}"
        i += 1
    return slug


@router.get("/", response_model=list[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Template).where(Template.is_active == True).order_by(Template.name)
    )
    return result.scalars().all()


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Template).where(Template.id == template_id, Template.is_active == True)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template não encontrado.")
    return tpl


@router.get("/{template_id}/detect-fields")
async def detect_template_fields(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Re-parse a template's DOCX and return detected placeholder labels."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template não encontrado.")

    docx_path = settings.TEMPLATES_PATH / tpl.file_path
    if not docx_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo DOCX não encontrado.")

    labels = parse_template_placeholders(str(docx_path))
    detected = [
        {"label": label, "suggested_key": label_to_key(label), "display_order": i + 1}
        for i, label in enumerate(labels)
    ]
    return {"detected": detected}


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Upload a new DOCX template and auto-detect its fields."""
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas arquivos .docx são aceitos.",
        )

    # Generate unique slug
    result = await db.execute(select(Template.slug))
    existing_slugs = set(result.scalars().all())
    base_slug = _slug_from_name(name)
    slug = _ensure_unique_slug(base_slug, existing_slugs)

    # Save file to templates directory
    filename = f"{slug}.docx"
    dest_path = settings.TEMPLATES_PATH / filename
    if dest_path.exists():
        filename = f"{slug}-{_uuid.uuid4().hex[:8]}.docx"
        dest_path = settings.TEMPLATES_PATH / filename

    try:
        content = await file.read()
        dest_path.write_bytes(content)
    except OSError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao salvar arquivo: {e}",
        )

    # Auto-detect fields
    try:
        labels = parse_template_placeholders(str(dest_path))
    except Exception:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Arquivo DOCX inválido ou corrompido.",
        )

    fields = [
        {
            "key": label_to_key(label),
            "label": label,
            "required": False,
            "display_order": i + 1,
        }
        for i, label in enumerate(labels)
    ]

    tpl = Template(
        name=name,
        slug=slug,
        description=description or None,
        file_path=filename,
        version=1,
        fields=fields,
        is_active=True,
        created_by_id=admin.id,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template_fields(
    template_id: UUID,
    name: str = Form(...),
    description: str = Form(""),
    fields_json: str = Form(..., alias="fields"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Update template name, description, and field definitions."""
    import json as _json

    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template não encontrado.")

    try:
        fields = _json.loads(fields_json)
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="JSON de campos inválido.")

    tpl.name = name
    tpl.description = description or None
    tpl.fields = fields

    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.put("/{template_id}/file", response_model=TemplateResponse)
async def replace_template_file(
    template_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Replace the DOCX file and re-detect fields."""
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas arquivos .docx são aceitos.",
        )

    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template não encontrado.")

    dest_path = settings.TEMPLATES_PATH / tpl.file_path
    content = await file.read()
    dest_path.write_bytes(content)

    try:
        labels = parse_template_placeholders(str(dest_path))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Arquivo DOCX inválido ou corrompido.",
        )

    tpl.fields = [
        {
            "key": label_to_key(label),
            "label": label,
            "required": False,
            "display_order": i + 1,
        }
        for i, label in enumerate(labels)
    ]
    tpl.version = (tpl.version or 1) + 1

    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Soft-delete a template (sets is_active=False)."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template não encontrado.")

    tpl.is_active = False
    await db.commit()
