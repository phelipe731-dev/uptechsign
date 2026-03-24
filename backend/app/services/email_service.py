"""Email service with runtime-configurable SMTP and editable templates."""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from copy import deepcopy
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings
from app.services.app_settings_service import load_settings_overrides

logger = logging.getLogger("detter.email")

DEFAULT_EMAIL_TEMPLATES: dict[str, dict[str, object]] = {
    "signing_request": {
        "label": "Convite para assinatura",
        "description": "Mensagem inicial enviada para o signatario abrir o link do documento.",
        "placeholders": ["name", "doc_title", "signing_url", "role_line"],
        "subject": "Solicitacao de assinatura - {{doc_title}}",
        "body_html": """
<p>Ola, <strong>{{name}}</strong>.</p>
<p>Voce foi solicitado(a) a assinar o seguinte documento:</p>
<p style="background:#f3f4f6;border-left:4px solid #c9a84c;padding:12px 16px;border-radius:4px;font-style:italic;">
  {{doc_title}}
</p>
{{role_line}}
<p>Clique no botao abaixo para visualizar e assinar o documento:</p>
<div style="text-align:center;margin:28px 0;">
  <a href="{{signing_url}}" style="background:#c9a84c;color:#111827;font-weight:bold;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;display:inline-block;">
    Visualizar e Assinar
  </a>
</div>
<p style="color:#6b7280;font-size:12px;">
  Ou copie e cole este link no seu navegador:<br>
  <a href="{{signing_url}}" style="color:#c9a84c;word-break:break-all;">{{signing_url}}</a>
</p>
<p style="color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;margin-top:24px;padding-top:16px;">
  Este link e pessoal e intransferivel. Nao compartilhe com terceiros.
</p>
        """.strip(),
    },
    "otp": {
        "label": "Codigo OTP",
        "description": "Codigo enviado para confirmar a assinatura do documento.",
        "placeholders": ["name", "code", "doc_title"],
        "subject": "Codigo de verificacao - {{doc_title}}",
        "body_html": """
<p>Ola, <strong>{{name}}</strong>.</p>
<p>Voce solicitou um codigo de verificacao para assinar o documento:</p>
<p style="background:#f3f4f6;border-left:4px solid #c9a84c;padding:12px 16px;border-radius:4px;font-style:italic;">
  {{doc_title}}
</p>
<p>Seu codigo de verificacao e:</p>
<div style="text-align:center;margin:24px 0;">
  <span style="background:#111827;color:#c9a84c;font-size:32px;font-weight:bold;letter-spacing:12px;padding:16px 24px;border-radius:8px;font-family:monospace;">
    {{code}}
  </span>
</div>
<p style="color:#6b7280;font-size:13px;">
  Este codigo e valido por <strong>10 minutos</strong> e pode ser usado apenas uma vez.<br>
  Caso nao tenha solicitado este codigo, ignore este e-mail.
</p>
        """.strip(),
    },
    "signing_confirmation": {
        "label": "Confirmacao interna de assinatura",
        "description": "Aviso ao criador do documento quando um signatario conclui a assinatura.",
        "placeholders": ["doc_title", "signatory_name", "remaining_text"],
        "subject": "Assinatura recebida - {{doc_title}}",
        "body_html": """
<p><strong>{{signatory_name}}</strong> assinou o documento:</p>
<p style="background:#f3f4f6;border-left:4px solid #c9a84c;padding:12px 16px;border-radius:4px;font-style:italic;">
  {{doc_title}}
</p>
<p style="color:#6b7280;">{{remaining_text}}</p>
        """.strip(),
    },
    "document_completed": {
        "label": "Documento concluido",
        "description": "Aviso ao criador quando todas as assinaturas foram coletadas.",
        "placeholders": ["doc_title", "doc_url"],
        "subject": "Documento concluido - {{doc_title}}",
        "body_html": """
<p>Otimas noticias! O documento abaixo foi <strong>concluido</strong> - todas as assinaturas foram coletadas:</p>
<p style="background:#f3f4f6;border-left:4px solid #c9a84c;padding:12px 16px;border-radius:4px;font-style:italic;">
  {{doc_title}}
</p>
<p>Acesse a plataforma para baixar o documento assinado e o certificado de assinaturas:</p>
<div style="text-align:center;margin:28px 0;">
  <a href="{{doc_url}}" style="background:#c9a84c;color:#111827;font-weight:bold;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;display:inline-block;">
    Ver Documento
  </a>
</div>
        """.strip(),
    },
    "refusal_notification": {
        "label": "Recusa de assinatura",
        "description": "Aviso ao criador do documento quando um signatario recusa.",
        "placeholders": ["doc_title", "signatory_name", "reason_block"],
        "subject": "Assinatura recusada - {{doc_title}}",
        "body_html": """
<p><strong>{{signatory_name}}</strong> recusou assinar o documento:</p>
<p style="background:#f3f4f6;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;font-style:italic;">
  {{doc_title}}
</p>
{{reason_block}}
<p style="color:#6b7280;font-size:13px;">
  O documento foi marcado como recusado. Acesse a plataforma para mais detalhes.
</p>
        """.strip(),
    },
    "reminder": {
        "label": "Lembrete de assinatura",
        "description": "Lembrete para o signatario pendente concluir a assinatura.",
        "placeholders": ["name", "doc_title", "signing_url"],
        "subject": "Lembrete: assine o documento - {{doc_title}}",
        "body_html": """
<p>Ola, <strong>{{name}}</strong>.</p>
<p>Este e um lembrete de que voce ainda nao assinou o seguinte documento:</p>
<p style="background:#f3f4f6;border-left:4px solid #c9a84c;padding:12px 16px;border-radius:4px;font-style:italic;">
  {{doc_title}}
</p>
<p>Por favor, acesse o link abaixo para assinar:</p>
<div style="text-align:center;margin:28px 0;">
  <a href="{{signing_url}}" style="background:#c9a84c;color:#111827;font-weight:bold;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;display:inline-block;">
    Assinar Agora
  </a>
</div>
        """.strip(),
    },
}


