"""FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.database import async_session
from app.services.app_settings_service import apply_runtime_overrides, migrate_settings_storage_if_needed
from app.services.runtime_secret_service import ensure_runtime_secret

logger = logging.getLogger("detter.reminders")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        if not settings.SECURITY_HEADERS_ENABLED:
            return response

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        )
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")

        forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
        if request.url.scheme == "https" or forwarded_proto == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )

        return response


async def _reminder_loop() -> None:
    """Background task: every hour, send reminder emails to pending signatories."""
    await asyncio.sleep(60)

    while True:
        try:
            await _send_pending_reminders()
        except Exception as exc:
            logger.error("Erro no loop de lembretes: %s", exc)

        await asyncio.sleep(3600)


async def _send_pending_reminders() -> None:
    from sqlalchemy import select

    from app.database import async_session
    from app.models.document import Document
    from app.models.signatory import Signatory
    from app.services.email_service import send_reminder

    reminder_threshold = datetime.now(timezone.utc) - timedelta(hours=24)

    async with async_session() as db:
        result = await db.execute(
            select(Signatory, Document.title)
            .join(Document, Document.id == Signatory.document_id)
            .where(
                Signatory.status.in_(["sent", "viewed", "identity_confirmed", "otp_verified"]),
                Document.status.in_(["sent", "in_signing"]),
                Signatory.sent_at <= reminder_threshold,
            )
        )
        rows = result.all()

    logger.info("Lembretes: %d signatarios pendentes", len(rows))

    for sig, doc_title in rows:
        signing_url = f"{settings.BASE_URL}/sign/{sig.token}"
        asyncio.create_task(send_reminder(sig.email, sig.name, doc_title, signing_url))
        await asyncio.sleep(0.5)


def _apply_saved_settings() -> None:
    """Load persisted runtime overrides from app_settings.json on startup."""
    try:
        ensure_runtime_secret()
        migrate_settings_storage_if_needed()
        apply_runtime_overrides()
    except Exception as exc:
        logger.warning("Nao foi possivel carregar app_settings.json: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    (settings.STORAGE_PATH / "documents").mkdir(exist_ok=True)
    (settings.STORAGE_PATH / "payroll_batches").mkdir(exist_ok=True)
    (settings.STORAGE_PATH / "signatures").mkdir(exist_ok=True)
    settings.CERTIFICATES_PATH.mkdir(parents=True, exist_ok=True)
    settings.TEMPLATES_PATH.mkdir(parents=True, exist_ok=True)

    _apply_saved_settings()

    task = asyncio.create_task(_reminder_loop())

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Uptech Sign",
    description="Plataforma de geracao e assinatura eletronica de documentos juridicos",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(SecurityHeadersMiddleware)

if settings.allowed_hosts_list:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.auth import router as auth_router  # noqa: E402
from app.api.dashboard import router as dashboard_router  # noqa: E402
from app.api.documents import router as documents_router  # noqa: E402
from app.api.payroll_batches import router as payroll_batches_router  # noqa: E402
from app.api.settings import router as settings_router  # noqa: E402
from app.api.signature_fields import router as signature_fields_router  # noqa: E402
from app.api.signatures import router as signatures_router  # noqa: E402
from app.api.signatories import router as signatories_router  # noqa: E402
from app.api.templates import router as templates_router  # noqa: E402
from app.api.users import router as users_router  # noqa: E402
from app.api.verification import router as verification_router  # noqa: E402

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(templates_router, prefix="/api/templates", tags=["templates"])
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(payroll_batches_router, prefix="/api/payroll-batches", tags=["payroll-batches"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(signatures_router, prefix="/api/sign", tags=["signatures"])
app.include_router(signatories_router, prefix="/api", tags=["signatories"])
app.include_router(signature_fields_router, prefix="/api", tags=["signature-fields"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(verification_router, prefix="/api/verify", tags=["verification"])


@app.get("/api/health")
async def health():
    db_ok = True
    db_error: str | None = None

    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_ok = False
        db_error = str(exc)

    storage_ok = settings.STORAGE_PATH.exists()
    templates_ok = settings.TEMPLATES_PATH.exists()
    certificates_ok = settings.CERTIFICATES_PATH.exists()

    payload = {
        "status": "ok" if all([db_ok, storage_ok, templates_ok, certificates_ok]) else "degraded",
        "environment": settings.APP_ENV,
        "database": {"ok": db_ok, "error": db_error},
        "storage": {
            "documents": storage_ok,
            "templates": templates_ok,
            "certificates": certificates_ok,
        },
        "institutional_signature_configured": bool(settings.INSTITUTIONAL_PFX_PATH),
        "base_url": settings.BASE_URL,
    }

    if payload["status"] != "ok":
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=payload)

    return payload
