# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MUCGPT is a web interface to LLMs for public administration (it@M / City of Munich). Users chat with an agentic system that can call tools (incl. MCP), and can create/share "assistants" — saved configurations of the agent (enabled tools + system prompts). Auth is via OpenID Connect (Keycloak) behind a Java RefArch API gateway.

## Monorepo layout

Four independently-versioned, independently-deployed components, each with its own `pyproject.toml`/`package.json`, `Dockerfile`, `uv.lock`, and CI workflow:

- **`mucgpt-core-service/`** — Python 3.13 / FastAPI. LLM agent orchestration (LangGraph), tools, chat, document parsing, server-side chat persistence. The heart of the system.
- **`mucgpt-assistant-service/`** — Python 3.13 / FastAPI. CRUD + sharing of assistant configurations; departments/users via LDAP; talks to Postgres.
- **`mucgpt-assistant-service-migrations/`** — Alembic migrations for the assistant service's Postgres schema (run-once container).
- **`mucgpt-frontend/`** — React 19 + TypeScript + Vite, Fluent UI, i18next. MSW mocks the backend in dev.

The root `pyproject.toml` is a thin dev wrapper (ruff + pre-commit). Real dependency sets live in each service.

## Commands

All Python services use **uv** and are managed from inside their own directory (`cd mucgpt-core-service` etc.).

```bash
# Python service (run inside the service dir)
uv sync --all-extras            # install deps
uv run pytest                   # run all tests (config in that service's pyproject.toml)
uv run pytest tests/unit        # one suite / dir
uv run pytest tests/unit/test_foo.py::test_bar   # single test
uv run pytest -m "not integration"               # skip integration-marked tests
uv run ruff check               # lint
uv run ruff check --fix         # lint + autofix

# Frontend (inside mucgpt-frontend/)
npm run dev          # Vite dev server WITH MSW API mocking (no backend needed)
npm run dev-no-mock  # Vite dev server hitting the real container stack
npm run lint         # prettier --check + eslint + tsc --noEmit
npm run fix          # prettier --write + eslint --fix
npm run build        # tsc && vite build

# Full local stack (inside stack/) — Postgres, Keycloak, Valkey, gateway, all services
podman compose up -d
podman compose -f docker-compose.yml -f docker-compose.dev.yml up   # routes gateway to LOCALLY-running services
```

Pre-commit: `uv run pre-commit install` (ruff lint+format, hooks in `.pre-commit-config.yaml`).

Tests are marked `unit` / `integration` (registered as pytest markers; the services use `--strict-markers`).

## Configuration model

