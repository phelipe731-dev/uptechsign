"""Application settings via pydantic-settings."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://detter:detter@localhost:5432/detter"

    # Auth
    SECRET_KEY: str = "CHANGE-ME-in-production-use-secrets-token-hex-32"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCK_MINUTES: int = 15

    # Paths
    STORAGE_PATH: Path = Path(__file__).resolve().parent.parent / "storage"
    TEMPLATES_PATH: Path = Path(__file__).resolve().parent.parent / "templates"
    CERTIFICATES_PATH: Path = Path(__file__).resolve().parent.parent / "certs"
    LIBREOFFICE_PATH: str = "soffice"

    # Server
    APP_ENV: str = "development"
    BASE_URL: str = "http://localhost:3000"
    CORS_ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"
    TRUST_PROXY_HEADERS: bool = False
    SECURITY_HEADERS_ENABLED: bool = True
    LEGAL_TERMS_VERSION: str = "2026-03-24"
    LEGAL_TERMS_ACCEPTANCE_TEXT: str = (
        "Declaro que li o documento, concordo com seu conteudo, confirmo minha identidade "
        "e reconheco a validade desta assinatura eletronica, realizada pelos meios de "
        "autenticacao e registro probatorio disponibilizados pela plataforma."
    )
    PUBLIC_APP_NAME: str = "Uptech Sign"
    LEGAL_ENTITY_NAME: str = "Uptech Sign"
    LEGAL_ADDRESS: str = ""
    SUPPORT_EMAIL: str = ""
    SUPPORT_WHATSAPP: str = ""
    SUPPORT_URL: str = ""
    PRIVACY_CONTACT_EMAIL: str = ""
    DPA_CONTACT_EMAIL: str = ""
    IP_GEOLOCATION_ENABLED: bool = True
    IP_GEOLOCATION_ENDPOINT_TEMPLATE: str = "https://ipwho.is/{ip}"
    IP_GEOLOCATION_TIMEOUT_SECONDS: float = 4.0

    # Email (SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@detter.adv.br"
    SMTP_FROM_NAME: str = "Uptech Sign"
    DEBUG_EXPOSE_OTP: bool = False

    # Institutional ICP-Brasil signing
    INSTITUTIONAL_PFX_PATH: str = ""
    INSTITUTIONAL_PFX_PASSWORD: str = ""
    INSTITUTIONAL_SIGNATURE_NAME: str = "Uptech Sign"
    INSTITUTIONAL_SIGNATURE_PROFILE: str = "PAdES-B-B"

    # Password policy
    PASSWORD_MIN_LENGTH: int = 8

    # Public endpoint protections
    PUBLIC_RATE_LIMIT_WINDOW_SECONDS: int = 600
    PUBLIC_LINK_RATE_LIMIT: int = 60
    PUBLIC_PDF_RATE_LIMIT: int = 60
    PUBLIC_IDENTITY_RATE_LIMIT: int = 20
    PUBLIC_OTP_REQUEST_RATE_LIMIT: int = 6
    PUBLIC_OTP_VERIFY_RATE_LIMIT: int = 12
    PUBLIC_SIGN_SUBMIT_RATE_LIMIT: int = 8
    PUBLIC_REFUSAL_RATE_LIMIT: int = 6
    PUBLIC_VERIFICATION_RATE_LIMIT: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        return [item.strip() for item in self.CORS_ALLOWED_ORIGINS.split(",") if item.strip()]

    @property
    def allowed_hosts_list(self) -> list[str]:
        return [item.strip() for item in self.ALLOWED_HOSTS.split(",") if item.strip()]


settings = Settings()
