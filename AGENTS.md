# MUCGPT Repository Instructions

These instructions apply to all coding agents and automated development tools working in this repository.

## Scoped instructions

When working inside `mucgpt-frontend/`, also follow `mucgpt-frontend/AGENTS.md` — frontend-specific architecture, Fluent UI, styling, accessibility and design-system rules are defined there and are mandatory for frontend changes. For UI and styling decisions, `DESIGN.md` is the source of truth for the MUCGPT design system.

## What this is

MUCGPT is a web interface to LLMs for public administration (it@M / City of Munich). Users chat with an agentic system that can call tools (incl. MCP), and can create/share "assistants" — saved configurations of the agent (enabled tools + system prompts). Auth is via OpenID Connect (Keycloak) behind a Java RefArch API gateway.

## Monorepo layout

Four independently-versioned, independently-deployed components, each with its own `pyproject.toml`/`package.json`, `Dockerfile`, `uv.lock`, and CI workflow:

- **`mucgpt-core-service/`** — Python 3.13 / FastAPI. LLM agent orchestration (LangGraph/Deep Agents), tools, document parsing. The heart of the system.
- **`mucgpt-assistant-service/`** — Python 3.13 / FastAPI. CRUD + sharing of assistant configurations; departments/users via LDAP; talks to Postgres.
- **`mucgpt-assistant-service-migrations/`** — Alembic migrations for the assistant service's Postgres schema (run-once container).
- **`mucgpt-frontend/`** — React 19 + TypeScript + Vite 8 (Rolldown), Fluent UI v9, i18next, PWA. MSW mocks the backend in dev.

The root `pyproject.toml` is only a dev wrapper (ruff + pre-commit); its pytest/ruff paths are stale. **Run all commands from inside the relevant service directory**, never from the root.

## Commands

All Python services use **uv** and are managed from inside their own directory:

```bash
# Python service (run inside the service dir)
uv sync --all-extras            # install deps
uv run pytest                   # all tests (CI does exactly this; no infra needed)
uv run pytest tests/unit        # one suite / dir
uv run pytest tests/unit/test_foo.py::test_bar   # single test
uv run pytest -m "not integration"               # skip integration-marked tests
uv run ruff check               # lint
uv run ruff check --fix         # lint + autofix

# Frontend (inside mucgpt-frontend/)
npm run dev          # Vite dev server WITH MSW API mocking (no backend needed)
npm run dev-no-mock  # Vite dev server; proxies /api to the stack gateway on localhost:8083
npm run lint         # prettier --check + eslint + tsc --noEmit
npm run fix          # prettier --write + eslint --fix
npm run build        # tsc && vite build
```

- Pre-commit: `uv run pre-commit install` — ruff lint+format, gitleaks, and a hook that runs `npm run fix` in the frontend whenever `mucgpt-frontend/src/` files change.
- Node >= 24 required (`engines` in `package.json`).

## Testing quirks

