"""PDF service: visual signature rendering, report appendix and optional institutional A1 sealing."""

from __future__ import annotations

import asyncio
import base64
import io
from pathlib import Path
from datetime import datetime, timedelta, timezone

import fitz  # PyMuPDF
import qrcode

from app.services.institutional_signature_service import (
    InstitutionalSignatureInfo,
    get_institutional_signature_info,
    sign_pdf_with_institutional_certificate_sync,
)
from app.utils.file_storage import document_dir, random_filename
from app.utils.security import sha256_file

WHITE = (1.0, 1.0, 1.0)
BLACK = (0.12, 0.11, 0.1)
GRAY = (0.42, 0.39, 0.37)
LGRAY = (0.89, 0.85, 0.81)
LLGRAY = (0.98, 0.97, 0.95)
BLUE = (0.99, 0.76, 0.11)
BLUE_SOFT = (1.0, 0.97, 0.86)
GREEN = (0.18, 0.62, 0.35)
GREEN_SOFT = (0.9, 0.97, 0.92)
AMBER = (0.95, 0.67, 0.12)
AMBER_SOFT = (1.0, 0.97, 0.9)
RED = (0.76, 0.19, 0.2)
RED_SOFT = (0.99, 0.93, 0.93)
GRAPHITE = (0.18, 0.17, 0.17)
STONE_SOFT = (0.96, 0.94, 0.92)

PW = 595.28
PH = 841.89
ML = 28
MR = 28
CW = PW - ML - MR
BRT = timezone(timedelta(hours=-3), name="UTC-0300")


def _mask_cpf(cpf: str | None) -> str:
    if not cpf:
        return "-"
    clean = "".join(ch for ch in cpf if ch.isdigit())
    if len(clean) == 11:
        return f"***.{clean[3:6]}.{clean[6:9]}-**"
    return cpf


def _short_ua(ua: str | None, limit: int = 90) -> str:
    if not ua:
        return "-"
    return ua[:limit] + "..." if len(ua) > limit else ua


def _normalize_dt(dt_val) -> datetime | None:
    if not dt_val:
        return None
    if isinstance(dt_val, datetime):
        return dt_val
    try:
        return datetime.fromisoformat(dt_val)
    except Exception:
        return None


def _format_dt(dt_val, with_timezone: bool = True) -> str:
    dt = _normalize_dt(dt_val)
    if not dt:
        return "-"
    local_dt = dt.astimezone(BRT)
    return local_dt.strftime("%d/%m/%Y %H:%M:%S") + (" (UTC-0300)" if with_timezone else "")


def _wrap_text_lines(
    text: str | None,
    max_width: float,
    *,
    fontname: str = "helv",
    fontsize: float = 9,
) -> list[str]:
    raw_text = str(text or "-")
    paragraphs = raw_text.splitlines() or [raw_text]
    lines: list[str] = []

    for paragraph in paragraphs:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue

        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if current and fitz.get_text_length(candidate, fontname=fontname, fontsize=fontsize) <= max_width:
                current = candidate
                continue
            if not current and fitz.get_text_length(word, fontname=fontname, fontsize=fontsize) <= max_width:
                current = word
                continue

            if current:
                lines.append(current)
                current = ""

            remainder = word
            while remainder and fitz.get_text_length(remainder, fontname=fontname, fontsize=fontsize) > max_width:
                split_at = len(remainder)
                while split_at > 1 and fitz.get_text_length(
                    remainder[:split_at],
                    fontname=fontname,
                    fontsize=fontsize,
                ) > max_width:
                    split_at -= 1
                lines.append(remainder[:split_at])
                remainder = remainder[split_at:]
            current = remainder

        if current:
            lines.append(current)

    return lines or [""]


def _text_block_height(
    text: str | None,
    max_width: float,
    *,
    fontname: str = "helv",
    fontsize: float = 9,
    line_height: float = 1.24,
) -> float:
    lines = _wrap_text_lines(text, max_width, fontname=fontname, fontsize=fontsize)
    return max(len(lines), 1) * fontsize * line_height


def _draw_wrapped_text(
    page: fitz.Page,
    x: float,
    y: float,
    width: float,
    text: str | None,
    *,
    fontname: str = "helv",
    fontsize: float = 9,
    color=BLACK,
    line_height: float = 1.24,
) -> float:
    lines = _wrap_text_lines(text, width, fontname=fontname, fontsize=fontsize)
    step = fontsize * line_height
    baseline = y + fontsize
    for line in lines:
        page.insert_text(
            fitz.Point(x, baseline),
            line,
            fontname=fontname,
            fontsize=fontsize,
            color=color,
        )
        baseline += step
    return y + max(len(lines), 1) * step


