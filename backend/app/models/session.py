from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Session(Base):
    """A single showing of an event in a specific hall."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True, nullable=False
    )
    hall_id: Mapped[int | None] = mapped_column(
        ForeignKey("halls.id", ondelete="SET NULL"), index=True, nullable=True
    )
    # The column name "datetime" shadows the stdlib module inside this class
    # only; it is part of the agreed schema.
    datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # scheduled | on_sale | sold_out | cancelled | finished
    status: Mapped[str] = mapped_column(String(32), default="scheduled", nullable=False)

    event = relationship("Event", back_populates="sessions")
    hall = relationship("Hall", back_populates="sessions")
    prices = relationship(
        "SeatPrice", back_populates="session", cascade="all, delete-orphan"
    )
    tickets = relationship("Ticket", back_populates="session")

    def __repr__(self) -> str:
        return f"<Session {self.id} event={self.event_id}>"
