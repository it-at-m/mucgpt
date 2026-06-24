"""Provider for the LangGraph checkpointer used to persist agent graph state.

The checkpointer stores the full agent state (messages, tool progress, ...) keyed
by ``thread_id`` so an agent run can resume across requests. Selected via
``settings.CHECKPOINTER.backend``:

  - ``memory``   -> in-process MemorySaver (default; no infra, ideal for tests)
  - ``sqlite``   -> AsyncSqliteSaver persisted at ``CHECKPOINTER.sqlite_path``
  - ``postgres`` -> AsyncPostgresSaver using the DB connection settings

If initialization fails, the provider falls back to "no checkpointer" so the
service still boots and serves stateless requests.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from langgraph.checkpoint.memory import MemorySaver

from config.settings import Settings

logger = logging.getLogger("mucgpt-core-checkpointer")


class CheckpointerProvider:
    _checkpointer: Any | None = None
    # Async context manager kept alive for the process lifetime (sqlite/postgres).
    _cm: Any | None = None

    @classmethod
    async def init(cls, settings: Settings) -> None:
        cfg = settings.CHECKPOINTER
        try:
            if cfg.backend == "memory":
                cls._checkpointer = MemorySaver()
                logger.info("Checkpointer initialized: memory")
            elif cfg.backend == "sqlite":
                from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

                parent = os.path.dirname(os.path.abspath(cfg.sqlite_path))
                os.makedirs(parent, exist_ok=True)
                cls._cm = AsyncSqliteSaver.from_conn_string(cfg.sqlite_path)
                cls._checkpointer = await cls._cm.__aenter__()
                await cls._checkpointer.setup()
                logger.info(
                    "Checkpointer initialized: sqlite (%s)", cfg.sqlite_path
                )
            elif cfg.backend == "postgres":
                from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

                conn_string = cls._postgres_conn_string(settings)
                cls._cm = AsyncPostgresSaver.from_conn_string(conn_string)
                cls._checkpointer = await cls._cm.__aenter__()
                await cls._checkpointer.setup()
                logger.info("Checkpointer initialized: postgres")
            else:  # pragma: no cover - guarded by settings validation
                logger.warning(
                    "Unknown checkpointer backend %s; running without checkpointing",
                    cfg.backend,
                )
                cls._checkpointer = None
        except Exception as exc:
            logger.error(
                "Failed to initialize checkpointer (%s); running without "
                "checkpointing: %s",
                cfg.backend,
                exc,
            )
            cls._checkpointer = None
            cls._cm = None

    @staticmethod
    def _postgres_conn_string(settings: Settings) -> str:
        db = settings.DB
        password = db.PASSWORD.get_secret_value() if db.PASSWORD else ""
        return (
            f"postgresql://{db.USER}:{password}@{db.HOST}:{db.PORT}/{db.NAME}"
        )

    @classmethod
    def get_checkpointer(cls) -> Any | None:
        """Return the active checkpointer, or None if checkpointing is disabled."""
        return cls._checkpointer

    @classmethod
    async def close(cls) -> None:
        if cls._cm is not None:
            try:
                await cls._cm.__aexit__(None, None, None)
            except Exception as exc:  # pragma: no cover - shutdown best effort
                logger.warning("Error closing checkpointer: %s", exc)
        cls._cm = None
        cls._checkpointer = None