def _column_items_height(
    items: list[tuple[str, str]],
    width: float,
    *,
    fontname: str = "helv",
    fontsize: float = 8.8,
    item_gap: float = 6,
) -> float:
    total = 0.0
    for index, (key, value) in enumerate(items):
        total += _text_block_height(
            f"{key}: {value}",
            width,
            fontname=fontname,
            fontsize=fontsize,
        )
        if index < len(items) - 1:
            total += item_gap
    return total


def _draw_labeled_items_column(
    page: fitz.Page,
    items: list[tuple[str, str]],
    x: float,
    y: float,
    width: float,
    *,
    fontname: str = "helv",
    fontsize: float = 8.8,
    color=BLACK,
    item_gap: float = 6,
) -> float:
    cursor = y
    for index, (key, value) in enumerate(items):
        cursor = _draw_wrapped_text(
            page,
            x,
            cursor,
            width,
            f"{key}: {value}",
            fontname=fontname,
            fontsize=fontsize,
            color=color,
        )
        if index < len(items) - 1:
            cursor += item_gap
    return cursor


def _badge(
    page: fitz.Page,
    x: float,
    y: float,
    text: str,
    bg: tuple[float, float, float],
    fg: tuple[float, float, float],
    fontsize: float = 7.5,
) -> float:
    text_width = fitz.get_text_length(text, fontname="hebo", fontsize=fontsize)
    pad_x = 8
    pad_y = 3
    width = text_width + pad_x * 2
    rect = fitz.Rect(x, y - fontsize - 1, x + width, y + pad_y + 1)
    page.draw_rect(rect, color=bg, fill=bg, width=0.6)
    page.insert_text(
        fitz.Point(x + pad_x, y),
        text,
        fontname="hebo",
        fontsize=fontsize,
        color=fg,
    )
    return width


def _insert_sig_image(
    page: fitz.Page,
    b64: str | None,
    rect: fitz.Rect,
    fallback_text: str | None = None,
) -> None:
    if not b64:
        page.draw_rect(rect, color=LGRAY, fill=LLGRAY, width=0.6)
        page.insert_textbox(
            rect,
            fallback_text or "Sem imagem",
            fontname="helv",
            fontsize=13 if fallback_text else 7,
            color=BLACK if fallback_text else GRAY,
            align=1,
        )
        return

    try:
        raw = base64.b64decode(b64)
        page.insert_image(rect, stream=raw, keep_proportion=True)
    except Exception:
        page.draw_rect(rect, color=LGRAY, fill=LLGRAY, width=0.6)
        if fallback_text:
            page.insert_textbox(
                rect,
                fallback_text,
                fontname="helv",
                fontsize=12,
                color=BLACK,
                align=1,
            )


def _generate_qr_png_bytes(data: str) -> bytes:
    qr = qrcode.QRCode(border=1, box_size=8)
    qr.add_data(data)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _identity_phone(sig: dict) -> str:
    phone_number = sig.get("identity_phone_number")
    if not phone_number:
        return "-"
    ddi = sig.get("identity_phone_country_code")
    return f"{ddi} {phone_number}" if ddi else phone_number


def _approximate_location(sig: dict) -> str:
    lat = sig.get("sign_latitude")
    lon = sig.get("sign_longitude")
    label = sig.get("sign_location_label")
    if lat and lon:
        return f"{lat}, {lon}"
    return label or "-"


def _signature_mode_label(sig: dict) -> str:
    mode = (sig.get("signature_data") or {}).get("signature_mode")
    if mode == "drawn":
        return "Assinatura desenhada"
    if mode == "typed":
        return "Assinatura por texto"
    return "-"


def _terms_acceptance_label(sig: dict) -> str:
    accepted_at = sig.get("terms_accepted_at")
    version = sig.get("accepted_terms_version")
    if not accepted_at:
        return "Nao registrado"
    base = f"Aceito em {_format_dt(accepted_at, with_timezone=False)}"
    if version:
        return f"{base} (v{version})"
    return base


def _terms_acceptance_summary(sig: dict) -> str:
    terms_data = (sig.get("signature_data") or {}).get("terms_acceptance") or {}
    summary = terms_data.get("summary")
    if not summary:
        return "O signatario declarou ciencia do documento e concordancia com a assinatura eletronica."
    return str(summary)


