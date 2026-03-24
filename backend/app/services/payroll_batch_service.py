"""Services for payroll batch CSV import and bulk PDF generation."""

from __future__ import annotations

import csv
import re
import shutil
import unicodedata
import zipfile
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.payroll_batch import PayrollBatch
from app.models.payroll_batch_item import PayrollBatchItem
from app.models.template import Template
from app.services.document_generator import generate_document
from app.utils.file_storage import payroll_batch_dir, relative_path
from app.utils.security import sha256_file

PREVIEW_LIMIT = 12


def payroll_chain_scope(batch_id: str) -> str:
    return f"payroll-batch:{batch_id}"


def _normalize_token(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", normalized.strip().lower())
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized


def decode_csv_content(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("Nao foi possivel ler o CSV. Salve o arquivo em UTF-8 ou Latin-1.")


def parse_csv_rows(content: bytes) -> tuple[list[str], list[dict[str, str]]]:
    text = decode_csv_content(content)
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise ValueError("CSV sem cabecalho. A primeira linha deve conter os nomes das colunas.")

    header_pairs = [
        (str(original or ""), str(original or "").strip())
        for original in reader.fieldnames
        if str(original or "").strip()
    ]
    headers = [clean for _, clean in header_pairs]
    if not headers:
        raise ValueError("CSV sem colunas validas.")

    rows: list[dict[str, str]] = []
    for row in reader:
        cleaned = {
            clean_header: str((row or {}).get(original_header, "") or "").strip()
            for original_header, clean_header in header_pairs
        }
        if any(value for value in cleaned.values()):
            rows.append(cleaned)
    return headers, rows


def build_default_mapping(template_fields: list[dict], headers: list[str]) -> dict[str, str]:
    normalized_headers = {_normalize_token(header): header for header in headers}
    mapping: dict[str, str] = {}

    for field in template_fields:
        candidates = [
            field.get("key"),
            field.get("label"),
            field.get("display_label"),
        ]
        selected = ""
        for candidate in candidates:
            token = _normalize_token(str(candidate or ""))
            if token and token in normalized_headers:
                selected = normalized_headers[token]
                break
        mapping[str(field.get("key"))] = selected
    return mapping


def map_row_to_field_data(
    row_data: dict[str, str],
    column_mapping: dict[str, str],
    template_fields: list[dict],
) -> dict[str, str]:
    field_data: dict[str, str] = {}
    for field in template_fields:
        key = str(field.get("key"))
        column = column_mapping.get(key, "")
        field_data[key] = row_data.get(column, "").strip() if column else ""
    return field_data


def infer_employee_label(row_data: dict[str, str], field_data: dict[str, str]) -> str | None:
    preferred_keys = [
        "nome",
        "nome_colaborador",
        "nome_funcionario",
        "colaborador",
        "funcionario",
        "employee_name",
        "employee",
    ]
    for key in preferred_keys:
        value = field_data.get(key) or row_data.get(key) or row_data.get(key.upper())
        if value:
            return value.strip()

    for source in (field_data, row_data):
        for candidate_key, candidate_value in source.items():
            token = _normalize_token(candidate_key)
            if token in preferred_keys and candidate_value:
                return candidate_value.strip()

    for candidate_value in row_data.values():
        if candidate_value:
            return candidate_value.strip()
    return None


def refresh_batch_item_mappings(
    items: list[PayrollBatchItem],
    column_mapping: dict[str, str],
    template_fields: list[dict],
) -> None:
    for item in items:
        field_data = map_row_to_field_data(item.row_data or {}, column_mapping, template_fields)
        item.field_data = field_data
        item.employee_label = infer_employee_label(item.row_data or {}, field_data)


def preview_items(items: list[PayrollBatchItem]) -> tuple[list[PayrollBatchItem], bool]:
    truncated = len(items) > PREVIEW_LIMIT
    return items[:PREVIEW_LIMIT], truncated


def _safe_slug(value: str | None, fallback: str) -> str:
    token = _normalize_token(value)
    return token[:80] or fallback


async def create_payroll_batch_from_csv(
    db: AsyncSession,
    *,
    name: str,
    template: Template,
    csv_filename: str | None,
    csv_content: bytes,
    created_by_id: str | None,
) -> PayrollBatch:
    headers, rows = parse_csv_rows(csv_content)
    if not rows:
        raise ValueError("O CSV nao possui linhas de dados para gerar holerites.")

    template_fields = list(template.fields or [])
    column_mapping = build_default_mapping(template_fields, headers)

    batch = PayrollBatch(
        name=name.strip(),
        template_id=template.id,
        status="draft",
        csv_filename=csv_filename or None,
        headers=headers,
        column_mapping=column_mapping,
        total_rows=len(rows),
        generated_rows=0,
        failed_rows=0,
        created_by_id=created_by_id,
    )
    db.add(batch)
    await db.flush()

    items: list[PayrollBatchItem] = []
    for index, row_data in enumerate(rows, start=1):
        field_data = map_row_to_field_data(row_data, column_mapping, template_fields)
        items.append(
            PayrollBatchItem(
                batch_id=batch.id,
                row_number=index,
                employee_label=infer_employee_label(row_data, field_data),
                status="pending",
                row_data=row_data,
                field_data=field_data,
            )
        )
    db.add_all(items)
    await db.flush()
    return batch


async def update_payroll_batch_mapping(
    db: AsyncSession,
    *,
    batch: PayrollBatch,
    template: Template,
    column_mapping: dict[str, str],
) -> PayrollBatch:
    headers = set(batch.headers or [])
    sanitized_mapping: dict[str, str] = {}
    for field in template.fields or []:
        key = str(field.get("key"))
        selected = str(column_mapping.get(key, "") or "").strip()
        if selected and selected not in headers:
            raise ValueError(f"A coluna '{selected}' nao existe no CSV importado.")
        sanitized_mapping[key] = selected

    result = await db.execute(
        select(PayrollBatchItem)
        .where(PayrollBatchItem.batch_id == batch.id)
        .order_by(PayrollBatchItem.row_number.asc())
    )
    items = result.scalars().all()
    refresh_batch_item_mappings(items, sanitized_mapping, list(template.fields or []))
    batch.column_mapping = sanitized_mapping
    batch.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return batch


async def generate_payroll_batch_files(
    db: AsyncSession,
    *,
    batch: PayrollBatch,
    template: Template,
) -> PayrollBatch:
    template_fields = list(template.fields or [])
    if not template_fields:
        raise ValueError("O template selecionado nao possui campos configurados.")

    result = await db.execute(
        select(PayrollBatchItem)
        .where(PayrollBatchItem.batch_id == batch.id)
        .order_by(PayrollBatchItem.row_number.asc())
    )
    items = result.scalars().all()
    if not items:
        raise ValueError("Este lote nao possui itens para gerar.")

    batch_dir = payroll_batch_dir(str(batch.id))
    generated_dir = batch_dir / "generated"
    if generated_dir.exists():
        shutil.rmtree(generated_dir)
    generated_dir.mkdir(parents=True, exist_ok=True)

    export_dir = batch_dir / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    batch.status = "generating"
    batch.generated_rows = 0
    batch.failed_rows = 0
    batch.last_error = None
    batch.completed_at = None
    await db.flush()

    generated_files: list[Path] = []
    template_abs_path = str((settings.TEMPLATES_PATH / Path(template.file_path)).resolve())

    for item in items:
        item.status = "pending"
        item.error_message = None
        item.pdf_filename = None
        item.pdf_path = None
        item.pdf_sha256 = None
        await db.flush()

        try:
            temp_dir = batch_dir / "work" / str(item.id)
            if temp_dir.exists():
                shutil.rmtree(temp_dir)
            temp_dir.mkdir(parents=True, exist_ok=True)

            docx_path, pdf_path, _, _ = await generate_document(
                template_abs_path,
                item.field_data or {},
                None,
                template_fields=template_fields,
                output_dir=temp_dir,
            )

            final_name = f"{item.row_number:03d}-{_safe_slug(item.employee_label, f'holerite_{item.row_number}')}.pdf"
            final_path = generated_dir / final_name
            shutil.move(pdf_path, final_path)

            try:
                Path(docx_path).unlink(missing_ok=True)
            except OSError:
                pass
            shutil.rmtree(temp_dir, ignore_errors=True)

            item.status = "generated"
            item.pdf_filename = final_name
            item.pdf_path = relative_path(final_path)
            item.pdf_sha256 = sha256_file(final_path)
            batch.generated_rows += 1
            generated_files.append(final_path)
        except Exception as exc:
            item.status = "failed"
            item.error_message = str(exc)
            batch.failed_rows += 1
        await db.flush()

    zip_name = f"{_safe_slug(batch.name, 'holerites')}.zip"
    zip_path = export_dir / zip_name
    if zip_path.exists():
        zip_path.unlink()

    if generated_files:
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for file_path in generated_files:
                archive.write(file_path, arcname=file_path.name)
        batch.zip_path = relative_path(zip_path)
        batch.zip_sha256 = sha256_file(zip_path)
    else:
        batch.zip_path = None
        batch.zip_sha256 = None

    batch.completed_at = datetime.now(timezone.utc)
    if batch.generated_rows and batch.failed_rows:
        batch.status = "completed_with_errors"
    elif batch.generated_rows:
        batch.status = "completed"
    else:
        batch.status = "failed"
        batch.last_error = "Nenhum holerite foi gerado com sucesso."

    batch.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return batch
