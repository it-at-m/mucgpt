# MUCGPT Repository Instructions

These instructions apply to all coding agents and automated development tools working in this repository.

## Scoped instructions

When working inside `mucgpt-frontend/`, also follow `mucgpt-frontend/AGENTS.md` — frontend-specific architecture, Fluent UI, styling, accessibility and design-system rules are defined there and are mandatory for frontend changes. For UI and styling decisions, `DESIGN.md` is the source of truth for the MUCGPT design system.

## What this is

MUCGPT is a web interface to LLMs for public administration (it@M / City of Munich). Users chat with an agentic system that can call tools (incl. MCP), and can create/share "assistants" — saved configurations of the agent (enabled tools + system prompts). Auth is via OpenID Connect (Keycloak) behind a Java RefArch API gateway.

## Monorepo layout

Five independently-versioned, independently-deployed components, each with its own `pyproject.toml`/`package.json`, `Dockerfile`, `uv.lock`, and CI workflow:

- **`mucgpt-core-service/`** — Python 3.13 / FastAPI. LLM agent orchestration (LangGraph/Deep Agents), tools, document parsing, conversation persistence (Postgres). The heart of the system.
- **`mucgpt-core-service/migrations/`** — Alembic migrations for the core service's Postgres schema (`chats`, `canvas_documents`, `documents`, store), released as a run-once container (`Dockerfile.migrations`, same `MIGRATION_*` env vars as the assistant migrations, DB settings via `MUCGPT_CORE_`).
- **`mucgpt-assistant-service/`** — Python 3.13 / FastAPI. CRUD + sharing of assistant configurations; departments/users via LDAP; talks to Postgres.
- **`mucgpt-assistant-service/migrations/`** — Alembic migrations for the assistant service's Postgres schema, released as a run-once container.
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
uv run ty check                 # type check (ty is configured per service, NOT at the repo root — the root venv has no service deps)

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