def _draw_certificate_header(page: fitz.Page) -> None:
    page.insert_text(
        fitz.Point(ML, 34),
        "Relatorio de Assinaturas",
        fontname="hebo",
        fontsize=16.5,
        color=BLACK,
    )
    page.insert_text(
        fitz.Point(ML, 50),
        "Datas e horarios em UTC-0300 (America/Sao_Paulo)",
        fontname="helv",
        fontsize=7.6,
        color=GRAY,
    )
    page.insert_text(
        fitz.Point(ML, 63),
        f"Ultima atualizacao em {_format_dt(datetime.now(timezone.utc), with_timezone=False)}",
        fontname="helv",
        fontsize=7.6,
        color=GRAY,
    )

    logo_x = PW - MR - 188
    page.insert_text(
        fitz.Point(logo_x, 36),
        "UP",
        fontname="hebo",
        fontsize=22,
        color=BLUE,
    )
    page.insert_text(
        fitz.Point(logo_x + 34, 36),
        "Uptech",
        fontname="hebo",
        fontsize=14.5,
        color=GRAPHITE,
    )
    page.insert_text(
        fitz.Point(logo_x + 91, 36),
        "Sign",
        fontname="hebo",
        fontsize=14.5,
        color=BLUE,
    )
    page.insert_text(
        fitz.Point(logo_x + 34, 48),
        "ASSINATURA DIGITAL",
        fontname="helv",
        fontsize=6.6,
        color=GRAY,
    )


def _new_certificate_page(doc: fitz.Document) -> fitz.Page:
    page = doc.new_page(width=PW, height=PH)
    _draw_certificate_header(page)
    return page


def _draw_summary_box(
    page: fitz.Page,
    document_title: str,
    document_number: str,
    document_created_at,
    document_hash: str,
    verification_code: str,
    verification_url: str,
    signatories: list[dict],
    y: float,
) -> float:
    page.draw_line(fitz.Point(ML, y), fitz.Point(PW - MR, y), color=LGRAY, width=0.8)
    y += 14

    content_rect = fitz.Rect(ML, y, PW - MR, y + 126)
    page.draw_rect(content_rect, color=LGRAY, fill=WHITE, width=0.8)

    left_x = ML + 12
    qr_width = 74
    left_width = content_rect.width - qr_width - 30
    cursor_y = y + 18
    signed_count = sum(1 for item in signatories if item.get("status") == "signed")
    all_signed = signed_count == len(signatories) and len(signatories) > 0

    page.insert_text(fitz.Point(left_x, cursor_y), "Status:", fontname="hebo", fontsize=8.1, color=BLACK)
    _badge(
        page,
        left_x + 38,
        cursor_y,
        "Assinado" if all_signed else "Em andamento",
        GREEN_SOFT if all_signed else BLUE_SOFT,
        GREEN if all_signed else BLUE,
        7.2,
    )
    cursor_y += 12
    summary_lines = [
        (f"Documento: {document_title}", "hebo", 8.0, BLACK),
        (f"Numero: {document_number}", "helv", 8.0, BLACK),
        (f"Data da criacao: {_format_dt(document_created_at, with_timezone=False)}", "helv", 8.0, BLACK),
        (f"Hash do documento original (SHA256): {document_hash}", "helv", 7.2, GRAY),
    ]
    for text, fontname, fontsize, color in summary_lines:
        cursor_y = _draw_wrapped_text(
            page,
            left_x,
            cursor_y,
            left_width,
            text,
            fontname=fontname,
            fontsize=fontsize,
            color=color,
            line_height=1.18,
        ) + 2

    page.insert_text(
        fitz.Point(left_x, cursor_y + 2),
        f"Codigo de verificacao: {verification_code}",
        fontname="cour",
        fontsize=7.4,
        color=GRAY,
    )
    _draw_wrapped_text(
        page,
        left_x,
        cursor_y + 10,
        left_width,
        verification_url,
        fontname="helv",
        fontsize=7.1,
        color=GRAY,
        line_height=1.12,
    )

    qr_rect = fitz.Rect(content_rect.x1 - qr_width - 14, y + 16, content_rect.x1 - 14, y + 16 + qr_width)
    page.draw_rect(qr_rect, color=LGRAY, fill=WHITE, width=0.8)
    try:
        page.insert_image(qr_rect + (4, 4, -4, -4), stream=_generate_qr_png_bytes(verification_url))
    except Exception:
        page.insert_textbox(qr_rect, "QR indisponivel", fontname="helv", fontsize=8, color=GRAY, align=1)
    page.insert_textbox(
        fitz.Rect(content_rect.x1 - qr_width - 28, qr_rect.y1 + 6, content_rect.x1 - 10, qr_rect.y1 + 30),
        "Valide o documento pelo QR ou pelo link acima.",
        fontname="helv",
        fontsize=6.7,
        color=GRAY,
        align=1,
    )

    return content_rect.y1


