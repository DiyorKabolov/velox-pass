"""Registration, login and email verification."""
import secrets

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    generate_verification_code,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin
from app.services.mail_service import send_verification_email


async def get_user_by_login(db: AsyncSession, login: str) -> User | None:
    result = await db.execute(
        select(User).where(or_(User.username == login, User.email == login))
    )
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, data: UserCreate) -> tuple[User, bool]:
    existing = await db.execute(
        select(User).where(
            or_(User.username == data.username, User.email == data.email)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Имя пользователя или email уже заняты",
        )

    code = generate_verification_code()
    user = User(
        username=data.username,
        email=str(data.email),
        password_hash=hash_password(data.password),
        role="user",
        is_verified=False,
        verify_token=code,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Mail failures must not roll back the registration.
    mail_sent = send_verification_email(user.email, user.username, code)
    return user, mail_sent


async def login_user(db: AsyncSession, data: UserLogin) -> tuple[User, str]:
    user = await get_user_by_login(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email не подтверждён",
        )

    token = create_access_token(user.id, extra={"role": user.role})
    return user, token


async def verify_email(db: AsyncSession, email: str, code: str) -> tuple[User, str]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.is_verified:
        # Never mint a token here: this endpoint is unauthenticated, so
        # returning one for an already-verified account would let anyone who
        # knows an email address sign in without the password.
        raise HTTPException(
            status_code=400, detail="Email уже подтверждён, выполните вход"
        )
    if not user.verify_token or not secrets.compare_digest(user.verify_token, code):
        raise HTTPException(status_code=400, detail="Неверный код подтверждения")

    user.is_verified = True
    user.verify_token = None
    await db.flush()

    return user, create_access_token(user.id, extra={"role": user.role})


async def resend_code(db: AsyncSession, email: str) -> bool:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.is_verified:
        raise HTTPException(status_code=400, detail="Для этого email нечего подтверждать")

    user.verify_token = generate_verification_code()
    await db.flush()
    return send_verification_email(user.email, user.username, user.verify_token)
