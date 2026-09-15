"""The signed-in user's own profile. For now, only the avatar."""
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserOut
from app.services.uploads import drop_avatar, store_avatar

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Replace the avatar. The old file goes once the new one is saved."""
    previous = user.avatar_url
    user.avatar_url = store_avatar(await file.read(), user.id)
    await db.flush()
    drop_avatar(previous)
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/me/avatar", response_model=UserOut)
async def delete_avatar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    previous = user.avatar_url
    user.avatar_url = None
    await db.flush()
    drop_avatar(previous)
    await db.refresh(user)
    return UserOut.model_validate(user)
