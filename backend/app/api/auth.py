"""Auth API routes: login, refresh, logout, me, signature profile, change password."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_current_user, get_user_agent
from app.database import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RefreshRequest, TokenResponse
from app.schemas.user import UserProfileUpdate, UserResponse, UserSignatureUpdate
from app.services.auth_service import (
    authenticate_user,
    create_tokens,
    refresh_access_token,
    revoke_refresh_token,
)
from app.utils.security import hash_password, validate_password_strength, verify_password

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    user, error = await authenticate_user(db, body.email, body.password, ip, ua)
    if error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error)

    access_token, refresh_token = await create_tokens(db, user, ip, ua)

    # Set refresh token in httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
        path="/api/auth",
    )

    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_value = request.cookies.get("refresh_token")
    if not refresh_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token não encontrado.")

    ip = get_client_ip(request)
    ua = get_user_agent(request)

    access_token, new_refresh, error = await refresh_access_token(db, refresh_value, ip, ua)
    if error:
        response.delete_cookie("refresh_token", path="/api/auth")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
        path="/api/auth",
    )

    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_value = request.cookies.get("refresh_token")
    if refresh_value:
        await revoke_refresh_token(db, refresh_value)
    response.delete_cookie("refresh_token", path="/api/auth")


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.email is not None:
        normalized_email = body.email.strip().lower()
        if normalized_email != user.email:
            existing = await db.execute(select(User).where(User.email == normalized_email, User.id != user.id))
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ja existe um usuario com este e-mail.")
            user.email = normalized_email

    if body.full_name is not None:
        if not body.full_name.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe o nome completo.")
        user.full_name = body.full_name.strip()

    await db.commit()
    await db.refresh(user)
    return user


@router.put("/me/signature", response_model=UserResponse)
async def update_my_signature(
    body: UserSignatureUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.signature_data = {
        "default_mode": body.default_mode,
        "typed_name": body.typed_name.strip(),
        "signature_image_base64": body.signature_image_base64,
        "initials": (body.initials or "").strip().upper() or None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta.")

    error = validate_password_strength(body.new_password)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    user.hashed_password = hash_password(body.new_password)
    await db.commit()
