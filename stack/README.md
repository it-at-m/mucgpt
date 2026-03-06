# MUCGPT Stack - Docker Compose

This directory contains the Docker Compose configuration for running the complete MUCGPT stack locally.

> 📚 For complete project documentation, see the [main README](../README.md) and [development guide](../docs/DEVELOPMENT.md).

## Quick Start

**Prerequisites:**

- Podman or Docker installed
- `keycloak` entry in your `hosts` file (see [RefArch-Docs](https://refarch.oss.muenchen.de/templates/develop.html#container-engine))

**Steps:**

1. Copy and configure the config files:

   ```powershell
   cp .env.example .env
   cp core.config.yaml.example core.config.yaml
   cp assistant.config.yaml.example assistant.config.yaml
   # Edit core.config.yaml with your LLM model settings
   # Edit assistant.config.yaml if you need non-default DB/LDAP settings
   # Edit .env for proxy/SSL settings (if needed)
   ```

2. Start the stack:

   ```powershell
   podman compose up -d
   ```

3. Access the services:
   - Frontend: <http://localhost:8083> (user: `mucgpt-user`, password: `mucgpt`)
   - Keycloak Admin: <http://localhost:8100> (admin/admin)
   - PGAdmin: <http://localhost:5050> (admin/admin)

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          External Access                             │
│                         (localhost ports)                            │
└─────────────────────────────────────────────────────────────────────┘
         │                │              │              │
    :8083 (Gateway)  :5432 (DB)    :5050 (pgAdmin) :8100 (Keycloak)
         │                │              │              │
┌────────▼────────────────▼──────────────▼──────────────▼─────────────┐
│                       Internal Network                               │
│                                                                      │
│  ┌──────────────┐         ┌─────────────────────────────────┐      │
│  │   Gateway    │◄────────┤    Authentication Layer         │      │
│  │ refarch-     │         │  ┌──────────┐  ┌─────────────┐  │      │
│  │ gateway      │         │  │ Keycloak │  │ init-       │  │      │
│  │ :8080        │         │  │ :8100    │  │ keycloak    │  │      │
│  └──────┬───────┘         │  └──────────┘  └─────────────┘  │      │
│         │                 └─────────────────────────────────┘      │
│         │                                                           │
│    ┌────┼─────────────────────┬──────────────────┬─────────────┐   │
│    │    │                     │                  │             │   │
│    ▼    ▼                     ▼                  ▼             ▼   │
│  ┌──────────┐      ┌──────────────────┐   ┌────────────┐  ┌──────┐│
│  │ Frontend │      │  Application     │   │  Database  │  │ MCP  ││
│  │ :8080    │      │     Services     │   │   Layer    │  │Server││
│  └──────────┘      │                  │   │            │  └──────┘│
│                    │  ┌────────────┐  │   │ ┌────────┐ │  :8088  │
│                    │  │ core-      │  │   │ │Postgres│ │         │
│                    │  │ service    │  │   │ │:5432   │ │         │
│                    │  │ :8000      │  │   │ └────────┘ │         │
│                    │  └────────────┘  │   │            │         │
│                    │                  │   │ ┌────────┐ │         │
│                    │  ┌────────────┐  │   │ │pgAdmin │ │         │
│                    │  │ assistant- │  │   │ │:5050   │ │         │
│                    │  │ service    │  │   │ └────────┘ │         │
│                    │  │ :8084      │  │   │            │         │
│                    │  └────────────┘  │   │ ┌────────┐ │         │
│                    │                  │   │ │Valkey  │ │         │
│                    │  ┌────────────┐  │   │ │:6379   │ │         │
│                    │  │ assistant- │  │   │ └────────┘ │         │
│                    │  │ migrations │  │   │            │         │
│                    │  └────────────┘  │   └────────────┘         │
│                    └──────────────────┘                           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Services

### Infrastructure Services

| Service | Port | Description |
|---------|------|-------------|
| **postgres** | 5432 | PostgreSQL 17.4 database |
| **pg-admin** | 5050 | Database administration UI |
| **keycloak** | 8100 | Identity and access management |
| **valkey** | 6379 | In-memory data store (Redis-compatible) |
| **refarch-gateway** | 8083 | API Gateway with OAuth2/OIDC |

### Application Services

| Service | Port (Internal) | Port (External) | Description |
|---------|----------------|-----------------|-------------|
| **core-service** | 8000 | 39146 | Core AI/LLM service backend |
| **assistant-service** | 8084 | 39147 | Assistant management service |
| **assistant-migrations** | - | - | Database migration service (run-once) |
| **frontend** | 8080 | 8081 | Web UI |

### MCP Servers

| Service | Port | Description |
|---------|------|-------------|
| **mcpdoc-server** | 8088 | Model Context Protocol server for documentation |

## Docker Compose Files

- **docker-compose.yml** - Main production configuration
- **docker-compose.dev.yml** - Development overrides (routes to local running services)

## Common Commands

### Production Mode

```powershell
# Start all services
podman compose up -d

# Stop all services
podman compose down

# View logs
podman compose logs -f [service-name]

# Rebuild specific service
podman compose up -d --build <service-name>
```

### Development Mode

For local development with services running outside Docker:

```powershell
# Start stack with development overrides
podman compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

See [DEVELOPMENT.md](../docs/DEVELOPMENT.md) for details on local development setup.

## Network Flow

1. **External requests** → Gateway (:8083)
2. **Gateway routes** by path:
   - `/api/sso/**` → Keycloak
   - `/api/backend/**` → Core service
   - `/api/assistant/**` → Assistant service
   - `/**` → Frontend
3. **Internal communication** via `internal` network
4. **Database access** shared by services

## Configuration

The stack uses **YAML configuration files** as the primary configuration source, with environment variables available as overrides. Each service has its own `config.yaml` mounted into the container.

### Configuration Files

| File | Mounted to | Used by | Purpose |
|------|-----------|---------|---------|
| `core.config.yaml` | `/app/config.yaml` | core-service | Models, Langfuse, MCP, Redis, SSO |
| `assistant.config.yaml` | `/app/config.yaml` | assistant-service, assistant-migrations | Database, Redis, LDAP, SSO |
| `.env` | env vars | all services | Proxies, SSL, infrastructure overrides |

### Quick Setup

1. Copy the example files:

   ```powershell
   cp .env.example .env
   cp core.config.yaml.example core.config.yaml
   cp assistant.config.yaml.example assistant.config.yaml
   ```

2. Edit `core.config.yaml` – configure your LLM models and optional features:

   ```yaml
   MODELS:
     - type: "OPENAI"
       llm_name: "gpt-4.1"
       endpoint: "https://your-endpoint.example.com/v1"
       api_key: "sk-..."
       model_info:
         auto_enrich_from_model_info_endpoint: true

   REDIS:
     HOST: "valkey"
     PORT: 6379

   LANGFUSE:
     HOST: "https://your-langfuse-host.example.com"
     PUBLIC_KEY: "pk-lf-..."
     SECRET_KEY: "sk-lf-..."

   MCP:
     SOURCES:
       "my-mcp-server":
         url: "http://mcpdoc-server:8088/sse"
         transport: "sse"
   ```

3. Edit `assistant.config.yaml` – configure database and optional LDAP:

   ```yaml
   DB:
     HOST: "postgres"
     PORT: 5432
     NAME: "postgres"
     USER: "admin"
     PASSWORD: "admin"

   REDIS:
     HOST: "valkey"
     PORT: 6379

   LDAP:
     ENABLED: false
   ```

4. Edit `.env` for proxy/SSL settings (if needed).

5. Start the stack:

   ```powershell
   podman compose up -d
   ```

### Environment Variable Overrides

Any YAML setting can be overridden with environment variables. The services use **nested delimiters** (`__`) to map to YAML sections:

| Service | Env Prefix | Example |
|---------|-----------|---------|
| **core-service** | `MUCGPT_CORE_` | `MUCGPT_CORE_REDIS__HOST=valkey` |
| **assistant-service** | `MUCGPT_ASSISTANT_` | `MUCGPT_ASSISTANT_DB__HOST=postgres` |
| **assistant-migrations** | `MUCGPT_ASSISTANT_` | (same as assistant-service) |

**Mapping rules:**

- Top-level fields: `MUCGPT_CORE_VERSION=1.0.0` → `VERSION: "1.0.0"`
- Nested fields use `__`: `MUCGPT_ASSISTANT_DB__PASSWORD=secret` → `DB: { PASSWORD: "secret" }`
- Nested Redis: `MUCGPT_CORE_REDIS__HOST=valkey` → `REDIS: { HOST: "valkey" }`

**Examples – set via `.env` or container `environment:`:**

```bash
# Override assistant database password (nested under DB section)
MUCGPT_ASSISTANT_DB__PASSWORD=my-secure-password

# Override core Redis host (nested under REDIS section)
MUCGPT_CORE_REDIS__HOST=my-redis-host

# Override core Langfuse secret key (nested under LANGFUSE section)
MUCGPT_CORE_LANGFUSE__SECRET_KEY=sk-lf-...
```

### Configuration Priority

Settings are loaded in this order (highest priority wins):

1. **Constructor / init** – used in tests
2. **Environment variables** – including `.env` file, uses `__` for nesting
3. **YAML config file** – `config.yaml` mounted into each container

This means environment variables always override YAML values, which is useful for injecting secrets in CI/CD without storing them in config files.

## Technical Details

**Health Checks**: All services implement health checks with readiness probes ensuring proper startup order.

**Volumes**:

- PostgreSQL data (anonymous volume)
