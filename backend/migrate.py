"""Bring an existing database up to the current models.

    python migrate.py

create_db.py builds tables with SQLAlchemy's create_all, which only ever
CREATEs -- it will not add a column to a table that already exists. So every
column introduced after a database was first built needs an explicit ALTER, and
this is where they live.

Every statement is written to be safe to run twice: running this on an
up-to-date database prints "nothing to do" and changes nothing.
"""
import sys

from sqlalchemy import create_engine, inspect, text

from app.core.config import settings
# Imported for the side effect of registering every table on Base.
from app.models import Base

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# (table, column, DDL executed when the column is missing)
COLUMNS = [
    (
        "events",
        "tags",
        "ALTER TABLE events ADD COLUMN tags VARCHAR(32)[]",
    ),
    (
        "user_venue_roles",
        "created_at",
        "ALTER TABLE user_venue_roles ADD COLUMN created_at TIMESTAMPTZ",
    ),
    (
        "events",
        "template_id",
        "ALTER TABLE events ADD COLUMN template_id INTEGER "
        "REFERENCES pdf_templates(id) ON DELETE SET NULL",
    ),
]

# Whole tables added after the first build. create_all would make these, but it
# is only run by create_db.py; listing them here means one command brings an
# existing database fully up to date.
TABLES = ["pdf_templates"]


def main() -> int:
    engine = create_engine(settings.sync_database_url, echo=False)
    applied = 0

    try:
        existing = set(inspect(engine).get_table_names())

        # Tables first: a column below carries a foreign key into one of them,
        # and Postgres refuses the reference if the target is not there yet.
        missing = [name for name in TABLES if name not in existing]
        if missing:
            Base.metadata.create_all(
                engine, tables=[Base.metadata.tables[name] for name in missing]
            )
            for name in missing:
                print(f"  + таблица {name}: создана")
                applied += 1
        else:
            for name in TABLES:
                print(f"  - таблица {name}: уже есть")

        # Re-read: the table just created has to be visible to the column check.
        inspector = inspect(engine)
        existing = set(inspector.get_table_names())

        with engine.begin() as connection:
            for table, column, ddl in COLUMNS:
                if table not in existing:
                    print(f"  - {table}.{column}: таблицы нет, пропуск "
                          f"(создастся через create_db.py)")
                    continue

                columns = {c["name"] for c in inspector.get_columns(table)}
                if column in columns:
                    print(f"  - {table}.{column}: уже есть")
                    continue

                connection.execute(text(ddl))
                print(f"  + {table}.{column}: добавлена")
                applied += 1
    except Exception as exc:  # noqa: BLE001 - the message is the whole point
        print(f"ОШИБКА: {exc}")
        print("Проверьте, что PostgreSQL запущен и DATABASE_URL в .env верен.")
        return 1
    finally:
        engine.dispose()

    print()
    print(f"Готово. Изменений: {applied}." if applied else "Готово. Изменений нет.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
