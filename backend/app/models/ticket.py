from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Public, shareable identifier encoded into the QR code.
    ticket_id: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True, nullable=False
    )
    seat_id: Mapped[int | None] = mapped_column(
        ForeignKey("seats.id", ondelete="SET NULL"), index=True, nullable=True
    )
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("sessions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    price_paid: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="tickets")
    event = relationship("Event", back_populates="tickets")
    seat = relationship("Seat", back_populates="tickets")
    session = relationship("Session", back_populates="tickets")

    def __repr__(self) -> str:
        return f"<Ticket {self.ticket_id}>"
