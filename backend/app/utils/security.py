"""Security utilities: JWT, password hashing, SHA-256."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def validate_password_strength(password: str) -> str | None:
    """Returns error message if password is weak, None if OK."""
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        return f"Senha deve ter pelo menos {settings.PASSWORD_MIN_LENGTH} caracteres."
    if not any(c.isupper() for c in password):
        return "Senha deve conter pelo menos uma letra maiúscula."
    if not any(c.isdigit() for c in password):
        return "Senha deve conter pelo menos um número."
    return None


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "access"},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_refresh_token_value() -> str:
    """Generate a cryptographically secure refresh token string."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """SHA-256 hash of a token for safe DB storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def decode_access_token(token: str) -> dict | None:
    """Decode and validate an access token. Returns payload or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def generate_signing_token() -> str:
    """Generate a 384-bit signing token for signatories."""
    return secrets.token_urlsafe(48)


def generate_verification_code() -> str:
    """Generate a public verification code for completed documents."""
    return secrets.token_urlsafe(18)


def sha256_file(file_path: str | Path) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()
