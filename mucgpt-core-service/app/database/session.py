"""Async SQLAlchemy engine/session management for chat persistence.

Supports two backends, selected via ``settings.DB.backend``:

  - ``sqlite``   -> ``sqlite+aiosqlite:///<path>`` (default, zero infra)
  - ``postgres`` -> ``postgresql+asyncpg://`` using direct connection params
                    (mirrors mucgpt-assistant-service, which avoids URL-encoding
                    issues with special characters in passwords).

The engine/factory are cached process-wide. ``get_db_session`` is the FastAPI
dependency used by routers and can be overridden in tests.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy import URL, exc
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config.settings import Settings, get_settings
from core.logtools import getLogger
from database.base import Base

logger = getLogger("mucgpt-core-db")

# Process-wide cache. Settings is not hashable, so we cache manually rather than
# via lru_cache.
_engine: AsyncEngine | None = None
_factory: async_sessionmaker[AsyncSession] | None = None


def build_engine_kwargs(settings: Settings) -> tuple[str | URL, dict]:
    """Return the (url, kwargs) pair for create_async_engine based on config."""
    db = settings.DB
    if db.backend == "sqlite":
        path = db.sqlite_path
        # Ensure the parent directory for a file-based sqlite db exists.
        if path not in (":memory:", "") and "mode=memory" not in path:
            parent = os.path.dirname(os.path.abspath(path))
            os.makedirs(parent, exist_ok=True)
        url = f"sqlite+aiosqlite:///{path}"
        return url, {"connect_args": {"check_same_thread": False}}

    # postgres
    password = db.PASSWORD.get_secret_value() if db.PASSWORD else None
    connect_args: dict = {
        "host": db.HOST,
        "port": db.PORT,
        "database": db.NAME,
        "user": db.USER,
        "password": password,
    }
    if db.SCHEMA:
        connect_args["server_settings"] = {"search_path": db.SCHEMA}
        logger.info("Using PostgreSQL schema (search_path): %s", db.SCHEMA)
    return "postgresql+asyncpg://", {
        "connect_args": connect_args,
        "pool_pre_ping": True,
        "pool_recycle": 3600,
    }


def get_engine_and_factory(
    settings: Settings,
) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create (once) and return the cached async engine + session factory."""
    global _engine, _factory
    if _engine is not None and _factory is not None:
        return _engine, _factory

    url, kwargs = build_engine_kwargs(settings)
    logger.info("Creating SQLAlchemy async engine (backend=%s)", settings.DB.backend)
    _engine = create_async_engine(url, echo=False, **kwargs)
    _factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine, _factory


def reset_engine_cache() -> None:
    """Clear the cached engine/factory (used by tests to switch databases)."""
    global _engine, _factory
    _engine = None
    _factory = None


async def init_db(settings: Settings | None = None) -> None:
    """Create all tables for the configured database.

    For SQLite this is the only setup needed. For PostgreSQL in production,
    prefer Alembic migrations; create_all is safe (it only creates missing
    tables) but is not a substitute for managed migrations.
    """
    # Import models so they are registered on Base.metadata before create_all.
    import database.models  # noqa: F401

    settings = settings or get_settings()
    engine, _ = get_engine_and_factory(settings)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Chat-persistence tables ensured (backend=%s)", settings.DB.backend)


async def get_db_session(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency yielding an AsyncSession with rollback-on-error."""
    _, factory = get_engine_and_factory(settings)
    async with factory() as session:
        try:
            yield session
        except exc.SQLAlchemyError:
            await session.rollback()
            logger.exception("Session rolled back due to SQLAlchemy error")
            raise
        except Exception:
            await session.rollback()
            logger.exception("Session rolled back due to unexpected error")
            raise
        finally:
            await session.close()
