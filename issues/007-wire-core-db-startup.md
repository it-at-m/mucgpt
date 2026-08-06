# 007 - Wire Core DB Startup

## Goal

Stage 2, step 6. Initialize the core chat persistence database during app
startup and provide FastAPI session dependencies.

## Implementation

- Add async SQLAlchemy engine/session factory for the core service.
- Build SQLite and Postgres URLs from the `DB` settings.
- Add a `get_db_session` FastAPI dependency.
- Add an `init_db` startup function.
- Wire `init_db` into core app warmup.
- Import persistence models before metadata creation.
- Register the conversation router with the API app.

## Acceptance Criteria

- Local app startup creates missing SQLite tables automatically.
- Postgres settings produce a Postgres async engine.
- Tests can override or reset the engine/session cache.
- Existing routers continue to boot without a configured external database.

## Tests

- Unit tests for engine URL/kwargs construction.
- Startup test proving `init_db` is called.
- Integration router tests use isolated test database state.

## Reviewer Notes

- Keep migrations strategy explicit in comments/docs: `create_all` is
  acceptable for local/dev bootstrap; production schema management should
  follow the project's normal conventions once this is closer to Stage 3.
- Do not add agent checkpointing in this commit.
