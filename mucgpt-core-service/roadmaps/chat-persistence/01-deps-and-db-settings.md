# 01 — Add DB dependencies + DB settings config

**Milestone:** M1 — Foundations  ·  **Depends on:** —  ·  **Size:** S

## Context
Core service currently has no database layer (`grep` of `pyproject.toml` shows only
`langgraph>=1.1.6`, no SQLAlchemy). We need an async DB stack that defaults to SQLite
(zero-infra, test-friendly) and can switch to Postgres in prod, matching
`mucgpt-assistant-service`.

## Scope
**In:** add dependencies; add a `DB` settings section; document config.
**Out:** session/engine code (issue 02), models (03).

## Implementation
1. `mucgpt-core-service/pyproject.toml` — add to `dependencies`:
   - `sqlalchemy[asyncio]>=2.0`
   - `aiosqlite>=0.20`            (SQLite async driver — default)
   - `asyncpg>=0.29`              (Postgres async driver — prod)
   - `langgraph-checkpoint-sqlite>=2.0`  (used by issue 08; grouped here so deps land once)
   - (prod-only, can defer) `langgraph-checkpoint-postgres`
2. `app/config/settings.py` — add a `DBConfig(BaseModel)` and a `DB` field on `Settings`:
   - `backend: Literal["sqlite", "postgres"] = "sqlite"`
   - `sqlite_path: str = "./data/mucgpt_chat.db"`
   - `HOST/PORT/NAME/USER/PASSWORD(SecretStr)/SCHEMA` for postgres (mirror
     `mucgpt-assistant-service/app/config/settings.py`)
   - Follow the existing pydantic-settings + YAML source pattern already in this file.
3. `mucgpt-core-service/config.yaml.example` — add a commented `db:` block (sqlite default +
   postgres example).
4. Ensure the sqlite data dir is git-ignored (`data/`), and document env override
   `MUCGPT_CORE_DB__BACKEND` etc.

## Acceptance criteria
- `uv sync` / install resolves with the new deps.
- `get_settings().DB.backend == "sqlite"` by default; Postgres values load from YAML/env.
- No behavior change to existing endpoints.

## Notes
Keep `DB` optional/defaulted so existing deployments without a `db:` block still boot.