Each Python service is configured by a **`config.yaml`** (see each service's `config.yaml.example`, and `stack/*.config.yaml.example`). **YAML keys are lowercase** (`models:`, `redis:`, `host:`, `password:`); legacy UPPERCASE YAML keys are ignored — existing config files must migrate (mostly fails loudly at startup: missing required db fields, empty models list). Exception: a top-level `SSO:` section and `ROLE`/`ADMIN_ROLE` under `sso` **fail startup validation** (silently ignoring them would disable the SSO role check). Settings are pydantic-settings with nesting via `__` and a per-service prefix; env var names stay UPPERCASE and match case-insensitively:

- core-service: `MUCGPT_CORE_` (e.g. `MUCGPT_CORE_REDIS__HOST=valkey`)
- assistant-service + migrations: `MUCGPT_ASSISTANT_` (e.g. `MUCGPT_ASSISTANT_DB__PASSWORD=...`)

Model connection settings live in a **`providers`** section (`type: "openai"|"azure"`, `endpoint`, `api_key`, `api_version`); `models[]` entries only reference a provider via `provider: <key>` (plus `id`, `deployment`, `model_info`) — inline `type`/`endpoint`/`api_key`/`api_version` on model entries are rejected at startup with a migration pointer. Provider keys must be lowercase and must not contain `__` (env-var name segments are lowercased and split on `__`, so other keys would miss their env overrides). Per-provider env overrides work: `MUCGPT_CORE_PROVIDERS__<PROVIDER>__API_KEY` overrides one provider's api_key; `MUCGPT_CORE_PROVIDERS` (JSON object) / `MUCGPT_CORE_MODELS` (JSON array, entries use `provider` references) replace whole sections.

Langfuse is **not** part of the config: the Langfuse SDK reads the standard `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` env vars directly (host defaults to Langfuse cloud if unset). **`MUCGPT_CORE_LANGFUSE__*` env vars are no longer read (silently ignored)** — likely migration error; tracing degrades gracefully (log + disabled) when unset.

Source priority (core): constructor/init (tests) > env vars > `config.yaml` > `shared-config.yaml` > `.env`. Core config covers providers/models/prompts/MCP/Redis/SSO/db; assistant config covers db/redis/ldap/sso.

Secrets doctrine: real secrets (passwords, API keys, tokens) belong in **environment variables** (prefix + `__`), never in `config.yaml` (ConfigMap/etcd/Git leak risk). Provider API keys are configured per provider and are env-overridable via `MUCGPT_CORE_PROVIDERS__<PROVIDER>__API_KEY`; whole sections can be replaced via the `MUCGPT_CORE_PROVIDERS` / `MUCGPT_CORE_MODELS` JSON env vars.

Migration notes for older configs: (a) lowercase the `config.yaml` keys, (b) move model endpoint/api_key into `providers` and reference them via `provider: <key>`, (c) switch `MUCGPT_CORE_LANGFUSE__*` to the standard `LANGFUSE_*` env vars (see `docs/GETTING_STARTED.md`).

## Core service architecture (`mucgpt-core-service/app/`)

Entry: `app.py` → `backend.py` builds the FastAPI app, mounts `api_app` at `/api/`, and includes routers from `api/routers/`: `chat`, `compliance`, `generation`, `parsing`, `system`, `tools`, `document`, `export` (all under `/v1`). `init_app.py` has `warmup_app`/`destroy_app` lifespan hooks; `init_agent()` builds the tool collection + agent **per message** (known TODO, see `chat_router.py`).

**Agent** (`agent/`): `deep_agent.py::MUCGPTAgent` wraps LangChain **Deep Agents** (`deepagents.create_deep_agent`) in `_ConfiguredLangChainDeepAgentGraph`; `init_agent()` builds it per request. `DefaultAgentState` is always the state schema (per-request schema selection is no longer supported — see comment after PR #1177; `agent/tools/tools.py::select_agent_state_schema` still exists but its result is not used for the graph). Model-specific Deep Agents built-ins and extra middleware (summarization, todo list, tool-call limits, sub-agent) come from a harness profile registered per model at startup (`config/harness_profiles.py`). `agent_executor.py::run_agui_with_streaming` drives the agent and emits AG-UI events with Langfuse tracing; the only chat endpoint is `POST /v1/chat/v2/completions` (AG-UI SSE). The OpenAI-style `run_with_streaming`/`run_without_streaming` methods still exist but no router calls them.

- **Conversation persistence is server-side** (`persist=true`, the frontend default): `chat_router` checks/creates the `chats` ownership row, a Valkey lock allows one run per conversation (HTTP 409 otherwise), and the agent gets `FencedPostgresSaver` as checkpointer (`thread_id = conversation_id`). The first turn seeds the checkpoint with the client history; afterwards only the newest user message is sent. With `persist=false` the agent is stateless (no checkpointer, full client history, tools that require approval are dropped). IndexedDB in the browser is only a cache synced with the server's conversation list. Details: `docs/conversation-persistence.md`.
- Tools whose metadata sets `require_approval` are wired into `interrupt_on`: the run stops with an interrupt outcome on `RUN_FINISHED`, and the client resumes it with approval decisions (persisted chats only).
- Documents and scratch files use a Deep Agents `CompositeBackend` (`core/virtual_file_system_helper.py`): chat-local files live in graph state, and the user's uploaded documents (extracted text, max 10 per user) are mounted read-only at `/documents/` from an `AsyncPostgresStore`.
- Request-specific settings (`model`, `extra_body`, `user`, temperature, `enabled_tools`, `data_sources`) flow through `RequestContext` (the graph's `context_schema`); `middleware.py` (`ContextMiddleware`, `ToolStatusMiddleware`, `ToolErrorMiddleware`, `TokenUsageMiddleware`) applies them per model request. `ContextMiddleware` injects request `data_sources` into the prompt. `ToolStatusMiddleware` adds a required `status_message` argument to every tool definition and strips it again before the tool runs (the frontend shows it as the live activity label) — it must stay **after** `ContextMiddleware`, which filters tools as `BaseTool` objects; from there on tools are flat `{name, description, parameters}` dicts.

**Tools** (`agent/tools/`): **read `agent/tools/README.md` first** — it's the authoritative guide.
- Local tools use the `LocalTool` spec pattern (`spec.py`): add a module with `TOOL = LocalTool(id=..., factory=..., metadata=..., is_configured=...)` and register it in `LOCAL_TOOLS` in `tools.py`; `get_tools()` and `GET /v1/tools` pick it up automatically.
- MCP tools are a **config change only** (`MCP` settings / `MUCGPT_CORE_MCP__...`), loaded per-user by `mcp.py::McpLoader` and cached in Valkey/Redis with distributed locking — that caching is load-bearing, don't simplify it away. `McpBearerAuthProvider` forwards the per-user token to MCP servers.
- Internet search is provided through a configured MCP server, not a local tool.

**Prompts** are resolved by `core/lf_prompts.py::PromptPool`: prompts configured under `prompts:` in `config.yaml` are loaded from Langfuse, with optional local Markdown fallbacks in `agent/prompt_pool/` (same name without `.md`; the repo currently ships none). This covers the agent's `default_instructions`, `generation_prompts` (assistant title/description/system prompt) and the compliance prompts — don't hard-code prompt strings.

**Compliance**: `compliance_router` + `core/compliance.py` screen assistant prompts against EU AI Act high-risk categories (feature flag `ai_act_compliance_check_enabled`). Tuning workflow: `app/scripts/run_compliance_experiment.py` + the repo skill `compliance-prompt-improvement` (`.agents/skills/`).

**Parsing** (`parsing/`): factory pattern; Xberg (`xberg.py`) is the only backend (Kreuzberg is ELv2-licensed, not MIT).

## Assistant service architecture (`mucgpt-assistant-service/app/`)

Standard FastAPI + SQLAlchemy (async) + Postgres. Routers in `api/routers/` (`assistants`, `users`, `department`, `system`). `database/` uses a generic `repo.py` + specialized `assistant_repo.py`. `core/organization/` loads org structure from LDAP (`ldap_loader.py`) with a `directory_cache`. Schema changes go through the **separate migrations component** (Alembic) — never hand-edit the live schema.

**Migrations** (`mucgpt-assistant-service/migrations/`): a separately released, run-once container built from the assistant-service project. Entrypoint: `python -m migrations.run_migrations`. Controlled entirely via env vars (see the script's docstring): `MIGRATION_REVISION` (default `head`), `MIGRATION_LOG_LEVEL`, `MIGRATION_CHECK_ONLY`, `MIGRATION_DB_TIMEOUT`/`MIGRATION_DB_RETRIES`/`MIGRATION_DB_RETRY_DELAY`, and `MIGRATION_LOCK_TIMEOUT`.

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

Images are released per component by pushing a tag `mucgpt-{frontend,core,core-migrations,assistant,assistant-migrations}-<version>` (triggers the matching `docker-release-*.yml` workflow); a frontend tag also redeploys GitHub Pages. Use the interactive `tag-version.ps1` (bumps the manifest version via `uv version`/package.json and creates+pushes the tag) or tag manually per `docs/DEVELOPMENT.md`.

## Docs worth reading

`docs/GETTING_STARTED.md` (config, LDAP, SSO, MCP setup), `docs/DEVELOPMENT.md` (uv workflow, release tags, MCP credential security note), `stack/README.md` (compose topology, ports — gateway :8083, Keycloak :8100 `admin/admin`, needs a `keycloak` hosts entry), `mucgpt-core-service/app/agent/tools/README.md` (tool handling), `DESIGN.md`. Note: `docs/FEATURES.md` is the user-facing view (e.g. "chat history stays in the browser") — the technical truth is in the sections above.
