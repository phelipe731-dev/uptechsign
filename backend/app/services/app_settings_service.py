"""Persistence helpers for runtime-configurable application settings."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.runtime_secret_service import decrypt_setting_value, encrypt_setting_value

SETTINGS_FILE: Path = settings.STORAGE_PATH / "app_settings.json"
SENSITIVE_KEYS = {"SMTP_PASSWORD", "INSTITUTIONAL_PFX_PASSWORD"}


def _decode_value(key: str, value: Any) -> Any:
    if key not in SENSITIVE_KEYS or not isinstance(value, dict):
        return value
    if not value.get("__encrypted__"):
        return value
    encrypted = value.get("value")
    if not isinstance(encrypted, str):
        return ""
    return decrypt_setting_value(encrypted)


def _encode_value(key: str, value: Any) -> Any:
    if key not in SENSITIVE_KEYS or not value:
        return value
    if not isinstance(value, str):
        return value
    return {"__encrypted__": True, "value": encrypt_setting_value(value)}


def load_settings_overrides() -> dict[str, Any]:
    if SETTINGS_FILE.exists():
        try:
            raw = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                return {}
            return {key: _decode_value(key, value) for key, value in raw.items()}
        except Exception:
            return {}
    return {}


def save_settings_overrides(data: dict[str, Any]) -> None:
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {key: _encode_value(key, value) for key, value in data.items()}
    SETTINGS_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def migrate_settings_storage_if_needed() -> None:
    if not SETTINGS_FILE.exists():
        return
    overrides = load_settings_overrides()
    save_settings_overrides(overrides)


def apply_runtime_overrides(data: dict[str, Any] | None = None) -> dict[str, Any]:
    overrides = data if data is not None else load_settings_overrides()
    for key, value in overrides.items():
        if hasattr(settings, key):
            setattr(settings, key, value)
    return overrides


def update_settings_overrides(updates: dict[str, Any]) -> dict[str, Any]:
    overrides = load_settings_overrides()
    overrides.update(updates)
    save_settings_overrides(overrides)
    apply_runtime_overrides(overrides)
    return overrides
