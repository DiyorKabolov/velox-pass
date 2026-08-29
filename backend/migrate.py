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

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# (table, column, DDL executed when the column is missing)
MIGRATIONS = [
    (
        "events",
        "tags",
        "ALTER TABLE events ADD COLUMN tags VARCHAR(32)[]",
    ),
]


def main() -> int:
    engine = create_engine(settings.sync_database_url, echo=False)
    applied = 0

    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        with engine.begin() as connection:
            for table, column, ddl in MIGRATIONS:
                if table not in existing_tables:
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

    print(f"\nГотово. Изменений: {applied}." if applied else "\nГотово. Изменений нет.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
