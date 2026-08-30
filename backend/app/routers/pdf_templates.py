"""Upload, layout and preview of the PDF ticket templates. Superadmin only."""
import json
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_superadmin
from app.models.event import Event
from app.models.pdf_template import PdfTemplate
from app.schemas.pdf_template import (
    EventTemplateUpdate,
    PdfTemplateOut,
    PdfTemplateUpdate,
)
from app.services import pdf_render

router = APIRouter(
    prefix="/admin/pdf-templates",
    tags=["pdf-templates"],
    dependencies=[Depends(require_superadmin)],
)

# backend/uploads/templates
UPLOAD_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
)
TEMPLATE_DIR = os.path.join(UPLOAD_ROOT, "templates")
# Rendered previews, regenerated whenever the source PDF is newer.
CACHE_DIR = os.path.join(UPLOAD_ROOT, "previews")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _abs_path(template: PdfTemplate) -> str:
    """file_path is stored relative to uploads/, so the rows survive a move."""
    return os.path.join(UPLOAD_ROOT, template.file_path.replace("/", os.sep))


def _out(template: PdfTemplate) -> PdfTemplateOut:
    payload = PdfTemplateOut.model_validate(template)
    payload.element_count = len(pdf_render.parse_layout(template.layout_json)["elements"])
    return payload


async def _get(db: AsyncSession, template_id: int) -> PdfTemplate:
    template = await db.get(PdfTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return template


async def _clear_other_defaults(db: AsyncSession, keep_id: int) -> None:
    await db.execute(
        update(PdfTemplate)
        .where(PdfTemplate.id != keep_id, PdfTemplate.is_default.is_(True))
        .values(is_default=False)
    )


@router.post("/upload", response_model=PdfTemplateOut, status_code=201)
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    if not name.strip():
        raise HTTPException(status_code=400, detail="Укажите название шаблона")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Файл пустой")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Файл больше 10 МБ")
    # The magic number, not the filename or the declared content type: both are
    # supplied by the caller and neither says what the bytes actually are.
    if not payload.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Это не PDF-файл")

    os.makedirs(TEMPLATE_DIR, exist_ok=True)
    # A generated name, never the uploaded one: a filename is attacker-supplied
    # and could carry path separators out of the directory.
    stored = f"{uuid.uuid4().hex}.pdf"
    with open(os.path.join(TEMPLATE_DIR, stored), "wb") as handle:
        handle.write(payload)

    template = PdfTemplate(
        name=name.strip(),
        file_path=f"templates/{stored}",
        is_default=False,
        layout_json=json.dumps(
            {
                "page_width": pdf_render.PAGE_WIDTH,
                "page_height": pdf_render.PAGE_HEIGHT,
                "elements": [],
            }
        ),
    )
    db.add(template)
    await db.flush()

    # The very first template becomes the default: uploading one and seeing
    # nothing change on the tickets would be a puzzle.
    if not await db.scalar(
        select(PdfTemplate.id).where(
            PdfTemplate.is_default.is_(True), PdfTemplate.id != template.id
        )
    ):
        template.is_default = True

    await db.flush()
    await db.refresh(template)
    return _out(template)


@router.get("", response_model=list[PdfTemplateOut])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PdfTemplate).order_by(PdfTemplate.created_at.desc()))
    return [_out(template) for template in result.scalars().all()]


@router.get("/{template_id}", response_model=PdfTemplateOut)
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    return _out(await _get(db, template_id))


@router.patch("/{template_id}", response_model=PdfTemplateOut)
async def update_template(
    template_id: int,
    data: PdfTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    template = await _get(db, template_id)
    fields = data.model_dump(exclude_unset=True)

    if "layout_json" in fields and fields["layout_json"] is not None:
        try:
            parsed = json.loads(fields["layout_json"])
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="layout_json не разбирается")
        if not isinstance(parsed, dict) or not isinstance(parsed.get("elements"), list):
            raise HTTPException(
                status_code=400, detail="layout_json должен содержать список elements"
            )

    if fields.get("is_default"):
        await _clear_other_defaults(db, template.id)

    for field, value in fields.items():
        setattr(template, field, value)

    await db.flush()
    await db.refresh(template)
    return _out(template)


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)):
    template = await _get(db, template_id)
    path = _abs_path(template)

    # Events pointing at it fall back to the default; the FK is ON DELETE SET
    # NULL, so this only has to clear the cached preview and the file.
    await db.delete(template)
    await db.flush()

    for candidate in (path, os.path.join(CACHE_DIR, f"{template_id}.png")):
        try:
            if os.path.isfile(candidate):
                os.remove(candidate)
        except OSError:
            # The row is already gone; a stray file is not worth failing over.
            pass


@router.get("/{template_id}/preview-image")
async def preview_image(template_id: int, db: AsyncSession = Depends(get_db)):
    template = await _get(db, template_id)
    source = _abs_path(template)
    if not os.path.isfile(source):
        raise HTTPException(status_code=404, detail="Файл шаблона не найден")

    os.makedirs(CACHE_DIR, exist_ok=True)
    cached = os.path.join(CACHE_DIR, f"{template_id}.png")

    # Keyed on the PDF's mtime, not on the layout: the layout is drawn by the
    # browser over this image, so it never changes the picture underneath.
    fresh = (
        os.path.isfile(cached)
        and os.path.getmtime(cached) >= os.path.getmtime(source)
    )
    if fresh:
        with open(cached, "rb") as handle:
            png = handle.read()
    else:
        try:
            png = pdf_render.render_preview_png(source)
        except Exception as exc:  # noqa: BLE001 - surface the real reason
            raise HTTPException(
                status_code=500, detail=f"Не удалось отрисовать PDF: {exc}"
            )
        with open(cached, "wb") as handle:
            handle.write(png)

    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "no-cache"},
    )


# Mounted on its own prefix: it belongs to the event, not to the template list.
event_router = APIRouter(
    prefix="/admin/events", tags=["pdf-templates"],
    dependencies=[Depends(require_superadmin)],
)


@event_router.patch("/{event_id}/template")
async def set_event_template(
    event_id: int,
    data: EventTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")

    if data.template_id is not None:
        await _get(db, data.template_id)

    event.template_id = data.template_id
    await db.flush()
    return {"event_id": event.id, "template_id": event.template_id}
