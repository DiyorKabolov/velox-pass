"""Checking and storing uploaded pictures.

Kept out of the routers so every upload -- an event's cover, a venue's photo --
goes through the same rules, and so a router with its own access checks can use
them without importing another router.
"""
import os
import uuid

from fastapi import HTTPException

UPLOAD_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
)
EVENT_IMAGE_DIR = os.path.join(UPLOAD_ROOT, "events")
MAX_IMAGE_BYTES = 5 * 1024 * 1024

# Magic numbers, not the filename or the declared content type: both come from
# the caller and neither says what the bytes actually are.
IMAGE_SIGNATURES = [
    (bytes.fromhex("ffd8ff"), ".jpg"),
    (bytes.fromhex("89504e470d0a1a0a"), ".png"),
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
    (b"RIFF", ".webp"),  # confirmed against the WEBP tag below
]


def image_extension(payload: bytes) -> str | None:
    for signature, extension in IMAGE_SIGNATURES:
        if not payload.startswith(signature):
            continue
        if extension == ".webp" and payload[8:12] != b"WEBP":
            continue
        return extension
    return None


def accept_image(payload: bytes) -> str:
    """Whether these bytes may be stored, and as what. Raises if they may not."""
    if not payload:
        raise HTTPException(status_code=400, detail="Файл пустой")
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Изображение больше 5 МБ")

    extension = image_extension(payload)
    if extension is None:
        raise HTTPException(
            status_code=400, detail="Нужен файл JPEG, PNG, GIF или WebP"
        )
    return extension


def store_event_image(payload: bytes) -> str:
    """Save a checked cover and return the address to put on the event.

    The name is generated, never the uploaded one, which is caller-supplied and
    could carry path separators out of the directory. The address is relative
    to the site root, so it survives the tunnel changing host.
    """
    extension = accept_image(payload)
    os.makedirs(EVENT_IMAGE_DIR, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{extension}"
    with open(os.path.join(EVENT_IMAGE_DIR, stored), "wb") as handle:
        handle.write(payload)
    return f"/uploads/events/{stored}"


def drop_event_image(url: str | None) -> None:
    """Remove a cover file the event no longer points at.

    Only ever touches files under uploads/events, and by basename, so a stored
    address cannot be bent into deleting anything else. A failure is swallowed:
    the row is already correct, and a stray file is not worth a failed request.
    """
    if not url or not url.startswith("/uploads/events/"):
        return
    try:
        path = os.path.join(EVENT_IMAGE_DIR, os.path.basename(url))
        if os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass
