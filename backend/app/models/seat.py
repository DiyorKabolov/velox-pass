from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Seat(Base):
    __tablename__ = "seats"
    __table_args__ = (UniqueConstraint("hall_id", "row", "col", name="uq_seat_position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hall_id: Mapped[int] = mapped_column(
        ForeignKey("halls.id", ondelete="CASCADE"), index=True, nullable=False
    )
    row: Mapped[int] = mapped_column(Integer, nullable=False)
    col: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # standard | vip | balcony | ...
    category: Mapped[str] = mapped_column(String(64), default="standard", nullable=False)
    # Aisle cells keep the grid aligned but cannot be sold.
    is_aisle: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    hall = relationship("Hall", back_populates="seats")
    tickets = relationship("Ticket", back_populates="seat")

    def __repr__(self) -> str:
        return f"<Seat {self.id} r{self.row}c{self.col}>"
