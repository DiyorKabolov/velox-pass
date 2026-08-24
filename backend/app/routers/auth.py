from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserOut, VerifyRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Create an account and email a six-digit confirmation code."""
    return await auth_service.register_user(db, data)


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
async def resend(email: str, db: AsyncSession = Depends(get_db)):
    sent = await auth_service.resend_code(db, email)
    return {"sent": sent}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
