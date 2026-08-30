from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PdfTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    file_path: str
    is_default: bool
    layout_json: str | None = None
    created_at: datetime

    # Filled by the router so the admin list can warn about templates nothing
    # would render correctly.
    element_count: int = 0


class PdfTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    layout_json: str | None = None
    is_default: bool | None = None


class EventTemplateUpdate(BaseModel):
    """null puts the event back on whichever template is marked default."""

    template_id: int | None = None