def _draw_signatures_heading(page: fitz.Page, y: float, signatories: list[dict]) -> float:
    page.draw_line(fitz.Point(ML, y), fitz.Point(PW - MR, y), color=LGRAY, width=0.8)
    y += 22
    page.insert_text(fitz.Point(ML, y), "Assinaturas", fontname="hebo", fontsize=13.6, color=BLACK)
    signed_count = sum(1 for item in signatories if item.get("status") == "signed")
    counter = f"{signed_count} de {len(signatories)} Assinaturas"
    counter_width = fitz.get_text_length(counter, fontname="helv", fontsize=10.3)
    page.insert_text(
        fitz.Point(PW - MR - counter_width, y),
        counter,
        fontname="helv",
        fontsize=10.3,
        color=GRAY,
    )
    return y + 10


def _draw_signatory_card(page: fitz.Page, sig: dict, y: float) -> float:
    status = sig.get("status", "pending")
    if status == "signed":
        status_bg, status_fg, status_label = GREEN_SOFT, GREEN, "Assinado"
    elif status == "refused":
        status_bg, status_fg, status_label = RED_SOFT, RED, "Recusado"
    else:
        status_bg, status_fg, status_label = BLUE_SOFT, BLUE, "Pendente"

    auth_pairs = [
        (
            ("Telefone", _identity_phone(sig)),
            ("Localizacao aproximada", _approximate_location(sig)),
        ),
        (
            ("E-mail", sig.get("email") or "-"),
            ("IP", sig.get("ip_address_at_sign") or "-"),
        ),
        (
            ("Nome", sig.get("identity_name") or sig.get("name") or "-"),
            ("Dispositivo", _short_ua(sig.get("user_agent_at_sign"), 86)),
        ),
        (
            ("CPF", _mask_cpf(sig.get("cpf"))),
            ("OTP", "Email obrigatorio" if sig.get("auth_require_email_otp") else "Nao exigido"),
        ),
        (
            ("Modo", _signature_mode_label(sig)),
            ("Aceite", _terms_acceptance_label(sig)),
        ),
    ]
    card_width = PW - ML - MR
    inner_width = card_width - 20
    column_gap = 14
    column_width = (inner_width - column_gap) / 2
    signature_width = 126
    top_left_width = card_width - signature_width - 22
    token_text = f"Token: {sig.get('token') or '-'}"
    token_height = _text_block_height(token_text, top_left_width - 4, fontname="cour", fontsize=7.1, line_height=1.16)
    top_height = max(96, 70 + token_height)
    auth_height = 0.0
    for left_item, right_item in auth_pairs:
        left_height = _text_block_height(
            f"{left_item[0]}: {left_item[1]}",
            column_width,
            fontname="helv",
            fontsize=7.9,
            line_height=1.16,
        )
        right_height = _text_block_height(
            f"{right_item[0]}: {right_item[1]}",
            column_width,
            fontname="helv",
            fontsize=7.9,
            line_height=1.16,
        )
        auth_height += max(left_height, right_height) + 4
    summary_text = f"Termo de aceite: {_terms_acceptance_summary(sig)}"
    summary_height = _text_block_height(summary_text, inner_width, fontname="helv", fontsize=6.7, line_height=1.12)
    card_height = top_height + 14 + 14 + auth_height + 8 + summary_height + 10

    card_rect = fitz.Rect(ML, y + 10, PW - MR, y + 10 + card_height)
    page.draw_rect(card_rect, color=LGRAY, fill=WHITE, width=0.8)

    top_rect = fitz.Rect(card_rect.x0, card_rect.y0, card_rect.x1, card_rect.y0 + top_height)
    page.draw_line(
        fitz.Point(card_rect.x0, top_rect.y1),
        fitz.Point(card_rect.x1, top_rect.y1),
        color=LGRAY,
        width=0.8,
    )

    x = card_rect.x0 + 10
    y_cursor = card_rect.y0 + 22
    status_width = _badge(page, x, y_cursor, status_label, status_bg, status_fg, 7.1)
    _badge(page, x + status_width + 6, y_cursor, "via Uptech Sign", BLUE_SOFT, BLUE, 7.1)

    signer_name = sig.get("name", "-").upper()
    _draw_wrapped_text(
        page,
        x,
        card_rect.y0 + 34,
        top_left_width,
        signer_name,
        fontname="hebo",
        fontsize=11.2,
        color=BLACK,
        line_height=1.08,
    )
    _draw_wrapped_text(
        page,
        x,
        card_rect.y0 + 52,
        top_left_width,
        f"Data e hora da assinatura: {_format_dt(sig.get('signed_at'))}",
        fontname="helv",
        fontsize=7.9,
        color=BLACK,
        line_height=1.14,
    )
    _draw_wrapped_text(
        page,
        x,
        card_rect.y0 + 68,
        top_left_width - 4,
        token_text,
        fontname="cour",
        fontsize=7.1,
        color=GRAY,
        line_height=1.16,
    )

    signature_box = fitz.Rect(card_rect.x1 - signature_width, card_rect.y0, card_rect.x1, top_rect.y1)
    page.draw_line(
        fitz.Point(signature_box.x0, signature_box.y0),
        fitz.Point(signature_box.x0, signature_box.y1),
        color=LGRAY,
        width=0.8,
    )
    page.insert_text(
        fitz.Point(signature_box.x0 + 10, card_rect.y0 + 22),
        "Assinatura",
        fontname="hebo",
        fontsize=8,
        color=GRAY,
    )
    sig_data = sig.get("signature_data") or {}
    typed_name = sig_data.get("typed_name") or sig.get("identity_name") or sig.get("name") or ""
    _insert_sig_image(
        page,
        sig_data.get("signature_image_base64"),
        fitz.Rect(signature_box.x0 + 10, card_rect.y0 + 26, signature_box.x1 - 10, top_rect.y1 - 24),
        typed_name if not sig_data.get("signature_image_base64") else None,
    )
    page.insert_textbox(
        fitz.Rect(signature_box.x0 + 8, top_rect.y1 - 22, signature_box.x1 - 8, top_rect.y1 - 6),
        typed_name or "-",
        fontname="helv",
        fontsize=7.2,
        color=BLACK,
        align=1,
    )

    auth_y = top_rect.y1 + 16
    page.insert_text(
        fitz.Point(card_rect.x0 + 10, auth_y),
        "Pontos de autenticacao:",
        fontname="hebo",
        fontsize=8.2,
        color=BLACK,
    )

    row_y = auth_y + 8
    left_x = card_rect.x0 + 10
    right_x = left_x + column_width + column_gap
    for left_item, right_item in auth_pairs:
        left_text = f"{left_item[0]}: {left_item[1]}"
        right_text = f"{right_item[0]}: {right_item[1]}"
        left_height = _text_block_height(left_text, column_width, fontname="helv", fontsize=7.9, line_height=1.16)
        right_height = _text_block_height(right_text, column_width, fontname="helv", fontsize=7.9, line_height=1.16)
        row_height = max(left_height, right_height)
        _draw_wrapped_text(
            page,
            left_x,
            row_y,
            column_width,
            left_text,
            fontname="helv",
            fontsize=7.9,
            color=BLACK,
            line_height=1.16,
        )
        _draw_wrapped_text(
            page,
            right_x,
            row_y,
            column_width,
            right_text,
            fontname="helv",
            fontsize=7.9,
            color=BLACK,
            line_height=1.16,
        )
        row_y += row_height + 4

    summary_top = row_y + 4
    _draw_wrapped_text(
        page,
        card_rect.x0 + 10,
        summary_top,
        inner_width,
        summary_text,
        fontname="helv",
        fontsize=6.7,
        color=GRAY,
        line_height=1.12,
    )

    return card_rect.y1


