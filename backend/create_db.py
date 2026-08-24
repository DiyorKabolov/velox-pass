"""One-shot bootstrap: create the database, the tables and the default admin.

    python create_db.py
"""
import sys
from urllib.parse import urlparse

import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models import Base, User

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@veloxpass.com"
ADMIN_PASSWORD = "admin123"


def parse_url(database_url: str) -> dict:
    """Split DATABASE_URL into psycopg2 connection parameters."""
    parsed = urlparse(database_url.replace("+asyncpg", "").replace("+psycopg2", ""))
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "dbname": (parsed.path or "/velox_pass").lstrip("/"),
    }


def create_database(params: dict) -> None:
    """Create the target database if it is not there yet."""
    target = params["dbname"]
    admin_params = {**params, "dbname": "postgres"}

    connection = psycopg2.connect(**admin_params)
    connection.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target,))
            if cursor.fetchone():
                print(f"[2/4] Database '{target}' already exists, skipping creation.")
                return
            cursor.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target))
            )
            print(f"[2/4] Database '{target}' created.")
    finally:
        connection.close()


def create_tables(sync_url: str) -> None:
    engine = create_engine(sync_url, echo=False)
    Base.metadata.create_all(engine)
    table_names = ", ".join(sorted(Base.metadata.tables))
    print(f"[3/4] Tables ready: {table_names}")
    engine.dispose()


def create_admin(sync_url: str) -> None:
    engine = create_engine(sync_url, echo=False)
    with Session(engine) as session:
        existing = session.execute(
            select(User).where(User.email == ADMIN_EMAIL)
        ).scalar_one_or_none()
        if existing:
            # Keep the role correct even if the row was edited by hand.
            if existing.role != "superadmin" or not existing.is_verified:
                existing.role = "superadmin"
                existing.is_verified = True
                session.commit()
                print("[4/4] Existing admin promoted back to superadmin.")
            else:
                print("[4/4] Superadmin already exists, skipping creation.")
            return

        session.add(
            User(
                username=ADMIN_USERNAME,
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASSWORD),
                role="superadmin",
                is_verified=True,
                verify_token=None,
            )
        )
        session.commit()
        print(f"[4/4] Superadmin created: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    engine.dispose()


def main() -> int:
    print("Velox Pass - database bootstrap")
    params = parse_url(settings.DATABASE_URL)
    print(
        f"[1/4] Target: postgresql://{params['user']}@{params['host']}:"
        f"{params['port']}/{params['dbname']}"
    )

    try:
        create_database(params)
    except psycopg2.OperationalError as exc:
        print(f"ERROR: cannot reach PostgreSQL - {exc}")
        print("Check that the server is running and DATABASE_URL in .env is correct.")
        return 1

    sync_url = settings.sync_database_url
    create_tables(sync_url)
    create_admin(sync_url)

    print("Done. Start the API with: python main.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
