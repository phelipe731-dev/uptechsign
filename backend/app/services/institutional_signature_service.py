"""Institutional ICP-Brasil signing for final PDFs using a PKCS#12 certificate."""

from __future__ import annotations

import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509 import Certificate
from cryptography.x509.oid import NameOID

from app.config import settings


@dataclass(slots=True)
class InstitutionalSignatureInfo:
    configured: bool
    signer_name: str | None = None
    issuer_name: str | None = None
    certificate_serial: str | None = None
    valid_until: str | None = None
    profile: str | None = None

    def as_dict(self) -> dict[str, str | bool | None]:
        return asdict(self)


def _resolve_pfx_path() -> Path | None:
    raw_path = settings.INSTITUTIONAL_PFX_PATH.strip()
    if not raw_path:
        return None

    path = Path(raw_path)
    if path.is_absolute():
        return path
    return settings.CERTIFICATES_PATH / path


def _name_part(cert_name, oid: NameOID) -> str | None:
    attrs = cert_name.get_attributes_for_oid(oid)
    if not attrs:
        return None
    value = attrs[0].value.strip()
    return value or None


def _display_name(cert: Certificate) -> str:
    return (
        _name_part(cert.subject, NameOID.COMMON_NAME)
        or _name_part(cert.subject, NameOID.ORGANIZATION_NAME)
        or settings.INSTITUTIONAL_SIGNATURE_NAME
    )


def _issuer_name(cert: Certificate) -> str:
    return (
        _name_part(cert.issuer, NameOID.COMMON_NAME)
        or _name_part(cert.issuer, NameOID.ORGANIZATION_NAME)
        or "ICP-Brasil"
    )


def _cert_valid_until(cert: Certificate) -> str:
    """Return the certificate expiry as ISO string, compatible with cryptography >= 42 and < 42."""
    try:
        return cert.not_valid_after_utc.isoformat()
    except AttributeError:
        return cert.not_valid_after.isoformat()  # type: ignore[attr-defined]


def get_institutional_signature_info() -> InstitutionalSignatureInfo:
    pfx_path = _resolve_pfx_path()
    if not pfx_path or not pfx_path.exists():
        return InstitutionalSignatureInfo(configured=False)

    raw_password = settings.INSTITUTIONAL_PFX_PASSWORD
    password = raw_password.encode("utf-8") if raw_password else None

    try:
        with pfx_path.open("rb") as certificate_file:
            _key, cert, _additional = pkcs12.load_key_and_certificates(
                certificate_file.read(),
                password,
            )
    except Exception as exc:
        if not raw_password:
            raise RuntimeError(
                "Nao foi possivel abrir o certificado. "
                "Configure a senha do certificado em 'Salvar configuracoes' e tente novamente."
            ) from exc
        raise RuntimeError(f"Senha incorreta ou certificado corrompido: {exc}") from exc

    if cert is None:
        raise RuntimeError("Nao foi possivel carregar o certificado institucional A1.")

    return InstitutionalSignatureInfo(
        configured=True,
        signer_name=_display_name(cert),
        issuer_name=_issuer_name(cert),
        certificate_serial=f"{cert.serial_number:X}",
        valid_until=_cert_valid_until(cert),
        profile=settings.INSTITUTIONAL_SIGNATURE_PROFILE,
    )


def sign_pdf_with_institutional_certificate_sync(
    input_path: str,
    output_path: str,
) -> InstitutionalSignatureInfo:
    pfx_path = _resolve_pfx_path()
    if not pfx_path:
        shutil.copyfile(input_path, output_path)
        return InstitutionalSignatureInfo(configured=False)

    if not pfx_path.exists():
        raise RuntimeError(f"Certificado institucional nao encontrado em '{pfx_path}'.")

    info = get_institutional_signature_info()

    from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
    from pyhanko.sign import signers
    from pyhanko.sign.fields import SigSeedSubFilter

    raw_password = settings.INSTITUTIONAL_PFX_PASSWORD
    signer = signers.SimpleSigner.load_pkcs12(
        pfx_file=str(pfx_path),
        passphrase=raw_password.encode("utf-8") if raw_password else None,
    )
    if signer is None:
        raise RuntimeError("Nao foi possivel inicializar a assinatura institucional A1.")

    with open(input_path, "rb") as input_stream, open(output_path, "wb") as output_stream:
        writer = IncrementalPdfFileWriter(input_stream)
        metadata = signers.PdfSignatureMetadata(
        field_name="UptechSignInstitutionalSignature",
            md_algorithm="sha256",
            subfilter=SigSeedSubFilter.PADES,
        )
        signers.sign_pdf(
            writer,
            signature_meta=metadata,
            signer=signer,
            existing_fields_only=False,
            output=output_stream,
        )

    return info
