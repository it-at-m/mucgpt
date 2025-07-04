from collections.abc import AsyncGenerator
from functools import lru_cache

from fastapi import Depends
from sqlalchemy import URL, exc
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config.settings import Settings, get_settings
from core.logtools import getLogger

logger = getLogger("mucgpt-assistant-service")


# Database URL creation with settings
def create_database_url(settings: Settings) -> URL:
    """Create database URL from settings."""
    return URL.create(
        drivername="postgresql+asyncpg",
        username=settings.DB_USER,
        password=settings.DB_PASSWORD,
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
    )


# Singleton engine and session factory
@lru_cache(maxsize=1)
def get_engine_and_factory(database_url: str):
    """Create and cache the SQLAlchemy engine and session factory."""
    engine = create_async_engine(url=database_url)
    factory = async_sessionmaker(engine)
    return engine, factory


async def get_db_session(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[AsyncSession, None]:
    """Get database session with settings dependency."""
    database_url = str(create_database_url(settings))
    engine, factory = get_engine_and_factory(database_url)
    async with factory() as session:
        try:
            yield session
        except exc.SQLAlchemyError as e:
            await session.rollback()
            logger.error(f"Session rollback due to error: {e}")
            raise
        finally:
            await session.close()
