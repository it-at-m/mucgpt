# MUCGPT Repository Instructions

These instructions apply to all coding agents and automated development tools
working in this repository.

## Scoped instructions

When working inside mucgpt-frontend, also follow:

mucgpt-frontend/AGENTS.md

Frontend-specific architecture, Fluent UI, styling, accessibility and design-system rules are defined there and are mandatory for frontend changes.

For UI and styling decisions, DESIGN.md is the source of truth for the MUCGPT design system.

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

Priority: constructor/init (tests) > env vars (incl. `.env`) > `config.yaml`. core config covers MODELS/Langfuse/MCP/Redis/DB (chat persistence Postgres)/SSO; assistant config covers DB/Redis/LDAP/SSO.

## Core service architecture (`mucgpt-core-service/app/`)

Entry: `app.py` → `backend.py` builds the FastAPI app, mounts `api_app` at `/api/`, and includes routers from `api/routers/` (`chat`, `compliance`, `generation`, `tools`, `parsing`, `system`). `init_app.py` has `warmup_app`/`destroy_app` lifespan hooks.

**Agent** (`agent/`): `react_agent.py` wraps LangChain's `create_agent` (LangGraph) in `_ConfiguredLangChainAgentGraph`. The compiled graph is reused across invocations and uses `DefaultAgentState` as its stable, compile-time state schema. Request-specific model settings (`extra_body`, `user`, selected LLM alternative) and the enabled-tool allowlist are passed through `RequestContext`; `middleware.py` applies them to each model request and handles tool errors.

- **Tool status messages.** `ToolStatusMiddleware` adds a required `status_message` argument to every tool definition the model sees (a one-line, user-facing description of the call) and strips it again before the tool runs, so tools and MCP servers never receive it. The frontend shows it as the live activity label. It must stay after `ContextMiddleware`, which filters tools as `BaseTool` objects; from there on tools are flat `{name, description, parameters}` dicts.
- **State schema is not selected per request.** LangGraph state schemas are fixed when the reusable graph is compiled. The stable schema name is added to Langfuse trace metadata, while enabled tools remain request-scoped and are filtered by middleware.
- **Tools** live in `agent/tools/` (`brainstorm`, `simplify`, `internet_search`, plus MCP tools loaded dynamically by `mcp.py::McpLoader`). `tools.py::ToolCollection` is the registry; `tools_router.py` exposes them. `tools.py` also defines `make_retrieval_tool` (`RetrievePMDocs`), which queries a configurable retrieval backend (`RETRIEVAL.API_URL` / `MUCGPT_CORE_RETRIEVAL__API_URL`) across configurable PM-document collections and returns reranked matches — like `internet_search`, it's only added to the tool list when `is_retrieval_configured()` is true (i.e. `RETRIEVAL.API_URL` is set).
- **Prompts** are Markdown files in `agent/prompt_pool/` and `create_assistant/`, read at import time — edit the `.md`, not string literals.

**Chat persistence is server-side via LangGraph checkpoints** (Postgres, `core/persistance_helpers.py`). The client-generated `conversation_id` is the LangGraph `thread_id`. A `chats` table (`database/`, SQLAlchemy, created with `create_all` at startup; no migrations yet) records owner, title and timestamps. Every chat request upserts it, so a conversation belongs to whoever first uses its id and others get 403. Endpoints for listing, reading back and deleting conversations live in `chat_router.py`.

- **Seeding.** The client still sends its full history. On the first turn of a conversation (no checkpoint yet) the full history is passed to the graph; afterwards only the newest user message is appended (`get_messages_for_agent`). Don't send the full history on later turns: the `add_messages` reducer would duplicate it. Consequence: changes to the system prompt don't affect existing conversations.
- **One checkpoint per run.** Graphs run with `durability="exit"` (`deep_agent.py::CHECKPOINT_DURABILITY`) because only the latest checkpoint is ever read; there is no mid-run resume. The OSS Postgres saver has no `prune`, so old per-turn checkpoints accumulate until the conversation is deleted.
- **Deletion** removes the checkpoint thread *before* the ownership row and keeps the row on failure. Otherwise an orphaned checkpoint could be claimed by the next user of that id. The frontend calls `DELETE /v1/conversations/{id}` when a chat (or an assistant's chats) is deleted locally.
- **Stateless requests.** `persist: false` (used by the assistant preview chat) skips ownership and checkpoints and runs on the full client history without a checkpointer.
- **Summarization.** Don't enable `enable_summarization` in production yet. It rewrites the checkpointed messages, so the readback endpoint would lose history until a separate transcript store exists.

**Parsing** (`parsing/`): factory pattern; Kreuzberg is the only backend (note: Kreuzberg is ELv2-licensed, not MIT).

## Assistant service architecture (`mucgpt-assistant-service/app/`)

Standard FastAPI + SQLAlchemy (async) + Postgres. Routers in `api/routers/` (`assistants`, `users`, `department`, `system`). `database/` uses a generic `repo.py` + specialized `assistant_repo.py`. `core/organization/` loads org structure from LDAP (`ldap_loader.py`) with a `directory_cache`. Schema changes go through the **separate migrations component** (Alembic) — never hand-edit the live schema.

**Migrations** (`mucgpt-assistant-service-migrations/`): a standalone, run-once container whose entrypoint is `uv run migrations/run_migrations.py` (Alembic under the hood). Behavior is controlled entirely via env vars (documented in the script's own docstring): `MIGRATION_REVISION` (default `head`), `MIGRATION_LOG_LEVEL`, `MIGRATION_CHECK_ONLY` (validate config without migrating), `MIGRATION_SHOW_SQL`, `MIGRATION_DB_TIMEOUT`/`MIGRATION_DB_RETRIES`/`MIGRATION_DB_RETRY_DELAY` (connection retry tuning).

## Conventions

- run python tooling with uv or uvx (e.g. `uvx --from onnx python -c ...` for one-off scripts or `uv run pytest` for project tests) and never pip install into a system python.
- Ruff selects `E,F,I,UP`, ignores `E501,E701`. Python target 3.13 (services), formatted/linted via pre-commit.
- Commits use **gitmoji** (e.g. `✨`, see recent history); branches `feat/...`, PRs against `main`.
- Frontend API clients are in `src/api/` (`core-client`, `assistant-client`, `conversations-client`, `user-client`); MSW handlers in `src/mocks/` back the mocked dev mode. Pages in `src/pages/`, shared UI in `src/components/`.
- Gateway path routing: `/api/backend/**` → core, `/api/assistant/**` → assistant, `/api/sso/**` → Keycloak, `/**` → frontend.

## Docs worth reading

`docs/GETTING_STARTED.md` (config, LDAP, SSO, MCP setup), `docs/DEVELOPMENT.md` (uv workflow, image release via git tags, MCP credential security note), `stack/README.md` (compose topology, ports, config), `DESIGN.md`, `docs/FEATURES.md` (user-facing feature descriptions — e.g. it describes chat history as staying local in the browser; that's the simplified user-facing view, not the technical one above).
