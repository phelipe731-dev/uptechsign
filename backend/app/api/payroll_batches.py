"""API routes for payroll batches and bulk payslip generation."""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.payroll_batch import PayrollBatch
from app.models.payroll_batch_item import PayrollBatchItem
from app.models.template import Template
from app.models.user import User
from app.schemas.payroll import (
    PayrollBatchGenerateResponse,
    PayrollBatchImportResponse,
    PayrollBatchListItemResponse,
    PayrollBatchMappingUpdate,
    PayrollBatchResponse,
)
from app.services.audit_service import append_audit_log
from app.services.payroll_batch_service import (
    create_payroll_batch_from_csv,
    generate_payroll_batch_files,
    payroll_chain_scope,
    preview_items,
    update_payroll_batch_mapping,
)
from app.utils.file_storage import resolve_path

router = APIRouter()


def _serialize_batch_summary(batch: PayrollBatch) -> dict:
    return {
        "id": batch.id,
        "name": batch.name,
        "template_id": batch.template_id,
        "template_name": batch.template.name if batch.template else None,
        "status": batch.status,
        "total_rows": batch.total_rows,
        "generated_rows": batch.generated_rows,
        "failed_rows": batch.failed_rows,
        "created_at": batch.created_at,
        "updated_at": batch.updated_at,
        "completed_at": batch.completed_at,
        "zip_ready": bool(batch.zip_path),
    }


def _serialize_item(item: PayrollBatchItem) -> dict:
    return {
        "id": item.id,
        "row_number": item.row_number,
        "employee_label": item.employee_label,
        "status": item.status,
        "row_data": item.row_data or {},
        "field_data": item.field_data or {},
        "pdf_filename": item.pdf_filename,
        "error_message": item.error_message,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _serialize_batch_detail(batch: PayrollBatch) -> dict:
    items = sorted(list(batch.items or []), key=lambda item: item.row_number)
    preview, truncated = preview_items(items)
    return {
        "id": batch.id,
        "name": batch.name,
        "template_id": batch.template_id,
        "template_name": batch.template.name if batch.template else None,
        "status": batch.status,
        "csv_filename": batch.csv_filename,
        "headers": batch.headers or [],
        "column_mapping": batch.column_mapping or {},
        "total_rows": batch.total_rows,
        "generated_rows": batch.generated_rows,
        "failed_rows": batch.failed_rows,
        "zip_sha256": batch.zip_sha256,
        "last_error": batch.last_error,
        "created_at": batch.created_at,
        "updated_at": batch.updated_at,
        "completed_at": batch.completed_at,
        "template_fields": batch.template.fields if batch.template and batch.template.fields else [],
        "preview_items": [_serialize_item(item) for item in preview],
        "preview_truncated": truncated,
        "zip_ready": bool(batch.zip_path),
    }


async def _load_batch(db: AsyncSession, batch_id: UUID | str) -> PayrollBatch | None:
    result = await db.execute(
        select(PayrollBatch)
        .where(PayrollBatch.id == batch_id)
        .options(
            selectinload(PayrollBatch.template),
            selectinload(PayrollBatch.items),
        )
    )
    return result.scalar_one_or_none()


@router.get("/", response_model=list[PayrollBatchListItemResponse])
async def list_payroll_batches(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PayrollBatch)
        .options(selectinload(PayrollBatch.template))
        .order_by(PayrollBatch.created_at.desc())
    )
    return [_serialize_batch_summary(batch) for batch in result.scalars().all()]


@router.get("/{batch_id}", response_model=PayrollBatchResponse)
async def get_payroll_batch(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    batch = await _load_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote nao encontrado.")
    return _serialize_batch_detail(batch)


@router.post("/import", response_model=PayrollBatchImportResponse, status_code=status.HTTP_201_CREATED)
async def import_payroll_batch(
    name: str = Form(...),
    template_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome do lote.")
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo CSV.")

    template_result = await db.execute(
        select(Template).where(Template.id == template_id, Template.is_active == True)
    )
    template = template_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template nao encontrado.")

    content = await file.read()
    try:
        batch = await create_payroll_batch_from_csv(
            db,
            name=name,
            template=template,
            csv_filename=file.filename,
            csv_content=content,
            created_by_id=user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        action="payroll_batch.imported",
        details={
            "batch_id": str(batch.id),
            "batch_name": batch.name,
            "template_id": str(template.id),
            "template_name": template.name,
            "csv_filename": file.filename,
            "total_rows": batch.total_rows,
        },
        chain_scope_override=payroll_chain_scope(str(batch.id)),
    )
    await db.commit()

    fresh_batch = await _load_batch(db, batch.id)
    if not fresh_batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote nao encontrado.")
    return {"batch": _serialize_batch_detail(fresh_batch)}


@router.post("/{batch_id}/mapping", response_model=PayrollBatchResponse)
async def save_payroll_batch_mapping(
    batch_id: UUID,
    body: PayrollBatchMappingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = await _load_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote nao encontrado.")
    if not batch.template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template do lote nao encontrado.")

    try:
        batch = await update_payroll_batch_mapping(
            db,
            batch=batch,
            template=batch.template,
            column_mapping=body.column_mapping,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        action="payroll_batch.mapping_updated",
        details={
            "batch_id": str(batch.id),
            "mapped_fields": len([value for value in (batch.column_mapping or {}).values() if value]),
        },
        chain_scope_override=payroll_chain_scope(str(batch.id)),
    )
    await db.commit()

    fresh_batch = await _load_batch(db, batch.id)
    if not fresh_batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote nao encontrado.")
    return _serialize_batch_detail(fresh_batch)


@router.post("/{batch_id}/generate", response_model=PayrollBatchGenerateResponse)
async def generate_payroll_batch(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = await _load_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote nao encontrado.")
    if not batch.template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template do lote nao encontrado.")

    try:
        batch = await generate_payroll_batch_files(db, batch=batch, template=batch.template)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        batch.status = "failed"
        batch.last_error = str(exc)
        await db.flush()
        await append_audit_log(
            db,
            actor_type="user",
            actor_id=user.id,
            action="payroll_batch.generation_failed",
            details={"batch_id": str(batch.id), "error": str(exc)},
            chain_scope_override=payroll_chain_scope(str(batch.id)),
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        action="payroll_batch.generated",
        details={
            "batch_id": str(batch.id),
            "generated_rows": batch.generated_rows,
            "failed_rows": batch.failed_rows,
            "status": batch.status,
            "zip_ready": bool(batch.zip_path),
        },
        chain_scope_override=payroll_chain_scope(str(batch.id)),
    )
    await db.commit()

    fresh_batch = await _load_batch(db, batch.id)
    if not fresh_batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote nao encontrado.")
    return {
        "batch": _serialize_batch_detail(fresh_batch),
        "message": "Lote de holerites gerado com sucesso.",
    }


@router.get("/{batch_id}/download")
async def download_payroll_batch_zip(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    batch = await _load_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote nao encontrado.")
    if not batch.zip_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ZIP do lote ainda nao foi gerado.")

    zip_path = resolve_path(batch.zip_path)
    if not zip_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo ZIP nao encontrado.")

    await append_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        action="payroll_batch.downloaded",
        details={"batch_id": str(batch.id), "filename": Path(zip_path).name},
        chain_scope_override=payroll_chain_scope(str(batch.id)),
    )
    await db.commit()

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=Path(zip_path).name,
    )