def _draw_integrity_box(
    page: fitz.Page,
    y: float,
    verification_code: str,
    verification_url: str,
    institutional_info: InstitutionalSignatureInfo,
) -> float:
    if institutional_info.configured:
        title = "INTEGRIDADE CERTIFICADA - ICP-BRASIL"
        subtitle = (
            f"PDF final selado institucionalmente por {institutional_info.signer_name or 'Uptech Sign'} "
            f"em {institutional_info.profile or 'PAdES-B-B'}."
        )
        detail = (
            f"Emissor: {institutional_info.issuer_name or 'ICP-Brasil'} | "
            f"Serial: {institutional_info.certificate_serial or '-'}"
        )
    else:
        title = "INTEGRIDADE INSTITUCIONAL PENDENTE"
        subtitle = (
            "O documento permanece verificavel por hash, trilha de auditoria e codigo publico, "
            "mas ainda nao recebeu selagem institucional ICP-Brasil."
        )
        detail = "Adicione um arquivo PFX/P12 institucional ao backend para ativar a assinatura final automatica."

    left_width = CW - 116
    verification_text = "Confirme a integridade do documento aqui."
    footer_text = (
        f"Uptech Sign {verification_code}. Documento assinado eletronicamente "
        "conforme MP 2.200-2/2001 e Lei 14.063/2020."
    )
    legal_text = (
        "Assinaturas eletronicas possuem validade juridica quando acompanhadas "
        "de mecanismos de autenticacao, integridade e auditoria."
    )
    subtitle_height = _text_block_height(subtitle, left_width, fontname="helv", fontsize=8.5, line_height=1.12)
    detail_height = _text_block_height(detail, left_width, fontname="helv", fontsize=7.8, line_height=1.1)
    legal_height = _text_block_height(legal_text, left_width, fontname="helv", fontsize=7.4, line_height=1.1)
    verification_height = _text_block_height(verification_text, left_width, fontname="helv", fontsize=7.5, line_height=1.1)
    url_height = _text_block_height(verification_url, left_width, fontname="helv", fontsize=7.2, line_height=1.08)
    footer_height = _text_block_height(footer_text, left_width, fontname="helv", fontsize=7.0, line_height=1.08)
    box_height = max(88, 20 + subtitle_height + detail_height + legal_height + verification_height + url_height + footer_height + 24)

    box_rect = fitz.Rect(ML, y + 14, PW - MR, y + 14 + box_height)
    page.draw_line(fitz.Point(box_rect.x0, box_rect.y0), fitz.Point(box_rect.x1, box_rect.y0), color=LGRAY, width=0.8)
    page.draw_line(fitz.Point(box_rect.x0, box_rect.y1), fitz.Point(box_rect.x1, box_rect.y1), color=LGRAY, width=0.8)

    page.draw_rect(
        fitz.Rect(box_rect.x0 + 12, box_rect.y0 + 12, box_rect.x0 + 96, box_rect.y0 + 16),
        color=BLUE,
        fill=BLUE,
        width=0,
    )
    page.insert_text(
        fitz.Point(box_rect.x0 + 12, box_rect.y0 + 28),
        title,
        fontname="hebo",
        fontsize=10.6,
        color=BLACK,
    )
    cursor = box_rect.y0 + 28
    cursor = _draw_wrapped_text(
        page,
        box_rect.x0 + 12,
        cursor,
        left_width,
        subtitle,
        fontname="helv",
        fontsize=8.5,
        color=BLACK,
        line_height=1.12,
    ) + 4
    cursor = _draw_wrapped_text(
        page,
        box_rect.x0 + 12,
        cursor,
        left_width,
        detail,
        fontname="helv",
        fontsize=7.8,
        color=GRAY,
        line_height=1.1,
    ) + 4
    cursor = _draw_wrapped_text(
        page,
        box_rect.x0 + 12,
        cursor,
        left_width,
        legal_text,
        fontname="helv",
        fontsize=7.4,
        color=GRAY,
        line_height=1.1,
    ) + 4
    cursor = _draw_wrapped_text(
        page,
        box_rect.x0 + 12,
        cursor,
        left_width,
        verification_text,
        fontname="helv",
        fontsize=7.5,
        color=BLUE,
        line_height=1.1,
    ) + 2
    cursor = _draw_wrapped_text(
        page,
        box_rect.x0 + 12,
        cursor,
        left_width,
        verification_url,
        fontname="helv",
        fontsize=7.2,
        color=BLACK,
        line_height=1.08,
    ) + 4
    _draw_wrapped_text(
        page,
        box_rect.x0 + 12,
        cursor,
        left_width,
        footer_text,
        fontname="helv",
        fontsize=7.0,
        color=GRAY,
        line_height=1.08,
    )
    page.insert_text(
        fitz.Point(box_rect.x1 - 92, box_rect.y0 + 30),
        "ICP",
        fontname="hebo",
        fontsize=19,
        color=GRAPHITE,
    )
    page.insert_text(
        fitz.Point(box_rect.x1 - 92, box_rect.y0 + 48),
        "Brasil",
        fontname="hebo",
        fontsize=15,
        color=GRAPHITE,
    )
    page.insert_text(
        fitz.Point(box_rect.x1 - 92, box_rect.y0 + 70),
        "Integridade",
        fontname="helv",
        fontsize=7.5,
        color=GRAY,
    )
    page.insert_text(
        fitz.Point(box_rect.x1 - 92, box_rect.y0 + 83),
        institutional_info.profile or "PAdES-B-B",
        fontname="hebo",
        fontsize=7.8,
        color=BLUE if institutional_info.configured else AMBER,
    )

    return box_rect.y1


