# 002 - Add Core DB Settings

## Goal

Stage 2, step 1. Introduce backend configuration for the core service's chat
persistence database.

This is only configuration plumbing. It must not add models, routers, or agent
behavior yet.

## Implementation

- Add a `DB` settings section to `mucgpt-core-service/app/config/settings.py`.
- Support two backends:
  - `sqlite` for local development and tests.
  - `postgres` for durable deployments.
- Include fields needed for Postgres connection parity with the existing
  service style: host, port, database name, user, password. Skip an optional
  schema/search-path field unless the project already needs one elsewhere —
  add it later if a real deployment needs it.
- Default to SQLite with a local file path so main can still boot without new
  infrastructure.
- Add validation that Postgres settings are complete when `DB.backend ==
  "postgres"`.
- Document environment variable override examples using the existing
  `MUCGPT_CORE_` settings conventions.

## Acceptance Criteria

- Existing config loading still works without a `DB` block.
- Invalid Postgres config fails at settings-load time with a clear error.
- The settings model does not initialize any database connection yet.

## Tests

- Add unit tests for default SQLite settings.
- Add unit tests for valid Postgres settings.
- Add unit tests for missing required Postgres fields.

## Reviewer Notes

- This commit should be pure configuration.
- No SQLAlchemy engine or app startup wiring belongs here.
