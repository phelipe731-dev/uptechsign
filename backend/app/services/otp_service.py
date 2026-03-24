"""OTP service backed by signatory fields stored in PostgreSQL."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from app.models.signatory import Signatory

OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 3
OTP_RESEND_COOLDOWN_SECONDS = 60


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def generate_otp(signatory: Signatory) -> str:
    """Generate and attach a new OTP to the signatory record."""
    code = "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))
    now = datetime.now(timezone.utc)

    signatory.otp_code_hash = _hash_code(code)
    signatory.otp_sent_at = now
    signatory.otp_expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
    signatory.otp_attempts = 0

    return code


def verify_otp(signatory: Signatory, code: str) -> tuple[bool, str | None]:
    """Verify a persisted OTP challenge for a signatory."""
    if not signatory.otp_code_hash or not signatory.otp_expires_at:
        return False, "Codigo OTP nao encontrado. Solicite um novo codigo."

    now = datetime.now(timezone.utc)
    if signatory.otp_expires_at < now:
        invalidate_otp(signatory)
        return False, "Codigo OTP expirado. Solicite um novo codigo."

    attempts = signatory.otp_attempts or 0
    if attempts >= OTP_MAX_ATTEMPTS:
        invalidate_otp(signatory)
        return False, "Numero maximo de tentativas excedido. Solicite um novo codigo."

    signatory.otp_attempts = attempts + 1

    if _hash_code(code) != signatory.otp_code_hash:
        remaining = OTP_MAX_ATTEMPTS - signatory.otp_attempts
        if remaining <= 0:
            invalidate_otp(signatory)
            return False, "Codigo incorreto. Numero maximo de tentativas excedido."
        return False, f"Codigo incorreto. {remaining} tentativa(s) restante(s)."

    invalidate_otp(signatory)
    return True, None


def invalidate_otp(signatory: Signatory) -> None:
    """Remove any pending OTP challenge from the signatory record."""
    signatory.otp_code_hash = None
    signatory.otp_expires_at = None
    signatory.otp_attempts = 0


def get_resend_cooldown_remaining(signatory: Signatory) -> int:
    """Return resend cooldown in seconds, or 0 if a new code may be sent."""
    if not signatory.otp_sent_at:
        return 0

    next_allowed_at = signatory.otp_sent_at + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS)
    remaining = int((next_allowed_at - datetime.now(timezone.utc)).total_seconds())
    return max(remaining, 0)
