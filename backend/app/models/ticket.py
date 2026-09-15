from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, text, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        # One ticket per seat per showing, enforced by the database. The
        # purchase checks first, but two buyers checking at the same moment
        # would both find the seat free.
        Index(
            "uq_ticket_seat_per_session",
            "session_id",
            "seat_id",
            unique=True,
            postgresql_where=text("seat_id IS NOT NULL"),
        ),
    )

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
    # Set the moment a scanner burns the ticket; None while unused.
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    price_paid: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    # A gift in progress or given. gifted_by is whoever gave it; while
    # gift_status is 'pending' the ticket already sits with its recipient
    # but may not be used. gift_token is the secret in the e-mailed links.
    gifted_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    gift_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    gift_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    gift_token: Mapped[str | None] = mapped_column(
        String(36), unique=True, index=True, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Two keys into users now, so each relationship names its own.
    user = relationship("User", back_populates="tickets", foreign_keys=[user_id])
    gifter = relationship("User", foreign_keys=[gifted_by], lazy="selectin")
    event = relationship("Event", back_populates="tickets")
    seat = relationship("Seat", back_populates="tickets")
    # Always loaded with the ticket: when a ticket is valid depends on its
    # showing, not on the event, and an unloaded relationship read inside
    # async code raises MissingGreenlet instead of loading.
    session = relationship("Session", back_populates="tickets", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Ticket {self.ticket_id}>"