def generate_certificate_pdf_sync(
    document_title: str,
    document_number: str,
    document_created_at,
    document_hash: str,
    signatories: list[dict],
    output_path: str,
    verification_code: str,
    verification_url: str,
    institutional_info: InstitutionalSignatureInfo,
) -> None:
    doc = fitz.open()
    page = _new_certificate_page(doc)
    y = 104

    y = _draw_summary_box(
        page,
        document_title,
        document_number,
        document_created_at,
        document_hash,
        verification_code,
        verification_url,
        signatories,
        y,
    )
    y = _draw_signatures_heading(page, y + 16, signatories)

    estimated_card_height = 220
    for signatory in signatories:
        if y + estimated_card_height > PH - 120:
            page = _new_certificate_page(doc)
            y = 104
        y = _draw_signatory_card(page, signatory, y) + 16

    if y + 120 > PH - 24:
        page = _new_certificate_page(doc)
        y = 104
    _draw_integrity_box(page, y, verification_code, verification_url, institutional_info)

    doc.save(output_path)
    doc.close()


def _get_initials(name: str | None) -> str:
    if not name:
        return "VS"
    parts = [part[0].upper() for part in name.split() if part]
    return "".join(parts[:3]) or "VS"


def _draw_signature_stamp(page: fitz.Page, rect: fitz.Rect, signatory: dict) -> None:
    sig_data = signatory.get("signature_data") or {}
    typed_name = sig_data.get("typed_name") or signatory.get("identity_name") or signatory.get("name") or "Assinado"
    signed_at = _format_dt(signatory.get("signed_at"), with_timezone=False)
    method_label = "OTP por email" if signatory.get("auth_require_email_otp") else "Assinatura eletronica"

    page.draw_rect(rect, color=LGRAY, fill=WHITE, width=0.8)

    if rect.width >= 150:
        image_rect = fitz.Rect(rect.x0 + 8, rect.y0 + 8, rect.x0 + rect.width * 0.55, rect.y1 - 18)
        info_rect = fitz.Rect(image_rect.x1 + 8, rect.y0 + 8, rect.x1 - 8, rect.y1 - 8)
        _insert_sig_image(page, sig_data.get("signature_image_base64"), image_rect, typed_name if not sig_data.get("signature_image_base64") else None)
        page.draw_line(
            fitz.Point(info_rect.x0 - 4, rect.y0 + 8),
            fitz.Point(info_rect.x0 - 4, rect.y1 - 8),
            color=LGRAY,
            width=0.6,
        )
        page.insert_textbox(
            info_rect,
            f"Assinado eletronicamente por\n{typed_name}\nData: {signed_at}\nMetodo: {method_label}",
            fontname="helv",
            fontsize=max(6.8, min(rect.height * 0.15, 9.2)),
            color=GRAY,
        )
    else:
        _insert_sig_image(
            page,
            sig_data.get("signature_image_base64"),
            fitz.Rect(rect.x0 + 6, rect.y0 + 4, rect.x1 - 6, rect.y1 - 16),
            typed_name if not sig_data.get("signature_image_base64") else None,
        )
        page.insert_textbox(
            fitz.Rect(rect.x0 + 4, rect.y1 - 16, rect.x1 - 4, rect.y1 - 2),
            f"{typed_name} | {signed_at}",
            fontname="helv",
            fontsize=6.4,
            color=GRAY,
            align=1,
        )

    page.draw_line(
        fitz.Point(rect.x0 + 4, rect.y1 - 1.5),
        fitz.Point(rect.x1 - 4, rect.y1 - 1.5),
        color=BLACK,
        width=0.8,
    )