def _smtp_send_sync(to: str, subject: str, html_body: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning("SMTP nao configurado. Email para %s nao enviado: %s", to, subject)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    context = ssl.create_default_context()

    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to, msg.as_string())

    logger.info("Email enviado para %s: %s", to, subject)


async def send_email(to: str, subject: str, html_body: str) -> None:
    try:
        await asyncio.to_thread(_smtp_send_sync, to, subject, html_body)
    except Exception as exc:
        logger.error("Falha ao enviar email para %s: %s", to, exc)


def get_email_templates() -> dict[str, dict[str, object]]:
    overrides = load_settings_overrides().get("EMAIL_TEMPLATES", {})
    templates = deepcopy(DEFAULT_EMAIL_TEMPLATES)
    for key, override in overrides.items():
        if key not in templates or not isinstance(override, dict):
            continue
        templates[key]["subject"] = override.get("subject", templates[key]["subject"])
        templates[key]["body_html"] = override.get("body_html", templates[key]["body_html"])
    return templates


def _replace_placeholders(template: str, context: dict[str, object]) -> str:
    rendered = template
    for key, value in context.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", "" if value is None else str(value))
    return rendered


def _base_layout(title: str, content: str) -> str:
    brand_name = settings.INSTITUTIONAL_SIGNATURE_NAME or settings.SMTP_FROM_NAME or "Uptech Sign"
    footer_name = settings.SMTP_FROM_NAME or brand_name
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#111827;padding:0;">
          <div style="height:4px;background:#c9a84c;"></div>
          <div style="padding:20px 32px;display:flex;align-items:center;">
            <span style="border:2px solid #c9a84c;padding:4px 8px;color:#c9a84c;font-weight:bold;font-size:14px;letter-spacing:1px;">DD</span>
            &nbsp;&nbsp;
            <span style="color:#ffffff;font-weight:bold;font-size:14px;letter-spacing:1px;">{brand_name.upper()}</span>
          </div>
        </td></tr>
        <tr><td style="padding:32px;color:#111827;font-size:15px;line-height:1.7;">
          {content}
        </td></tr>
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;color:#9ca3af;font-size:12px;">
          {footer_name}<br>
          Assinatura Eletronica de Documentos
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _render_configured_email(template_key: str, context: dict[str, object]) -> tuple[str, str]:
    templates = get_email_templates()
    template = templates[template_key]
    subject = _replace_placeholders(str(template["subject"]), context)
    body_inner = _replace_placeholders(str(template["body_html"]), context)
    return subject, _base_layout(subject, body_inner)