Each Python service is configured by a **`config.yaml`** (see each service's `config.yaml.example`, and `stack/*.config.yaml.example`). Settings are pydantic-settings with **env-var overrides** that win over YAML. Nesting uses a `__` delimiter and a per-service prefix:

- core-service: `MUCGPT_CORE_` (e.g. `MUCGPT_CORE_REDIS__HOST=valkey`)
- assistant-service + migrations: `MUCGPT_ASSISTANT_` (e.g. `MUCGPT_ASSISTANT_DB__PASSWORD=...`)

Priority: constructor/init (tests) > env vars (incl. `.env`) > `config.yaml`. core config covers MODELS/Langfuse/MCP/Redis/SSO; assistant config covers DB/Redis/LDAP/SSO.

## Core service architecture (`mucgpt-core-service/app/`)

Entry: `app.py` → `backend.py` builds the FastAPI app, mounts `api_app` at `/api/`, and includes routers from `api/routers/` (`chat`, `conversations`, `tools`, `parsing`, `system`). `init_app.py` has `warmup_app`/`destroy_app` lifespan hooks.

**Agent** (`agent/`): `react_agent.py` wraps LangChain's `create_agent` (LangGraph) in `_ConfiguredLangChainAgentGraph`. The graph is **rebuilt per request** when the requested tools/model/state-schema differ from the base graph — request-specific model bindings (`extra_body`, `user`, selected LLM alternative) and tool selection are applied in `_prepare_run`. `middleware.py` injects `RequestContext` and handles tool errors.

- **State schema is chosen dynamically from the enabled tools** via `agent/state_models/registry.py` + `tools.py::select_agent_state_schema` (e.g. Atlassian tools → `atlassian_state`). The selected schema name is added to Langfuse trace metadata.
- **Tools** live in `agent/tools/` (`brainstorm`, `simplify`, `internet_search`, plus MCP tools loaded dynamically by `mcp.py::McpLoader`). `tools.py::ToolCollection` is the registry; `tools_router.py` exposes them. `tools.py` also defines `make_retrieval_tool` (`RetrievePMDocs`), which queries a configurable retrieval backend (`RETRIEVAL.API_URL` / `MUCGPT_CORE_RETRIEVAL__API_URL`) across configurable PM-document collections and returns reranked matches — like `internet_search`, it's only added to the tool list when `is_retrieval_configured()` is true (i.e. `RETRIEVAL.API_URL` is set).
- **Prompts** are Markdown files in `agent/prompt_pool/` and `create_assistant/`, read at import time — edit the `.md`, not string literals.

**Chat persistence is request-authoritative.** The client resends full history each turn and supplies conversation IDs. The LangGraph **checkpointer is deliberately kept OFF the chat-serving graphs** (`checkpointer=None` in every `create_agent` call) so that no `thread_id` is required and the `add_messages` reducer can't double messages. It's held dormant on the object only for a possible future resume path. Server-side history is persisted separately via `database/conversation_repo.py` and the `conversations_router`. Don't "fix" this by attaching the checkpointer.

**Parsing** (`parsing/`): factory pattern; Kreuzberg is the only backend (note: Kreuzberg is ELv2-licensed, not MIT).

## Assistant service architecture (`mucgpt-assistant-service/app/`)

Standard FastAPI + SQLAlchemy (async) + Postgres. Routers in `api/routers/` (`assistants`, `users`, `department`, `system`). `database/` uses a generic `repo.py` + specialized `assistant_repo.py`. `core/organization/` loads org structure from LDAP (`ldap_loader.py`) with a `directory_cache`. Schema changes go through the **separate migrations component** (Alembic) — never hand-edit the live schema.

**Migrations** (`mucgpt-assistant-service-migrations/`): a standalone, run-once container whose entrypoint is `uv run migrations/run_migrations.py` (Alembic under the hood). Behavior is controlled entirely via env vars (documented in the script's own docstring): `MIGRATION_REVISION` (default `head`), `MIGRATION_LOG_LEVEL`, `MIGRATION_CHECK_ONLY` (validate config without migrating), `MIGRATION_SHOW_SQL`, `MIGRATION_DB_TIMEOUT`/`MIGRATION_DB_RETRIES`/`MIGRATION_DB_RETRY_DELAY` (connection retry tuning).

## Conventions

- Ruff selects `E,F,I,UP`, ignores `E501,E701`. Python target 3.13 (services), formatted/linted via pre-commit.
- Commits use **gitmoji** (e.g. `✨`, see recent history); branches `feat/...`, PRs against `main`.
- Frontend API clients are in `src/api/` (`core-client`, `assistant-client`, `conversations-client`, `user-client`); MSW handlers in `src/mocks/` back the mocked dev mode. Pages in `src/pages/`, shared UI in `src/components/`.
- Gateway path routing: `/api/backend/**` → core, `/api/assistant/**` → assistant, `/api/sso/**` → Keycloak, `/**` → frontend.

## Docs worth reading

`docs/GETTING_STARTED.md` (config, LDAP, SSO, MCP setup), `docs/DEVELOPMENT.md` (uv workflow, image release via git tags, MCP credential security note), `stack/README.md` (compose topology, ports, config), `DESIGN.md`, `docs/FEATURES.md` (user-facing feature descriptions — e.g. it describes chat history as staying local in the browser; that's the simplified user-facing view, not the technical one above).