- **No real infrastructure needed.** `pytest-env` (in each service's `pyproject.toml`) injects fake config env vars (`MUCGPT_CORE_MODELS`, `MUCGPT_ASSISTANT_DB__*`, …), so tests run without `config.yaml`, LLM endpoints, Postgres, or Redis. Assistant-service "integration" tests use aiosqlite, not Postgres.
- Tests are split by **directory** (`tests/unit/`, `tests/integration/`); "integration" here means FastAPI `TestClient` router tests, not external services.
- Only the `integration` marker is actually used in tests. Core registers `unit`/`integration`; assistant registers only `integration` (`--strict-markers`), so `-m unit` errors there — use `-m "not integration"`.

## Configuration model

Each Python service is configured by a **`config.yaml`** (see each service's `config.yaml.example`, and `stack/*.config.yaml.example`). Settings are pydantic-settings with nesting via `__` and a per-service prefix:

- core-service: `MUCGPT_CORE_` (e.g. `MUCGPT_CORE_REDIS__HOST=valkey`)
- assistant-service + migrations: `MUCGPT_ASSISTANT_` (e.g. `MUCGPT_ASSISTANT_DB__PASSWORD=...`)

Source priority (core): constructor/init (tests) > env vars > `config.yaml` > `shared-config.yaml` > `.env`. Core config covers MODELS/Langfuse/MCP/Redis/SSO; assistant config covers DB/Redis/LDAP/SSO.

## Core service architecture (`mucgpt-core-service/app/`)

Entry: `app.py` → `backend.py` builds the FastAPI app, mounts `api_app` at `/api/`, and includes routers from `api/routers/`: `chat`, `compliance`, `generation`, `parsing`, `system`, `tools` (all under `/v1`). `init_app.py` has `warmup_app`/`destroy_app` lifespan hooks; `init_agent()` builds the tool collection + agent **per message** (known TODO, see `chat_router.py`).

**Agent** (`agent/`): `deep_agent.py::MUCGPTAgent` wraps LangChain **Deep Agents** (`deepagents.create_deep_agent`) in `_ConfiguredLangChainDeepAgentGraph`. The graph is compiled once and reused; `DefaultAgentState` is fixed at compile time (per-request schema selection is no longer supported — see comment after PR #1177; `agent/tools/tools.py::select_agent_state_schema` still exists but its result is not used for the compiled graph). `agent_executor.py` drives the agent and emits OpenAI-compatible `ChatCompletionChunk` streams with Langfuse tracing.

- **`checkpointer=None` is deliberate** in `create_deep_agent`. Chat persistence is request-authoritative: the client resends full history each turn; `conversation_id` is accepted but unused server-side (history lives client-side in IndexedDB). Don't "fix" this by attaching the checkpointer.
- Request-specific settings (`model`, `extra_body`, `user`, temperature, `enabled_tools`, `data_sources`) flow through `RequestContext` (the graph's `context_schema`); `middleware.py` (`ContextMiddleware`, `ToolStatusMiddleware`, `ToolErrorMiddleware`, `TokenUsageMiddleware`) applies them per model request. `ContextMiddleware` injects request `data_sources` into the prompt. `ToolStatusMiddleware` adds a required `status_message` argument to every tool definition and strips it again before the tool runs (the frontend shows it as the live activity label) — it must stay **after** `ContextMiddleware`, which filters tools as `BaseTool` objects; from there on tools are flat `{name, description, parameters}` dicts.

**Tools** (`agent/tools/`): **read `agent/tools/README.md` first** — it's the authoritative guide.
- Local tools use the `LocalTool` spec pattern (`spec.py`): add a module with `TOOL = LocalTool(id=..., factory=..., metadata=..., is_configured=...)` and register it in `LOCAL_TOOLS` in `tools.py`; `get_tools()` and `GET /v1/tools` pick it up automatically.
- MCP tools are a **config change only** (`MCP` settings / `MUCGPT_CORE_MCP__...`), loaded per-user by `mcp.py::McpLoader` and cached in Redis with distributed locking — that caching is load-bearing, don't simplify it away. `McpBearerAuthProvider` forwards the per-user token to MCP servers.
- Internet search is provided through a configured MCP server, not a local tool.

**Prompts** are Markdown files in `agent/prompt_pool/` (incl. `generation_prompts/` for assistant title/description/system-prompt generation and `compliance_prompts/`), read at import time — edit the `.md`, not string literals.

**Compliance**: `compliance_router` + `core/compliance.py` screen assistant prompts against EU AI Act high-risk categories (feature flag `AI_ACT_COMPLIANCE_CHECK_ENABLED`). Tuning workflow: `app/scripts/run_compliance_experiment.py` + the repo skill `compliance-prompt-improvement` (`.agents/skills/`).

**Parsing** (`parsing/`): factory pattern; Xberg (`xberg.py`) is the only backend (Kreuzberg is ELv2-licensed, not MIT).

## Assistant service architecture (`mucgpt-assistant-service/app/`)

Standard FastAPI + SQLAlchemy (async) + Postgres. Routers in `api/routers/` (`assistants`, `users`, `department`, `system`). `database/` uses a generic `repo.py` + specialized `assistant_repo.py`. `core/organization/` loads org structure from LDAP (`ldap_loader.py`) with a `directory_cache`. Schema changes go through the **separate migrations component** (Alembic) — never hand-edit the live schema.

**Migrations** (`mucgpt-assistant-service-migrations/`): standalone, run-once container, entrypoint `uv run migrations/run_migrations.py`. Controlled entirely via env vars (see the script's docstring): `MIGRATION_REVISION` (default `head`), `MIGRATION_LOG_LEVEL`, `MIGRATION_CHECK_ONLY`, `MIGRATION_SHOW_SQL`, `MIGRATION_DB_TIMEOUT`/`MIGRATION_DB_RETRIES`/`MIGRATION_DB_RETRY_DELAY`.

## Frontend notes

- API clients in `src/api/` (`core-client`, `assistant-client`, `user-client`); MSW handlers in `src/mocks/` back mocked dev mode. Pages in `src/pages/`, shared UI in `src/components/`.
- The dev server proxies `/api` → `http://localhost:8083` (the gateway), so `dev-no-mock` needs the stack running.
- GitHub Pages builds use base `/mucgpt/` (`npm run build:ghpages` / `deploy`).

## Conventions

- Run Python tooling with uv/uvx (e.g. `uvx --from onnx python -c ...` for one-off scripts, `uv run pytest` for project tests); never pip install into a system Python.
- Ruff selects `E,F,I,UP`, ignores `E501,E701`; target py313 (per-service config).
- Commits use **gitmoji** (e.g. `✨`, see recent history); branches `feat/...`, PRs against `main`.
- Gateway path routing (see `stack/docker-compose.yml`): `/api/backend/**` → core (rewritten to `/api/...`), `/api/assistant/**`, `/api/user/**`, `/api/directory/**` → assistant, `/api/sso/**` → Keycloak, `/**` → frontend.

## Release / deploy

Images are released per component by pushing a tag `mucgpt-{frontend,core,assistant,assistant-migrations}-<version>` (triggers the matching `docker-release-*.yml` workflow); a frontend tag also redeploys GitHub Pages. Use the interactive `tag-version.ps1` (bumps the manifest version via `uv version`/package.json and creates+pushes the tag) or tag manually per `docs/DEVELOPMENT.md`.

## Docs worth reading

`docs/GETTING_STARTED.md` (config, LDAP, SSO, MCP setup), `docs/DEVELOPMENT.md` (uv workflow, release tags, MCP credential security note), `stack/README.md` (compose topology, ports — gateway :8083, Keycloak :8100 `admin/admin`, needs a `keycloak` hosts entry), `mucgpt-core-service/app/agent/tools/README.md` (tool handling), `DESIGN.md`. Note: `docs/FEATURES.md` is the user-facing view (e.g. "chat history stays in the browser") — the technical truth is in the sections above.
