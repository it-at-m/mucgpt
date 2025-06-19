from collections.abc import AsyncGenerator

from sqlalchemy import URL, exc
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config.configuration import ConfigHelper


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    # Load settings from ConfigHelper
    config_helper = ConfigHelper()
    config = config_helper.loadData()
    db_config = config.backend.db_config

    url = URL.create(
        drivername="postgresql+asyncpg",
        username=db_config.db_user,
        host=db_config.db_host,
        database=db_config.db_name,
        password=db_config.db_password,
    )
    engine = create_async_engine(url=url)
    factory = async_sessionmaker(engine)
    async with factory() as session:
        try:
            yield session
            # Remove automatic commit - let the caller handle transaction boundaries
        except exc.SQLAlchemyError:
            await session.rollback()
            raise
        finally:
            await session.close()
