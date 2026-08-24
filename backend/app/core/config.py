"""Application settings loaded from the .env file."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "Velox Pass API"
    VERSION: str = "2.0"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/velox_pass"
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200

    MAIL_FROM: str = ""
    MAIL_PASSWORD: str = ""
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @property
    def sync_database_url(self) -> str:
        """The same database, but through the sync psycopg2 driver."""
        return self.DATABASE_URL.replace("+asyncpg", "").replace(
            "postgresql://", "postgresql+psycopg2://", 1
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
