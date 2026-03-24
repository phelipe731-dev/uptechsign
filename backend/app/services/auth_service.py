"""Authentication service: login, refresh, logout, lock management."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.utils.security import (
    create_access_token,
    create_refresh_token_value,
    hash_password,
    hash_token,
    verify_password,
)


async def authenticate_user(
    db: AsyncSession, email: str, password: str, ip: str | None = None, ua: str | None = None
) -> tuple[User | None, str | None]:
    """
    Authenticate user by email+password.
    Returns (user, error_message). If user is returned, error is None.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        return None, "Credenciais inválidas."

    # Check lock
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = (user.locked_until - datetime.now(timezone.utc)).seconds // 60
        return None, f"Conta bloqueada. Tente novamente em {remaining + 1} minuto(s)."

    if not verify_password(password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.LOGIN_LOCK_MINUTES)
            user.failed_login_attempts = 0
            await db.commit()
            return None, f"Conta bloqueada por {settings.LOGIN_LOCK_MINUTES} minutos após múltiplas tentativas."
        await db.commit()
        return None, "Credenciais inválidas."

    # Success - reset attempts
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    return user, None


async def create_tokens(
    db: AsyncSession, user: User, ip: str | None = None, ua: str | None = None
) -> tuple[str, str]:
    """Create access + refresh tokens. Returns (access_token, refresh_token)."""
    access_token = create_access_token(str(user.id))
    refresh_value = create_refresh_token_value()

    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_value),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        ip_address=ip,
        user_agent=ua,
    )
    db.add(rt)
    await db.commit()

    return access_token, refresh_value


async def refresh_access_token(
    db: AsyncSession, refresh_value: str, ip: str | None = None, ua: str | None = None
) -> tuple[str | None, str | None, str | None]:
    """
    Validate refresh token and issue new access + refresh tokens (rotation).
    Returns (access_token, new_refresh_token, error).
    """
    token_hash = hash_token(refresh_value)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    )
    rt = result.scalar_one_or_none()

    if not rt:
        return None, None, "Token de refresh inválido."

    if rt.expires_at < datetime.now(timezone.utc):
        rt.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        return None, None, "Token de refresh expirado."

    # Load user
    user_result = await db.execute(select(User).where(User.id == rt.user_id, User.is_active == True))
    user = user_result.scalar_one_or_none()
    if not user:
        return None, None, "Usuário inativo."

    # Revoke old, create new (rotation)
    rt.revoked_at = datetime.now(timezone.utc)
    access_token, new_refresh = await create_tokens(db, user, ip, ua)

    return access_token, new_refresh, None


async def revoke_refresh_token(db: AsyncSession, refresh_value: str) -> None:
    """Revoke a refresh token (logout)."""
    token_hash = hash_token(refresh_value)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    rt = result.scalar_one_or_none()
    if rt and not rt.revoked_at:
        rt.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def create_user(
    db: AsyncSession, email: str, full_name: str, password: str, role: str = "user"
) -> User:
    """Create a new user."""
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
