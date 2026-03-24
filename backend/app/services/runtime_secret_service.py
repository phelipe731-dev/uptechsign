"""Runtime secret helpers for JWT and at-rest encryption."""

from __future__ import annotations

import base64
import hashlib
import secrets
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

SECRET_FILE: Path = settings.STORAGE_PATH / "instance_secret.key"
DEFAULT_SECRET_PREFIX = "CHANGE-ME"


def ensure_runtime_secret() -> str:
    """Ensure the app uses a persistent non-default secret key."""
    configured = settings.SECRET_KEY.strip()
    if configured and not configured.upper().startswith(DEFAULT_SECRET_PREFIX):
        return configured

    SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
    if SECRET_FILE.exists():
        secret = SECRET_FILE.read_text(encoding="utf-8").strip()
    else:
        secret = secrets.token_urlsafe(64)
        SECRET_FILE.write_text(secret, encoding="utf-8")
        try:
            SECRET_FILE.chmod(0o600)
        except Exception:
            pass

    settings.SECRET_KEY = secret
    return secret


def _fernet() -> Fernet:
    secret = ensure_runtime_secret().encode("utf-8")
    digest = hashlib.sha256(secret).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_setting_value(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_setting_value(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Nao foi possivel descriptografar uma configuracao sensivel.") from exc
