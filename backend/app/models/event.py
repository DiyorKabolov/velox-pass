from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # When true, tickets are bound to a seat from the venue hall map.
    has_seats: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    venue_id: Mapped[int | None] = mapped_column(
        ForeignKey("venues.id", ondelete="SET NULL"), index=True, nullable=True
    )

    # Per-event ticket card theming, rendered by the frontend TicketCard.
    card_bg: Mapped[str] = mapped_column(String(32), default="#fdfdf5", nullable=False)
    card_accent: Mapped[str] = mapped_column(String(32), default="#a898e0", nullable=False)
    card_text: Mapped[str] = mapped_column(String(32), default="#2a2a2a", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    venue = relationship("Venue", back_populates="events")
    sessions = relationship("Session", back_populates="event", cascade="all, delete-orphan")
    tickets = relationship("Ticket", back_populates="event", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Event {self.id} {self.title}>"
