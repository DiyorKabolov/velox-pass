from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserVenueRole(Base):
    """Grants a user a role scoped to one venue (venue_admin or scanner)."""

    __tablename__ = "user_venue_roles"
    __table_args__ = (UniqueConstraint("user_id", "venue_id", name="uq_user_venue"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    venue_id: Mapped[int] = mapped_column(
        ForeignKey("venues.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # venue_admin | scanner
    role: Mapped[str] = mapped_column(String(32), default="scanner", nullable=False)
    # Nullable because grants made before this column existed have no date to
    # give; inventing one for them would be worse than admitting it is unknown.
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=True,
    )

    user = relationship("User", back_populates="venue_roles")
    venue = relationship("Venue", back_populates="user_roles")

    def __repr__(self) -> str:
        return f"<UserVenueRole u{self.user_id} v{self.venue_id} {self.role}>"
