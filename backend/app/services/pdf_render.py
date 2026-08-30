"""Stamping ticket data onto an uploaded PDF template.

The template PDF is untouched artwork. Everything variable -- the QR code and
the text fields -- is drawn onto a transparent overlay page of the same size and
merged on top, so re-rendering never degrades the original.
"""
import io
import json
import os
from typing import Any

from PyPDF2 import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdf_canvas

# A4 in PDF points, the frame the editor lays out against.
PAGE_WIDTH = 595
PAGE_HEIGHT = 842

# Fields the editor can place, and the label shown while the layout is empty.
TEXT_FIELDS = {
    "event_title": "Название события",
    "date": "Дата",
    "location": "Место проведения",
    "buyer_name": "Имя покупателя",
    "seat": "Место в зале",
    "ticket_id": "ID билета",
}

# --- fonts ----------------------------------------------------------------
# reportlab's built-in Helvetica is Latin-1 only: every Cyrillic character comes
# out as a black box. The Vera faces it bundles have no Cyrillic either (checked
# against their cmap), so a system font has to be found. Falling back to
# Helvetica is deliberate -- a Latin-only ticket beats a crash -- but it is
# reported through FONT_WARNING so the cause is visible rather than mysterious.
_FONT_CANDIDATES = [
    # (regular, bold)
    (r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\arialbd.ttf"),
    (r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\segoeuib.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
     "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/Library/Fonts/Arial.ttf", "/Library/Fonts/Arial Bold.ttf"),
]

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_WARNING: str | None = (
    "Кириллица не поддерживается: не найден системный шрифт с ней. "
    "Текст на билете будет искажён."
)


def _register_fonts() -> None:
    global FONT_REGULAR, FONT_BOLD, FONT_WARNING
    for regular, bold in _FONT_CANDIDATES:
        if not os.path.exists(regular):
            continue
        try:
            pdfmetrics.registerFont(TTFont("VeloxSans", regular))
            bold_name = "VeloxSans"
            if os.path.exists(bold):
                pdfmetrics.registerFont(TTFont("VeloxSans-Bold", bold))
                bold_name = "VeloxSans-Bold"
            FONT_REGULAR, FONT_BOLD, FONT_WARNING = "VeloxSans", bold_name, None
            return
        except Exception:  # noqa: BLE001 - try the next candidate
            continue


_register_fonts()


# --- layout ---------------------------------------------------------------

def parse_layout(raw: str | None) -> dict[str, Any]:
    """layout_json as a dict, tolerating null, blank and malformed values.

    A template with a broken layout still renders -- as bare artwork -- which is
    far better than a 500 on the one endpoint a customer uses to get a ticket.
    """
    if not raw:
        return {"page_width": PAGE_WIDTH, "page_height": PAGE_HEIGHT, "elements": []}
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return {"page_width": PAGE_WIDTH, "page_height": PAGE_HEIGHT, "elements": []}
    if not isinstance(data, dict):
        return {"page_width": PAGE_WIDTH, "page_height": PAGE_HEIGHT, "elements": []}
    elements = data.get("elements")
    return {
        "page_width": float(data.get("page_width") or PAGE_WIDTH),
        "page_height": float(data.get("page_height") or PAGE_HEIGHT),
        "elements": [e for e in elements if isinstance(e, dict)] if isinstance(elements, list) else [],
    }


def _colour(value: Any):
    try:
        return HexColor(str(value))
    except Exception:  # noqa: BLE001 - any unparsable colour falls back to black
        return HexColor("#000000")


def _number(value: Any, fallback: float) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return fallback
    return result if result == result else fallback  # reject NaN


def render_overlay(
    layout: dict[str, Any],
    values: dict[str, str],
    qr_png: bytes | None,
    page_width: float,
    page_height: float,
) -> bytes:
    """One transparent page carrying the QR code and every text field."""
    buffer = io.BytesIO()
    pdf = pdf_canvas.Canvas(buffer, pagesize=(page_width, page_height))

    for element in layout["elements"]:
        kind = element.get("type")
        # x/y are in PDF points measured from the bottom-left, matching what the
        # editor stores, so nothing is converted here.
        x = _number(element.get("x"), 0)
        y = _number(element.get("y"), 0)

        if kind == "qr":
            if not qr_png:
                continue
            width = _number(element.get("width"), 120)
            height = _number(element.get("height"), 120)
            pdf.drawImage(
                ImageReader(io.BytesIO(qr_png)),
                x, y, width, height, mask="auto",
            )
            continue

        if kind != "text":
            continue

        text = values.get(element.get("field"), "")
        if not text:
            continue

        size = _number(element.get("font_size"), 12)
        bold = str(element.get("font_weight", "normal")).lower() == "bold"
        pdf.setFont(FONT_BOLD if bold else FONT_REGULAR, size)
        pdf.setFillColor(_colour(element.get("color", "#000000")))
        # y is the text baseline, which is what the editor's preview assumes.
        pdf.drawString(x, y, text)

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def compose(template_path: str, overlay_pdf: bytes) -> bytes:
    """Merge the overlay onto the template's first page."""
    base = PdfReader(template_path)
    overlay = PdfReader(io.BytesIO(overlay_pdf))

    page = base.pages[0]
    page.merge_page(overlay.pages[0])

    writer = PdfWriter()
    writer.add_page(page)
    # Any further pages of the template are kept as they are, so a two-sided
    # ticket design survives.
    for extra in base.pages[1:]:
        writer.add_page(extra)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def page_size(template_path: str) -> tuple[float, float]:
    """The template's own first-page size, so the overlay lines up with artwork
    that is not exactly A4."""
    try:
        box = PdfReader(template_path).pages[0].mediabox
        return float(box.width), float(box.height)
    except Exception:  # noqa: BLE001 - fall back to the size the editor assumes
        return float(PAGE_WIDTH), float(PAGE_HEIGHT)


def render_preview_png(template_path: str, width: int = 900) -> bytes:
    """First page as a PNG for the editor's canvas.

    PyMuPDF rather than pdf2image: pdf2image shells out to poppler's pdftoppm,
    which is not a Python package and is absent from this machine's PATH, so
    installing it alone would leave every preview request failing. PyMuPDF
    renders in-process with no external binary.
    """
    import fitz  # imported lazily: only this endpoint needs it

    with fitz.open(template_path) as document:
        page = document.load_page(0)
        zoom = width / page.rect.width if page.rect.width else 1
        pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        return pixmap.tobytes("png")
