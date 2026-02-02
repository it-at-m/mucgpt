# Copilot Instructions for MUCGPT

## Architecture Overview

This is a multi-service AI assistant platform consisting of:

- **Frontend**: React/Vite/TypeScript Single Page Application (`mucgpt-frontend/`)
- **Core Service**: FastAPI/Python handling LLM interactions via LangChain/LangGraph (`mucgpt-core-service/`)
- **Assistant Service**: FastAPI/Python handling data persistence and assistant management (`mucgpt-assistant-service/`)
- **Infrastructure**: Docker Compose stack with Keycloak, PostgreSQL, Valkey, and Gateways (`stack/`)

### Key Service Boundaries

- **Core Service**: Stateless AI logic. Uses `langgraph` for flows.
- **Assistant Service**: State management (Assistants, Users, Organization). Uses SQLAlchemy + Alembic.
- **Frontend**: communicates with Backend services via the API Gateway (port 8083).

## Developer Workflows

### Python Development (Backend)

- **Package Management**: WE USE `uv`. Do not use `pip` or `poetry`.
  - Install/Sync: `uv sync --all-extras`
  - Add dependency: `uv add <package>`
  - Run scripts: `uv run <script>`
- **Testing**: `uv run pytest`
- **Linting/Formatting**: `uv run ruff check --fix` and `uv run ruff format`

### Frontend Development

- **Start**: `npm run dev` (Mocked API) or `npm run dev-no-mock` (Real API via Docker)
- **Build**: `npm run build`

### Infrastructure (Local Stack)

- controlled via `podman compose` or `docker compose` in `stack/` directory.
- `stack/.env` is required (copy from `.env.example`).
- **Services**:
  - Frontend: `http://localhost:8083`
  - Keycloak: `http://localhost:8100` (admin/admin)
  - PgAdmin: `http://localhost:5050`

## Coding Conventions

### Python (Services)

- **FastAPI**: Use `APIRouter` for modularity. Pydantic models for request/response.
- **AsyncIO**: Prefer `async/await` for all I/O bound operations (DB, HTTP calls).
- **Type Hints**: Mandatory for all function signatures.
- **Logging**: Use strict structured logging configured in `logconf.yaml`.

### React (Frontend)

- **Component Structure**: Functional components with Hooks.
- **State Management**: Context API / Hooks.
- **TypeScript**: Strict typing required. Avoid `any`.

## Specific Patterns

- **Database Migrations**: Handled by `mucgpt-assistant-service-migrations`. Run via `alembic` commands wrapped in the service scripts.
- **Authentication**: OIDC via Keycloak. Services validate JWT tokens using `joserfc`.
- **LangGraph**: Used in `mucgpt-core-service` for complex agentic workflows. Inspect `src/agent` or `src/simply` for examples.

## File Locations

- **API Models**: Shared definitions often mirrored in `api/api_models.py` or similar.
- **Configuration**: Pydantic `BaseSettings` used in `config/`.
- **Tests**: Located in `tests/` folder of each service. prefer structured `unit/` and `integration/` splits.
