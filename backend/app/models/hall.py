from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Hall(Base):
    __tablename__ = "halls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    venue_id: Mapped[int] = mapped_column(
        ForeignKey("venues.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cols: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Free-form seat map description consumed by the frontend hall editor.
    layout_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    venue = relationship("Venue", back_populates="halls")
    seats = relationship("Seat", back_populates="hall", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="hall")

    def __repr__(self) -> str:
        return f"<Hall {self.id} {self.name}>"
