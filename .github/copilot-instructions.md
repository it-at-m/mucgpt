# Copilot Instructions for MUCGPT

## Architecture Overview

This is a multi-service AI assistant platform consisting of:

- **Frontend**: React 18/Vite/TypeScript Single Page Application (`mucgpt-frontend/`). Uses **Fluent UI** for components.
- **Core Service**: FastAPI/Python (3.10+) handling LLM interactions via **LangChain 0.3+** and **LangGraph** (`mucgpt-core-service/`).
- **Assistant Service**: FastAPI/Python handling data persistence and assistant management (`mucgpt-assistant-service/`).
- **Infrastructure**: Docker Compose stack with Keycloak, PostgreSQL, Redis (Valkey), and Gateways (`stack/`).

### Key Service Boundaries

- **Core Service**: Stateless AI logic. Uses `langgraph` for flows and `langfuse`/`langsmith` for observability.
- **Assistant Service**: State management (Assistants, Users, Organization). Uses SQLAlchemy + Alembic.
- **Frontend**: Communicates with Backend services via the API Gateway (port 8083).

## Service Architecture

The system is split into microservices to separate concerns and allow independent scaling:

### `mucgpt-frontend`

- **Role**: User Interface
- **Tech**: React, Vite, Fluent UI
- **Responsibility**: Provides the chat interface, assistant management, and settings.
- **Connection**: Talks to the backend via the Gateway (nginx).

### `mucgpt-core-service`

- **Role**: AI Logic & Orchestration
- **Tech**: Python, FastAPI, LangChain, LangGraph
- **Responsibility**:
  - Manages LLM interactions (OpenAI, Azure OpenAI).
  - Executes agentic workflows using LangGraph.
  - Handles tool execution and retrieval (RAG).
  - Stateless design for easy scaling.

### `mucgpt-assistant-service`

- **Role**: Persistence & Management
- **Tech**: Python, FastAPI, SQLAlchemy, PostgreSQL
- **Responsibility**:
  - Stores user data, assistants, and organization structure.
  - Manages user permissions and access control.
  - Handles database migrations via `mucgpt-assistant-service-migrations`.

### `mucgpt-assistant-service-migrations`

- **Role**: Database Schema Management
- **Tech**: Alembic, Python
- **Responsibility**: Applies database schema updates to the PostgreSQL instance used by the assistant service.

## Developer Workflows

### Python Development (Backend)

- **Package Management**: **STRICTLY USE `uv`**. Do not use `pip` or `poetry`.
  - Install/Sync: `uv sync --all-extras`
  - Add dependency: `uv add <package>`
  - Run scripts: `uv run <script>`
- **Testing**: `uv run pytest` (uses `pytest-asyncio`, `pytest-mock`, `pytest-cov`)
  - **Fixtures**: Use `conftest.py` for shared fixtures (e.g., `async_engine`, `db_session` in `mucgpt-assistant-service`).
  - **Database**: Tests use in-memory SQLite (`sqlite+aiosqlite:///:memory:`) for speed and isolation.
- **Linting/Formatting**: `uv run ruff check --fix` and `uv run ruff format`

### Frontend Development

- **Tech Stack**: React 18, Vite, TypeScript, Fluent UI 8/9.
- **Start**: `npm run dev` (uses **MSW** for API mocking) or `npm run dev-no-mock` (Real API via Docker).
- **Build**: `npm run build`.
- **Linting**: `eslint` and `prettier`.
- **Scripts**:
  - `npm run fix`: Runs prettier and eslint fix
  - `npm run lint`: Runs checks (prettier, eslint, tsc context)
  - `npm run type-check`: Runs TypeScript compiler check only

### Infrastructure (Local Stack)

- Controlled via `podman compose` or `docker compose` in `stack/` directory.
- `stack/.env` is required (copy from `.env.example`).
- **Services**:
  - Frontend: `http://localhost:8083`
  - Keycloak: `http://localhost:8100` (admin/admin)
  - PgAdmin: `http://localhost:5050`

## Coding Conventions

### Python (Services)

- **FastAPI**: Use `APIRouter` for modularity. Pydantic v2 models for request/response.
- **AsyncIO**: Prefer `async/await` for all I/O-bound operations.
- **Type Hints**: Mandatory for all function signatures.
- **Logging**: Use strict structured logging configured in `logconf.yaml`.
- **Config**: Use `pydantic-settings` (BaseSettings) for configuration management.

### React (Frontend)

- **Component Structure**: Functional components with Hooks.
- **UI Library**: Use **Fluent UI** components (`@fluentui/react` or `@fluentui/react-components`).
- **State Management**: Context API / Hooks.
- **TypeScript**: Strict typing required. Avoid `any`.
- **Styling**: Prefer CSS-in-JS (Griffel/makeStyles) or Fluent UI styling over raw CSS files where possible, though `index.css` exists.

## Specific Patterns

- **Database Migrations**: Handled by `mucgpt-assistant-service-migrations`. Run via `alembic`.
- **Authentication**: OIDC via Keycloak. Services validate JWT tokens using `joserfc`.
- **LangGraph**: Used in `mucgpt-core-service` for complex agentic workflows. Inspect `src/agent` or `src/simply` for examples.
- **Model Context Protocol (MCP)**: Configured in `mucgpt-core-service` via `MCPSettings`. Supports connecting to external tool providers.
- **Notebooks**: Jupyter notebooks in `notebooks/` used for experimentation.
- **Documentation**: Documentation and architecture diagrams are in `docs/`.

## File Locations

- **API Models**: Shared definitions often mirrored in `api/api_models.py` or similar.
- **Configuration**: Pydantic `BaseSettings` used in `config/settings.py`.
- **Tests**: Located in `tests/` folder of each service. prefer structured `unit/` and `integration/` splits.
