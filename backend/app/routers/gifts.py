"""Giving a ticket to a friend.

A gift moves the ticket to its recipient at once -- it leaves the giver's
cabinet and waits in the recipient's -- but it is not theirs to use until they
accept. Until then the scanner turns it away and its QR code and PDF are
withheld.

The ticket's public code, the one in its QR, is replaced when the gift is made
and again if it is declined. The giver may still hold the old code on a PDF or
a screenshot, and without the change giving a ticket away would leave its old
owner able to walk in on it.

As with friend requests, the e-mailed links change nothing by themselves: mail
scanners open every link in a message, and a gift carrying both "accept" and
"decline" would be answered by a robot. The links lead to a page that asks.
"""
import asyncio
from datetime import datetime, timezone
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.friendship import Friendship
from app.models.seat import Seat
from app.models.ticket import Ticket
from app.models.user import User
from app.routers.friends import _public_base
from app.schemas.gift import GiftAnswer, GiftInviteOut, GiftRequest
from app.schemas.ticket import TicketOut
from app.services import mail_service, ticket_service

router = APIRouter(tags=["gifts"])

MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
]


def _starts_at(ticket: Ticket) -> datetime | None:
    if ticket.session is not None:
        return ticket.session.datetime
    return ticket.event.date if ticket.event else None


def _when_text(moment: datetime | None) -> str:
    """"15 сентября 2026, 19:00" in the server's local time, for the e-mail."""
    if moment is None:
        return ""
    local = moment.astimezone()
    return f"{local.day} {MONTHS[local.month - 1]} {local.year}, {local:%H:%M}"


def _seat_label(ticket: Ticket) -> str | None:
    seat = ticket.seat
    if seat is None:
        return None
    return f"Ряд {seat.row} · {seat.label or seat.col}"


async def _are_friends(db: AsyncSession, first: int, second: int) -> bool:
    return bool(
        await db.scalar(
            select(Friendship.id).where(
                Friendship.status == "accepted",
                or_(
                    and_(Friendship.requester_id == first, Friendship.addressee_id == second),
                    and_(Friendship.requester_id == second, Friendship.addressee_id == first),
                ),
            )
        )
    )


def _loaded(query):
    """The relations serialize_ticket reads, loaded up front: a lazy load inside
    async code raises MissingGreenlet instead of loading."""
    return query.options(
        selectinload(Ticket.event),
        selectinload(Ticket.seat).selectinload(Seat.hall),
    )


