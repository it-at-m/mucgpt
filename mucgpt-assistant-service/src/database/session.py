from collections.abc import AsyncGenerator
from functools import lru_cache

from alembic import command
from alembic.config import Config
from sqlalchemy import URL, exc
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config.configuration import ConfigHelper
from core.logtools import getLogger

logger = getLogger("mucgpt-assistant-service")


# Singleton engine and session factory
@lru_cache(maxsize=1)
def get_engine_and_factory():
    config_helper = ConfigHelper()
    config = config_helper.loadData()
    db_config = config.backend.db_config
    url = URL.create(
        drivername="postgresql+asyncpg",
        username=db_config.db_user,
        password=db_config.db_password,
        host=db_config.db_host,
        port=db_config.db_port,
        database=db_config.db_name,
    )
    engine = create_async_engine(url=url)
    factory = async_sessionmaker(engine)
    return engine, factory


async def initialize_database() -> None:
    """Initialize database by running Alembic migrations."""
    logger.info("Starting database migration...")
    try:
        alembic_cfg = Config("migrations/alembic.ini")
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migration completed successfully.")
    except Exception as e:
        logger.error(f"Alembic migration failed: {e}")
        raise


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    engine, factory = get_engine_and_factory()
    async with factory() as session:
        try:
            yield session
        except exc.SQLAlchemyError as e:
            await session.rollback()
            logger.error(f"Session rollback due to error: {e}")
            raise
        finally:
            await session.close()
