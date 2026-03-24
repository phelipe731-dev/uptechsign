from __future__ import annotations

import argparse
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Envia alerta operacional do Uptech Sign.")
    parser.add_argument("--to", required=True, help="Lista de destinatarios separada por virgula.")
    parser.add_argument("--subject", required=True, help="Assunto do alerta.")
    parser.add_argument(
        "--body-html-file",
        required=True,
        help="Arquivo HTML com o conteudo interno do alerta.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    project_root = Path(__file__).resolve().parents[1]
    backend_path = project_root / "backend"
    if str(backend_path) not in sys.path:
        sys.path.insert(0, str(backend_path))

    from app.services.app_settings_service import apply_runtime_overrides, migrate_settings_storage_if_needed
    from app.services.email_service import send_operational_alert_sync
    from app.services.runtime_secret_service import ensure_runtime_secret

    ensure_runtime_secret()
    migrate_settings_storage_if_needed()
    apply_runtime_overrides()

    body_path = Path(args.body_html_file)
    if not body_path.exists():
        raise RuntimeError(f"Arquivo HTML do alerta nao encontrado: {body_path}")

    recipients = [item.strip() for item in args.to.split(",") if item.strip()]
    body_html = body_path.read_text(encoding="utf-8")
    send_operational_alert_sync(recipients, args.subject, body_html)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
