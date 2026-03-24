"""Dashboard API routes: stats, pending documents, recent activity."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.user import User

router = APIRouter()


def _serialize_activity(log: AuditLog, document_title: str | None) -> dict:
    details = log.details or {}
    actor_label = None
    if isinstance(details, dict):
        actor_label = (
            details.get("signatory_name")
            or details.get("signatory")
            or details.get("email")
            or details.get("title")
        )

    return {
        "id": log.id,
        "actor_type": log.actor_type,
        "actor_label": actor_label,
        "document_id": str(log.document_id) if log.document_id else None,
        "document_title": document_title,
        "action": log.action,
        "details": log.details,
        "ip_address": str(log.ip_address) if log.ip_address else None,
        "user_agent": log.user_agent,
        "created_at": log.created_at.isoformat(),
    }


def _serialize_pending_document(document: Document) -> dict:
    signatories = list(document.signatories or [])
    signed_count = sum(1 for signatory in signatories if signatory.status == "signed")
    pending_signatories = [
        signatory for signatory in signatories if signatory.status not in ("signed", "refused")
    ]
    waiting_for = pending_signatories[0].name if pending_signatories else None

    return {
        "id": str(document.id),
        "title": document.title,
        "status": document.status,
        "template_name": document.template.name if document.template else None,
        "source_type": document.source_type,
        "created_at": document.created_at.isoformat(),
        "last_activity_at": document.last_activity_at.isoformat() if document.last_activity_at else None,
        "signatories_count": len(signatories),
        "signed_signatories_count": signed_count,
        "pending_signatories_count": len(pending_signatories),
        "waiting_for": waiting_for,
        "current_signing_order": document.current_signing_order,
    }


@router.get("/stats")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Counts by document status."""
    result = await db.execute(
        select(Document.status, func.count(Document.id)).group_by(Document.status)
    )
    counts = {row[0]: row[1] for row in result.all()}
    total = sum(counts.values())

    return {
        "total": total,
        "generated": counts.get("generated", 0),
        "sent": counts.get("sent", 0),
        "in_signing": counts.get("in_signing", 0),
        "completed": counts.get("completed", 0),
        "refused": counts.get("refused", 0),
        "expired": counts.get("expired", 0),
        "cancelled": counts.get("cancelled", 0),
    }


@router.get("/pending")
async def dashboard_pending(
    limit: int = Query(6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Documents that still require internal follow-up."""
    result = await db.execute(
        select(Document)
        .where(Document.status.in_(["generated", "sent", "in_signing"]))
        .order_by(func.coalesce(Document.last_activity_at, Document.created_at).desc())
        .limit(limit)
        .options(
            selectinload(Document.signatories),
            selectinload(Document.template),
        )
    )
    return [_serialize_pending_document(document) for document in result.scalars().all()]


async def _get_recent_activity(
    db: AsyncSession,
    limit: int,
) -> list[dict]:
    result = await db.execute(
        select(AuditLog, Document.title)
        .outerjoin(Document, Document.id == AuditLog.document_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return [_serialize_activity(log, title) for log, title in result.all()]


@router.get("/activity")
async def dashboard_activity(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Recent audit log activity."""
    return await _get_recent_activity(db, limit)


@router.get("/recent")
async def dashboard_recent(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Alias of the recent activity feed."""
    return await _get_recent_activity(db, limit)
