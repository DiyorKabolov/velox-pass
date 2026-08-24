from sqlalchemy import ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SeatPrice(Base):
    """Price of one seat category within a session."""

    __tablename__ = "seat_prices"
    __table_args__ = (
        UniqueConstraint("session_id", "category", name="uq_seat_price_category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    session = relationship("Session", back_populates="prices")

    def __repr__(self) -> str:
        return f"<SeatPrice {self.category} {self.price}>"
