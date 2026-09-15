"""Checking and storing uploaded pictures.

Kept out of the routers so every upload -- an event's cover, a venue's photo, a
user's avatar -- goes through the same rules, and so a router with its own
access checks can use them without importing another router.
"""
import os
import uuid

from fastapi import HTTPException

UPLOAD_ROOT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
)
EVENT_IMAGE_DIR = os.path.join(UPLOAD_ROOT, "events")
AVATAR_DIR = os.path.join(UPLOAD_ROOT, "avatars")
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


def _store(payload: bytes, directory: str, prefix: str, stem: str = "") -> str:
    """Check, write, and return the site-relative address of a picture.

    The name is generated, never the uploaded one, which is caller-supplied and
    could carry path separators out of the directory. The address is relative
    to the site root, so it survives the tunnel changing host.
    """
    extension = accept_image(payload)
    os.makedirs(directory, exist_ok=True)
    stored = f"{stem}{uuid.uuid4().hex}{extension}"
    with open(os.path.join(directory, stored), "wb") as handle:
        handle.write(payload)
    return f"{prefix}{stored}"


def _drop(url: str | None, directory: str, prefix: str) -> None:
    """Remove a stored picture nothing points at any more.

    Only ever touches files under its own directory, and by basename, so a
    stored address cannot be bent into deleting anything else. A failure is
    swallowed: the row is already correct, and a stray file is not worth a
    failed request.
    """
    if not url or not url.startswith(prefix):
        return
    try:
        path = os.path.join(directory, os.path.basename(url))
        if os.path.isfile(path):
            os.remove(path)
    except OSError:
        pass


def store_event_image(payload: bytes) -> str:
    return _store(payload, EVENT_IMAGE_DIR, "/uploads/events/")


def drop_event_image(url: str | None) -> None:
    _drop(url, EVENT_IMAGE_DIR, "/uploads/events/")


def store_avatar(payload: bytes, user_id: int) -> str:
    # A fresh name on every upload, so a browser holding the old picture in its
    # cache cannot keep showing it.
    return _store(payload, AVATAR_DIR, "/uploads/avatars/", stem=f"{user_id}-")


def drop_avatar(url: str | None) -> None:
    _drop(url, AVATAR_DIR, "/uploads/avatars/")
