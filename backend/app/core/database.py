"""Async SQLAlchemy engine, session factory and the get_db dependency."""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Declarative base shared by every model."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """One session per request, committed when the endpoint returns.

    Always declare it as `Depends(get_db, scope="function")`. The default scope
    runs everything after the yield once the response has already been sent, so
    the commit landed after the client had its answer: a request made straight
    afterwards -- save an event, then schedule it -- could look for the new row
    before it existed. Measured at about 1 in 100 back-to-back writes. With
    scope="function" the commit happens before the response goes out.

    Every use has to carry the same scope. It is part of FastAPI's dependency
    cache key, so a mix would hand one request two separate sessions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