async def send_otp(to: str, name: str, code: str, doc_title: str) -> None:
    if not settings.SMTP_HOST:
        logger.warning(
            "SMTP nao configurado. OTP DEV para %s (%s) no documento '%s': %s",
            to,
            name,
            doc_title,
            code,
        )
        return
    subject, body = _render_configured_email(
        "otp",
        {"name": name, "code": code, "doc_title": doc_title},
    )
    await send_email(to, subject, body)


async def send_signing_request(
    to: str, name: str, doc_title: str, signing_url: str, role: str | None = None
) -> None:
    role_line = (
        f'<p style="color:#6b7280;font-size:13px;">Seu papel: <strong>{role}</strong></p>'
        if role
        else ""
    )
    subject, body = _render_configured_email(
        "signing_request",
        {
            "name": name,
            "doc_title": doc_title,
            "signing_url": signing_url,
            "role_line": role_line,
        },
    )
    await send_email(to, subject, body)


async def send_signing_confirmation(
    to: str, doc_title: str, signatory_name: str, remaining: int
) -> None:
    remaining_text = (
        f"Aguardando {remaining} assinatura(s) restante(s)."
        if remaining > 0
        else "Todas as assinaturas foram coletadas. O documento sera finalizado em breve."
    )
    subject, body = _render_configured_email(
        "signing_confirmation",
        {
            "doc_title": doc_title,
            "signatory_name": signatory_name,
            "remaining_text": remaining_text,
        },
    )
    await send_email(to, subject, body)


async def send_document_completed(to: str, doc_title: str, doc_url: str) -> None:
    subject, body = _render_configured_email(
        "document_completed",
        {"doc_title": doc_title, "doc_url": doc_url},
    )
    await send_email(to, subject, body)


async def send_refusal_notification(
    to: str, doc_title: str, signatory_name: str, reason: str | None
) -> None:
    reason_block = (
        f'<p style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;">Motivo: {reason}</p>'
        if reason
        else ""
    )
    subject, body = _render_configured_email(
        "refusal_notification",
        {
            "doc_title": doc_title,
            "signatory_name": signatory_name,
            "reason_block": reason_block,
        },
    )
    await send_email(to, subject, body)


async def send_reminder(to: str, name: str, doc_title: str, signing_url: str) -> None:
    subject, body = _render_configured_email(
        "reminder",
        {"name": name, "doc_title": doc_title, "signing_url": signing_url},
    )
    await send_email(to, subject, body)


async def send_test_email(to: str) -> None:
    subject = "Teste de configuracao SMTP - Uptech Sign"
    body = _base_layout(
        "Teste de e-mail",
        "<p>Este e um e-mail de teste enviado pela plataforma Uptech Sign.</p>"
        "<p>Se voce recebeu esta mensagem, o SMTP esta configurado corretamente.</p>",
    )
    await asyncio.to_thread(_smtp_send_sync, to, subject, body)


def send_operational_alert_sync(
    recipients: list[str] | tuple[str, ...],
    subject: str,
    body_html: str,
) -> None:
    cleaned_recipients = [recipient.strip() for recipient in recipients if recipient and recipient.strip()]
    if not cleaned_recipients:
        raise RuntimeError("Nenhum destinatario foi informado para o alerta operacional.")
    if not settings.SMTP_HOST:
        raise RuntimeError("SMTP nao configurado para envio de alerta operacional.")

    wrapped_body = _base_layout(subject, body_html)
    for recipient in cleaned_recipients:
        _smtp_send_sync(recipient, subject, wrapped_body)
