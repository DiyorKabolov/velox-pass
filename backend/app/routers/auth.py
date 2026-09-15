from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import (
    PasswordChange,
    ProfileUpdate,
    ResendRequest,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
    VerifyRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db, scope="function")):
    """Create an account and email a six-digit confirmation code.

    The account is created even when the mail server is unreachable; the
    response then carries a warning so the UI can offer "resend".
    """
    user, mail_sent = await auth_service.register_user(db, data)
    payload = {"user": UserOut.model_validate(user), "mail_sent": mail_sent}
    if not mail_sent:
        payload["warning"] = (
            "Account created, but the verification email could not be sent. "
            "Use /auth/resend to try again."
        )
    return payload


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db, scope="function")):
    user, token = await auth_service.login_user(db, data)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/verify", response_model=Token)
async def verify(data: VerifyRequest, db: AsyncSession = Depends(get_db, scope="function")):
    """Confirm the email with the code and return a ready-to-use token."""
    user, token = await auth_service.verify_email(db, str(data.email), data.code)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/resend")
async def resend(data: ResendRequest, db: AsyncSession = Depends(get_db, scope="function")):
    """Send a fresh code to an account that is not verified yet."""
    sent = await auth_service.resend_code(db, str(data.email))
    return {"sent": sent}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/profile", response_model=UserOut)
async def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Change the username. The session survives it: tokens carry the id."""
    if data.username is not None:
        name = data.username.strip()
        if len(name) < 3:
            raise HTTPException(status_code=422, detail="Никнейм — от 3 символов")
        # Sign-in accepts a username or an e-mail in one field; a name with @
        # in it could be mistaken for somebody's address.
        if "@" in name:
            raise HTTPException(status_code=422, detail="Никнейм не может содержать @")
        if name != user.username:
            clash = await db.scalar(
                select(User.id).where(
                    func.lower(User.username) == name.lower(), User.id != user.id
                )
            )
            if clash:
                raise HTTPException(status_code=409, detail="Этот никнейм уже занят")
            user.username = name
            try:
                await db.flush()
            except IntegrityError:
                raise HTTPException(status_code=409, detail="Этот никнейм уже занят") from None
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.patch("/password")
async def change_password(
    data: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Текущий пароль неверен")
    if verify_password(data.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Новый пароль совпадает с текущим")
    user.password_hash = hash_password(data.new_password)
    await db.flush()
    return {"message": "Пароль изменён"}