def _draw_signature_field(page: fitz.Page, rect: fitz.Rect, field: dict, signatory: dict) -> None:
    sig_data = signatory.get("signature_data") or {}
    typed_name = sig_data.get("typed_name") or signatory.get("name") or "Assinado"

    if field.get("field_type") == "signature":
        _draw_signature_stamp(page, rect, signatory)
        return

    page.draw_rect(rect, color=LGRAY, fill=WHITE, width=0.8)

    if field.get("field_type") == "initials":
        page.draw_rect(rect, color=LGRAY, fill=LLGRAY, width=0.8)
        page.insert_textbox(
            rect,
            _get_initials(typed_name),
            fontname="hebo",
            fontsize=max(10, min(rect.height * 0.55, rect.width * 0.22)),
            color=BLACK,
            align=1,
        )
        return

    value = field.get("value") or typed_name
    page.insert_textbox(
        fitz.Rect(rect.x0 + 4, rect.y0 + 4, rect.x1 - 4, rect.y1 - 4),
        value,
        fontname="helv",
        fontsize=max(8, min(rect.height * 0.35, 14)),
        color=BLACK,
        align=0,
    )


def apply_signature_fields_to_pdf_sync(
    original_pdf_path: str,
    signatories_data: list[dict],
    fields_data: list[dict],
    output_path: str,
) -> None:
    signatories_by_id = {sig.get("id"): sig for sig in signatories_data}
    document = fitz.open(original_pdf_path)

    for field in fields_data:
        page_number = int(field.get("page") or 1)
        if page_number < 1 or page_number > len(document):
            continue

        signatory = signatories_by_id.get(field.get("signatory_id"))
        if not signatory:
            continue

        page = document[page_number - 1]
        page_rect = page.rect
        x = float(field.get("x") or 0)
        y = float(field.get("y") or 0)
        width = float(field.get("width") or 0)
        height = float(field.get("height") or 0)

        rect = fitz.Rect(
            x * page_rect.width,
            y * page_rect.height,
            (x + width) * page_rect.width,
            (y + height) * page_rect.height,
        )
        _draw_signature_field(page, rect, field, signatory)

    document.save(output_path)
    document.close()


