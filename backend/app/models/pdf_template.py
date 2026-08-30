from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PdfTemplate(Base):
    """An uploaded PDF used as the artwork behind a ticket.

    The file itself is only the background; layout_json says where the QR code
    and each text field are stamped onto it.
    """

    __tablename__ = "pdf_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Relative to backend/uploads, so moving the project does not break the row.
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    layout_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    events = relationship("Event", back_populates="template")

    def __repr__(self) -> str:
        return f"<PdfTemplate {self.id} {self.name}>"
