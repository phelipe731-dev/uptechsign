"""File storage utilities with UUID-based random naming."""

import uuid
from pathlib import Path

from app.config import settings


def document_dir(document_id: str) -> Path:
    """Get or create the directory for a document's files."""
    d = settings.STORAGE_PATH / "documents" / str(document_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def payroll_batch_dir(batch_id: str) -> Path:
    """Get or create the directory for a payroll batch files."""
    d = settings.STORAGE_PATH / "payroll_batches" / str(batch_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def random_filename(extension: str) -> str:
    """Generate a random filename with the given extension."""
    return f"{uuid.uuid4().hex}{extension}"


def resolve_path(relative_path: str) -> Path:
    """Resolve a relative storage path to an absolute path."""
    return settings.STORAGE_PATH / relative_path


def relative_path(absolute_path: Path | str) -> str:
    """Convert an absolute path to a relative storage path."""
    return str(Path(absolute_path).relative_to(settings.STORAGE_PATH))
