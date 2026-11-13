from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from config.settings import Settings
from database.session import create_engine_and_session_factory


class DocumentCatalogManager:
    """Own catalog sessions/schema independently of conversation persistence."""

    _engine: AsyncEngine | None = None
    _session_factory: async_sessionmaker[AsyncSession] | None = None

    @staticmethod
    async def init(settings: Settings) -> None:
        if DocumentCatalogManager._engine is not None:
            return
        engine, factory = create_engine_and_session_factory(settings)
        DocumentCatalogManager._engine = engine
        DocumentCatalogManager._session_factory = factory

    @staticmethod
    async def close() -> None:
        try:
            if DocumentCatalogManager._engine is not None:
                await DocumentCatalogManager._engine.dispose()
        finally:
            DocumentCatalogManager._engine = None
            DocumentCatalogManager._session_factory = None

    @staticmethod
    def get_session_factory() -> async_sessionmaker[AsyncSession]:
        if DocumentCatalogManager._session_factory is None:
            raise RuntimeError("DocumentCatalogManager not initialized")
        return DocumentCatalogManager._session_factory