def append_certificate_to_pdf_sync(
    original_pdf_path: str,
    certificate_pdf_path: str,
    output_path: str,
) -> None:
    original = fitz.open(original_pdf_path)
    certificate = fitz.open(certificate_pdf_path)
    original.insert_pdf(certificate)
    original.save(output_path)
    original.close()
    certificate.close()


async def generate_partial_signed_document(
    document_id: str,
    original_pdf_path: str,
    signatories_data: list[dict],
    fields_data: list[dict],
) -> tuple[str, str]:
    """Generate the latest partial signed PDF without the certificate appendix."""
    doc_dir = document_dir(document_id)
    partial_path = str(doc_dir / random_filename(".pdf"))
    await asyncio.to_thread(
        apply_signature_fields_to_pdf_sync,
        original_pdf_path,
        signatories_data,
        fields_data,
        partial_path,
    )
    partial_hash = sha256_file(partial_path)
    return partial_path, partial_hash


async def generate_signed_document(
    document_id: str,
    document_title: str,
    document_number: str,
    document_created_at,
    original_pdf_path: str,
    signatories_data: list[dict],
    fields_data: list[dict],
    verification_code: str,
    verification_url: str,
) -> tuple[str, str, str, str]:
    doc_dir = document_dir(document_id)
    original_hash = sha256_file(original_pdf_path)
    institutional_info = get_institutional_signature_info()

    cert_path = str(doc_dir / random_filename(".pdf"))
    await asyncio.to_thread(
        generate_certificate_pdf_sync,
        document_title,
        document_number,
        document_created_at,
        original_hash,
        signatories_data,
        cert_path,
        verification_code,
        verification_url,
        institutional_info,
    )

    positioned_path = str(doc_dir / random_filename(".pdf"))
    await asyncio.to_thread(
        apply_signature_fields_to_pdf_sync,
        original_pdf_path,
        signatories_data,
        fields_data,
        positioned_path,
    )

    unsigned_output_path = str(doc_dir / random_filename(".pdf"))
    await asyncio.to_thread(
        append_certificate_to_pdf_sync,
        positioned_path,
        cert_path,
        unsigned_output_path,
    )

    if institutional_info.configured:
        signed_path = str(doc_dir / random_filename(".pdf"))
        await asyncio.to_thread(
            sign_pdf_with_institutional_certificate_sync,
            unsigned_output_path,
            signed_path,
        )
        Path(unsigned_output_path).unlink(missing_ok=True)
    else:
        signed_path = unsigned_output_path

    signed_hash = sha256_file(signed_path)
    cert_hash = sha256_file(cert_path)
    return signed_path, signed_hash, cert_path, cert_hash