@router.post("/tickets/{ticket_id}/gift")
async def gift_ticket(
    ticket_id: str,
    data: GiftRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Give one of your tickets to a friend, and e-mail them about it."""
    ticket = await ticket_service.get_ticket_by_public_id(db, ticket_id)
    # Someone else's ticket reads as missing: no hint that the code exists.
    if ticket is None or ticket.user_id != user.id:
        raise HTTPException(status_code=404, detail="Билет не найден")
    if ticket.gift_status == "pending":
        raise HTTPException(status_code=409, detail="Этот билет уже ждёт ответа получателя")
    if ticket.used:
        raise HTTPException(status_code=409, detail="Билет уже использован")
    moment = _starts_at(ticket)
    if moment is not None and moment < datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="Мероприятие уже прошло")

    friend = await db.scalar(
        select(User).where(func.lower(User.username) == data.friend_username.strip().lower())
    )
    if friend is None or not await _are_friends(db, user.id, friend.id):
        raise HTTPException(status_code=403, detail="Можно дарить билеты только друзьям")

    ticket.gifted_by = user.id
    ticket.user_id = friend.id
    ticket.gift_status = "pending"
    ticket.gift_message = (data.message or "").strip() or None
    ticket.gift_token = str(uuid4())
    ticket.ticket_id = ticket_service.new_ticket_id()
    await db.flush()

    base = _public_base(request)
    token = quote(ticket.gift_token)
    event = ticket.event
    # SMTP is blocking; off the event loop, so a slow mail server stalls nobody else.
    mail_sent = await asyncio.to_thread(
        mail_service.send_gift_email,
        friend.email,
        user.username,
        ticket.gift_message,
        event.title if event else "мероприятие",
        _when_text(moment),
        event.location if event else None,
        f"{base}/api/gifts/accept/{token}",
        f"{base}/api/gifts/decline/{token}",
    )
    return {"message": "Билет подарен", "recipient": friend.username, "mail_sent": mail_sent}


def _to_answer_page(token: str, action: str) -> RedirectResponse:
    return RedirectResponse(
        f"/gifts/respond?token={quote(token)}&action={action}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


@router.get("/gifts/accept/{token}")
async def accept_link(token: str):
    """The "Принять подарок" link from the e-mail. Changes nothing -- see the module note."""
    return _to_answer_page(token, "accept")


@router.get("/gifts/decline/{token}")
async def decline_link(token: str):
    """The "Отклонить" link from the e-mail. Changes nothing either."""
    return _to_answer_page(token, "decline")


async def _by_token(db: AsyncSession, token: str, *, lock: bool = False) -> Ticket:
    query = _loaded(select(Ticket).where(Ticket.gift_token == token))
    if lock:
        # Accept and decline arriving together must not both apply.
        query = query.with_for_update(of=Ticket)
    ticket = await db.scalar(query)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Подарок не найден")
    return ticket


@router.get("/gifts/invite/{token}", response_model=GiftInviteOut)
async def gift_invite(token: str, db: AsyncSession = Depends(get_db, scope="function")):
    """What the gift is, for the page the e-mailed links open."""
    ticket = await _by_token(db, token)
    sender = await db.get(User, ticket.gifted_by) if ticket.gifted_by else None
    recipient = await db.get(User, ticket.user_id)
    event = ticket.event
    return GiftInviteOut(
        sender_username=sender.username if sender else "—",
        recipient_username=recipient.username if recipient else "—",
        event_title=event.title if event else "Мероприятие",
        starts_at=_starts_at(ticket),
        location=event.location if event else None,
        seat_label=_seat_label(ticket),
        message=ticket.gift_message,
        status=ticket.gift_status or "declined",
    )


async def _answer(db: AsyncSession, ticket: Ticket, action: str) -> str:
    """Apply an answer to a pending gift and return the resulting status."""
    if ticket.gift_status != "pending":
        raise HTTPException(status_code=409, detail="На этот подарок уже ответили")

    if action == "accept":
        ticket.gift_status = "accepted"
        await db.flush()
        return "accepted"

    giver_id = ticket.gifted_by
    recipient = await db.get(User, ticket.user_id)
    giver = await db.get(User, giver_id) if giver_id else None
    event_title = ticket.event.title if ticket.event else "мероприятие"

    if giver is not None:
        ticket.user_id = giver.id
    # With the giver's account gone there is nobody to hand it back to; it stays
    # where it is, an ordinary ticket, rather than vanishing.
    ticket.gifted_by = None
    ticket.gift_message = None
    ticket.gift_status = None
    ticket.gift_token = None
    # The recipient may have seen the code while deciding; it is theirs no more.
    ticket.ticket_id = ticket_service.new_ticket_id()
    await db.flush()

    if giver is not None:
        await asyncio.to_thread(
            mail_service.send_gift_declined_email,
            giver.email,
            recipient.username if recipient else "Получатель",
            event_title,
        )
    return "declined"


@router.post("/gifts/respond")
async def respond(data: GiftAnswer, db: AsyncSession = Depends(get_db, scope="function")):
    """Answer a gift by its token. No sign-in: the token is the proof."""
    ticket = await _by_token(db, data.token, lock=True)
    return {"status": await _answer(db, ticket, data.action)}


async def _my_pending(db: AsyncSession, ticket_id: str, user: User) -> Ticket:
    query = _loaded(select(Ticket).where(Ticket.ticket_id == ticket_id)).with_for_update(of=Ticket)
    ticket = await db.scalar(query)
    if ticket is None or ticket.user_id != user.id or ticket.gifted_by is None:
        raise HTTPException(status_code=404, detail="Подарок не найден")
    return ticket


@router.post("/gifts/{ticket_id}/accept")
async def accept_gift(
    ticket_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    ticket = await _my_pending(db, ticket_id, user)
    return {"status": await _answer(db, ticket, "accept")}


@router.post("/gifts/{ticket_id}/decline")
async def decline_gift(
    ticket_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    ticket = await _my_pending(db, ticket_id, user)
    return {"status": await _answer(db, ticket, "decline")}


@router.get("/gifts/received", response_model=list[TicketOut])
async def received_gifts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Tickets given to this user, waiting or accepted, newest first.

    A declined gift is not here: it went back to whoever gave it.
    """
    rows = await db.execute(
        _loaded(
            select(Ticket).where(
                Ticket.user_id == user.id,
                Ticket.gifted_by.is_not(None),
                Ticket.gift_status.in_(("pending", "accepted")),
            )
        ).order_by(Ticket.created_at.desc())
    )
    return [ticket_service.serialize_ticket(ticket) for ticket in rows.scalars().all()]
