from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Venue(Base):
    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # theatre | cinema | stadium | club | other
    type: Mapped[str] = mapped_column(String(64), default="other", nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    halls = relationship("Hall", back_populates="venue", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="venue")
    user_roles = relationship(
        "UserVenueRole", back_populates="venue", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Venue {self.id} {self.name}>"
