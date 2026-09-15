"""Friend requests and friendships.

Answering from an e-mail works without signing in -- the link carries a secret
token -- but the link itself changes nothing. Mail scanners and link previewers
open every link in a message before a person does, and an invitation carrying
both "accept" and "decline" would be accepted and declined by the robot before
its recipient ever saw it. So the links lead to a page that says who is asking,
and the answer is a POST made from that page.
"""
import asyncio
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.friend import (
    FriendOut,
    FriendRequestIn,
    FriendUser,
    InviteAnswer,
    InviteOut,
    PendingRequestOut,
)
from app.services import mail_service

router = APIRouter(prefix="/friends", tags=["friends"])


def _brief(user: User) -> FriendUser:
    return FriendUser(user_id=user.id, username=user.username, avatar_url=user.avatar_url)


def _public_base(request: Request) -> str:
    """The address the e-mailed links should start with.

    An explicit setting wins; then the static ngrok domain, which is what
    anyone outside this machine reaches; then wherever the request came from,
    which is right for local development and wrong for nobody else.
    """
    if settings.PUBLIC_URL:
        return settings.PUBLIC_URL.rstrip("/")
    if settings.NGROK_DOMAIN:
        return f"https://{settings.NGROK_DOMAIN}"
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    return str(request.base_url).rstrip("/")


async def _between(db: AsyncSession, first: int, second: int) -> Friendship | None:
    """The one row for a pair of users, whichever of them asked."""
    return await db.scalar(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == first, Friendship.addressee_id == second),
                and_(Friendship.requester_id == second, Friendship.addressee_id == first),
            )
        )
    )


@router.post("/request")
async def send_request(
    data: FriendRequestIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Ask someone to be friends, and e-mail them the invitation."""
    target = await db.scalar(
        select(User).where(func.lower(User.username) == data.username.strip().lower())
    )
    if target is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Нельзя добавить в друзья самого себя")

    friendship = await _between(db, user.id, target.id)
    if friendship is not None:
        if friendship.status == "accepted":
            raise HTTPException(status_code=409, detail="Уже в друзьях")
        if friendship.status == "pending":
            if friendship.requester_id == user.id:
                raise HTTPException(status_code=409, detail="Запрос уже отправлен")
            # They asked first. Asking them back is saying yes, and sending a
            # second invitation the other way would only leave two open.
            friendship.status = "accepted"
            await db.flush()
            return {
                "message": f"Вы теперь друзья с {target.username}",
                "status": "accepted",
                "mail_sent": False,
            }
        # Declined earlier, by either side: this is a new request from the
        # caller. The row is reused so the pair keeps a single one, and the
        # token is replaced so the old e-mail's links no longer answer it.
        friendship.requester_id = user.id
        friendship.addressee_id = target.id
        friendship.status = "pending"
        friendship.token = str(uuid.uuid4())
    else:
        friendship = Friendship(requester_id=user.id, addressee_id=target.id)
        db.add(friendship)

    try:
        await db.flush()
    except IntegrityError:
        # The other person asked in the same instant; the pair index refused
        # the second row.
        raise HTTPException(status_code=409, detail="Запрос уже отправлен") from None

    base = _public_base(request)
    token = quote(friendship.token)
    # SMTP is blocking; run it off the event loop so one slow mail server does
    # not stall every other request in the meantime.
    mail_sent = await asyncio.to_thread(
        mail_service.send_friend_request_email,
        target.email,
        user.username,
        f"{base}/api/friends/accept/{token}",
        f"{base}/api/friends/decline/{token}",
    )
    return {"message": "Запрос отправлен", "status": "pending", "mail_sent": mail_sent}


def _to_answer_page(token: str, action: str) -> RedirectResponse:
    return RedirectResponse(
        f"/friends/respond?token={quote(token)}&action={action}",
        status_code=status.HTTP_303_SEE_OTHER,
    )


@router.get("/accept/{token}")
async def accept_link(token: str):
    """The "Принять" link from the e-mail. Changes nothing -- see the module note."""
    return _to_answer_page(token, "accept")


@router.get("/decline/{token}")
async def decline_link(token: str):
    """The "Отклонить" link from the e-mail. Changes nothing either."""
    return _to_answer_page(token, "decline")


async def _by_token(db: AsyncSession, token: str) -> Friendship:
    friendship = await db.scalar(select(Friendship).where(Friendship.token == token))
    if friendship is None:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    return friendship


@router.get("/invite/{token}", response_model=InviteOut)
async def invite(token: str, db: AsyncSession = Depends(get_db, scope="function")):
    """Who is asking, for the page the e-mailed links open."""
    friendship = await _by_token(db, token)
    requester = await db.get(User, friendship.requester_id)
    addressee = await db.get(User, friendship.addressee_id)
    return InviteOut(
        requester=_brief(requester),
        addressee_username=addressee.username,
        status=friendship.status,
    )


def _answer(friendship: Friendship, action: str) -> None:
    if friendship.status != "pending":
        raise HTTPException(status_code=409, detail="На это приглашение уже ответили")
    friendship.status = "accepted" if action == "accept" else "declined"


@router.post("/respond")
async def respond(data: InviteAnswer, db: AsyncSession = Depends(get_db, scope="function")):
    """Answer an invitation by its token. No sign-in: the token is the proof."""
    friendship = await _by_token(db, data.token)
    _answer(friendship, data.action)
    await db.flush()
    return {"status": friendship.status}


async def _incoming(db: AsyncSession, friendship_id: int, user: User) -> Friendship:
    """An open request addressed to this user. Anyone else's reads as missing."""
    friendship = await db.get(Friendship, friendship_id)
    if friendship is None or friendship.addressee_id != user.id:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    return friendship


@router.post("/requests/{friendship_id}/accept")
async def accept_request(
    friendship_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    friendship = await _incoming(db, friendship_id, user)
    _answer(friendship, "accept")
    await db.flush()
    return {"status": friendship.status}


@router.post("/requests/{friendship_id}/decline")
async def decline_request(
    friendship_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    friendship = await _incoming(db, friendship_id, user)
    _answer(friendship, "decline")
    await db.flush()
    return {"status": friendship.status}


@router.get("", response_model=list[FriendOut])
async def list_friends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Accepted friendships, as the other person in each."""
    other = case(
        (Friendship.requester_id == user.id, Friendship.addressee_id),
        else_=Friendship.requester_id,
    )
    rows = await db.execute(
        select(Friendship, User)
        .join(User, User.id == other)
        .where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id),
        )
        .order_by(func.lower(User.username))
    )
    return [
        FriendOut(**_brief(friend).model_dump(), since=friendship.updated_at)
        for friendship, friend in rows.all()
    ]


@router.get("/pending", response_model=list[PendingRequestOut])
async def pending_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Requests waiting for this user's answer, newest first."""
    rows = await db.execute(
        select(Friendship, User)
        .join(User, User.id == Friendship.requester_id)
        .where(Friendship.addressee_id == user.id, Friendship.status == "pending")
        .order_by(Friendship.created_at.desc())
    )
    return [
        PendingRequestOut(
            friendship_id=friendship.id,
            requester=_brief(requester),
            created_at=friendship.created_at,
        )
        for friendship, requester in rows.all()
    ]


@router.delete("/{user_id}", status_code=204)
async def remove_friend(
    user_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """End a friendship, or withdraw a request -- whoever sent it."""
    friendship = await _between(db, user.id, user_id)
    if friendship is None:
        raise HTTPException(status_code=404, detail="Такой дружбы нет")
    await db.delete(friendship)
    return Response(status_code=204)
