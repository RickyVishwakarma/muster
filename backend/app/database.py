"""SQLAlchemy engine + session wiring.

Defaults to SQLite (zero-config). Point DATABASE_URL at Supabase/Postgres to
run against the same stack Lyzr uses in production — nothing else changes.
"""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

# check_same_thread is a SQLite-only flag; harmless to omit for Postgres.
connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_columns() -> None:
    """Add columns introduced after a DB was first created (SQLite only).

    Keeps existing dev databases working when new nullable columns are added,
    without a full migration tool. Postgres deployments should use Alembic.
    """
    if not settings.database_url.startswith("sqlite"):
        return
    from sqlalchemy import text

    with engine.begin() as conn:
        for table in ("agents", "traces"):
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            if "created_by" not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN created_by VARCHAR(32)"))

        trace_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(traces)"))}
        if "conversation_id" not in trace_cols:
            conn.execute(text("ALTER TABLE traces ADD COLUMN conversation_id VARCHAR(32)"))
        if "tools_used_json" not in trace_cols:
            conn.execute(text("ALTER TABLE traces ADD COLUMN tools_used_json TEXT DEFAULT '[]'"))

        agent_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(agents)"))}
        if "tools_json" not in agent_cols:
            conn.execute(text("ALTER TABLE agents ADD COLUMN tools_json TEXT DEFAULT '[]'"))


def init_db() -> None:
    from . import models  # noqa: F401  (register mappers)

    Base.metadata.create_all(bind=engine)
    _ensure_columns()
