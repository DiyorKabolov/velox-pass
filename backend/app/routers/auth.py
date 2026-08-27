from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import (
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
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
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
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user, token = await auth_service.login_user(db, data)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/verify", response_model=Token)
async def verify(data: VerifyRequest, db: AsyncSession = Depends(get_db)):
    """Confirm the email with the code and return a ready-to-use token."""
    user, token = await auth_service.verify_email(db, str(data.email), data.code)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/resend")
async def resend(data: ResendRequest, db: AsyncSession = Depends(get_db)):
    """Send a fresh code to an account that is not verified yet."""
    sent = await auth_service.resend_code(db, str(data.email))
    return {"sent": sent}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
