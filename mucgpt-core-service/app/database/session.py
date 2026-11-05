from __future__ import annotations

from sqlalchemy import URL
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config.settings import Settings


def create_database_url(settings: Settings) -> URL:
    """Create the async SQLAlchemy URL without interpolating credentials."""
    db = settings.db
    return URL.create(
        drivername="postgresql+asyncpg",
        username=db.user,
        password=db.password.get_secret_value(),
        host=db.host,
        port=db.port,
        database=db.name,
    )


def create_engine_and_session_factory(
    settings: Settings,
) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create the engine and sessions used for core-owned tables."""
    engine = create_async_engine(
        create_database_url(settings),
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    return engine, async_sessionmaker(engine, expire_on_commit=False)
