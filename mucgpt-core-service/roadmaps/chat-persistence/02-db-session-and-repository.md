# 02 — DB session factory + generic Repository

**Milestone:** M1 — Foundations  ·  **Depends on:** 01  ·  **Size:** M

## Context
Mirror the async DB scaffolding from `mucgpt-assistant-service/app/database/` so core service
gets a consistent, tested pattern: an async engine/session factory, a FastAPI
`get_db_session` dependency, and a generic `Repository[ModelType]`.

## Scope
**In:** new `app/database/` package: `__init__.py`, `base.py` (declarative `Base`),
`session.py`, `repo.py`. Engine selection by `settings.DB.backend`.
**Out:** concrete models (03), table creation wiring into lifespan (done minimally here,
extended in 03).

## Implementation
1. `app/database/base.py` — `Base = declarative_base()`.
2. `app/database/session.py`:
   - `create_database_url(settings)` returning either
     `sqlite+aiosqlite:///<path>` or a Postgres `URL.create(...)` (copy the safe
     direct-parameter approach from the assistant-service `session.py`).
   - cached `get_engine_and_factory_direct(settings)` (`create_async_engine` +
     `async_sessionmaker`). For SQLite pass `connect_args={"check_same_thread": False}`.
   - `async def get_db_session(settings=Depends(get_settings)) -> AsyncGenerator[AsyncSession]`
     with rollback-on-error (port the structure, drop the assistant-service's verbose
     Postgres-specific logging).
   - `async def init_db()` — `async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)`
     (so SQLite "just works"; Postgres prod uses Alembic — see issue 03 notes).
3. `app/database/repo.py` — copy the generic `Repository[ModelType: Base]`
   (`create/get/get_all/update/delete`) from
   `mucgpt-assistant-service/app/database/repo.py` verbatim (it's storage-agnostic).

## Acceptance criteria
- With `DB.backend=sqlite`, a session can be opened and `init_db()` creates tables (verified
  in issue 12 against an in-memory `sqlite+aiosqlite:///:memory:`).
- `get_db_session` is injectable in routers and overridable in tests via
  `api_app.dependency_overrides`.

## Notes
Import `Base` from `app/database/base.py` everywhere (not from a models module) to avoid
circular imports — assistant-service defines `Base` inside `database_models.py`; we split it
out because both checkpointer and models will import it.
