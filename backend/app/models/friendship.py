import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

FRIENDSHIP_STATUSES = ("pending", "accepted", "declined")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Friendship(Base):
    """A friend request, and -- once accepted -- the friendship itself.

    One row per pair of users, whichever of them asked. The requester and
    addressee are kept because they matter while the request is open (only the
    addressee may answer it); after that the friendship is symmetrical.
    """

    __tablename__ = "friendships"
    __table_args__ = (
        CheckConstraint("requester_id <> addressee_id", name="ck_friendship_not_self"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined')", name="ck_friendship_status"
        ),
        UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_direction"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    requester_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    addressee_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    # The secret in the e-mailed links. Whoever holds it may answer the
    # request, so it is random rather than derived from anything guessable.
    token: Mapped[str] = mapped_column(
        String(36),
        default=lambda: str(uuid.uuid4()),
        unique=True,
        index=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Friendship {self.requester_id}->{self.addressee_id} {self.status}>"


# The direction constraint above allows A->B and B->A as two rows, and two
# people asking each other at the same moment would create exactly that. This
# index makes a pair unique whichever way round it was written, so the database
# refuses the second row rather than the application having to notice.
Index(
    "uq_friendship_pair",
    func.least(Friendship.requester_id, Friendship.addressee_id),
    func.greatest(Friendship.requester_id, Friendship.addressee_id),
    unique=True,
)
