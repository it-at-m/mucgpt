from anyio import CancelScope
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from config.settings import Settings
from database.database_models import Base, ChatImage, ImageDeletionOutbox
from database.session import create_engine_and_session_factory


class ImageCatalogManager:
    """Own catalog sessions/schema for chat images, independently of documents."""

    _engine: AsyncEngine | None = None
    _session_factory: async_sessionmaker[AsyncSession] | None = None

    @staticmethod
    async def init(settings: Settings) -> None:
        if ImageCatalogManager._engine is not None:
            return
        engine, factory = create_engine_and_session_factory(settings)
        try:
            async with engine.begin() as connection:
                # Explicitly initialize the new tables on existing deployments.
                await connection.run_sync(
                    Base.metadata.create_all,
                    tables=[ChatImage.__table__, ImageDeletionOutbox.__table__],  # ty: ignore[invalid-argument-type]
                )
        except BaseException:
            with CancelScope(shield=True):
                await engine.dispose()
            raise
        ImageCatalogManager._engine = engine
        ImageCatalogManager._session_factory = factory

    @staticmethod
    async def close() -> None:
        try:
            if ImageCatalogManager._engine is not None:
                await ImageCatalogManager._engine.dispose()
        finally:
            ImageCatalogManager._engine = None
            ImageCatalogManager._session_factory = None

    @staticmethod
    def get_session_factory() -> async_sessionmaker[AsyncSession]:
        if ImageCatalogManager._session_factory is None:
            raise RuntimeError("ImageCatalogManager not initialized")
        return ImageCatalogManager._session_factory
