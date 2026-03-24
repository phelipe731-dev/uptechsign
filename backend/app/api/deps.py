"""Shared API dependencies."""

import ipaddress

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.utils.security import decode_access_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from the JWT access token."""
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido ou expirado.")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado.")
    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores.")
    return user


def _iter_ip_candidates(request: Request) -> list[str]:
    candidates: list[str] = []

    if settings.TRUST_PROXY_HEADERS:
        for header in ["CF-Connecting-IP", "True-Client-IP", "X-Real-IP"]:
            value = request.headers.get(header)
            if value:
                candidates.extend(part.strip() for part in value.split(","))

        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            candidates.extend(part.strip() for part in forwarded.split(","))

    if request.client and request.client.host:
        candidates.append(request.client.host)

    cleaned: list[str] = []
    for candidate in candidates:
        if not candidate or candidate.lower() == "unknown":
            continue
        if candidate not in cleaned:
            cleaned.append(candidate)
    return cleaned


def _prefer_public_ip(candidates: list[str]) -> str | None:
    first_valid: str | None = None
    for candidate in candidates:
        try:
            parsed = ipaddress.ip_address(candidate)
        except ValueError:
            continue

        if first_valid is None:
            first_valid = candidate

        if parsed.is_global:
            return candidate

    return first_valid


def get_client_ip(request: Request) -> str | None:
    return _prefer_public_ip(_iter_ip_candidates(request))


def get_user_agent(request: Request) -> str | None:
    return request.headers.get("User-Agent")


def build_rate_limit_key(request: Request, scope: str, extra: str | None = None) -> str:
    ip = get_client_ip(request) or "unknown"
    user_agent = (get_user_agent(request) or "unknown").strip().lower()
    user_agent_token = user_agent[:48] if ip == "unknown" else ""

    parts = [scope, ip]
    if extra:
        parts.append(extra)
    if user_agent_token:
        parts.append(user_agent_token)
    return ":".join(parts)
