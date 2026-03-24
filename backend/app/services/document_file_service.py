"""Document file versioning helpers."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_file import DocumentFile
from app.utils.file_storage import relative_path


async def create_document_file_version(
    db: AsyncSession,
    document_id: str,
    kind: str,
    absolute_path: str,
    sha256: str,
) -> DocumentFile:
    current_result = await db.execute(
        select(DocumentFile).where(
            DocumentFile.document_id == document_id,
            DocumentFile.kind == kind,
            DocumentFile.is_current == True,
        )
    )
    now = datetime.now(timezone.utc)
    for current in current_result.scalars().all():
        current.is_current = False
        current.superseded_at = now

    version_result = await db.execute(
        select(func.max(DocumentFile.version_number)).where(
            DocumentFile.document_id == document_id,
            DocumentFile.kind == kind,
        )
    )
    next_version = (version_result.scalar() or 0) + 1

    document_file = DocumentFile(
        document_id=document_id,
        kind=kind,
        path=relative_path(absolute_path),
        sha256=sha256,
        version_number=next_version,
        is_current=True,
        superseded_at=None,
    )
    db.add(document_file)
    await db.flush()
    return document_file


async def supersede_current_document_files(
    db: AsyncSession,
    document_id: str,
    kinds: list[str] | tuple[str, ...],
) -> int:
    result = await db.execute(
        select(DocumentFile).where(
            DocumentFile.document_id == document_id,
            DocumentFile.kind.in_(list(kinds)),
            DocumentFile.is_current == True,
        )
    )
    now = datetime.now(timezone.utc)
    count = 0
    for file in result.scalars().all():
        file.is_current = False
        file.superseded_at = now
        count += 1
    await db.flush()
    return count
