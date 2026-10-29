# MUCGPT Stack - Docker Compose

This directory contains the Docker Compose configuration for running the complete MUCGPT stack locally.

> **Local development and demo only:** This Compose stack is intended exclusively for isolated local development and demonstrations. Do not use it unchanged in production or test environments. Those environments require a separate, appropriately secured deployment procedure.

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
   - Frontend: <http://localhost:8083> (user: `demo-user`, password: `mucgpt`)
   - Frontend admin: <http://localhost:8083> (user: `demo-admin`, password: `mucgpt`)
   - Keycloak Admin: <http://localhost:8100> (admin/admin)
   - PGAdmin: <http://localhost:5050> (admin/admin)

The demo credentials above are intentionally provided only for the isolated local environment. They are public example credentials and must not be used as production credentials or reused in test environments.

## Using Docker instead of Podman

The Compose stack targets rootless Podman. Docker (including inside WSL2) needs two adjustments in `docker-compose.yml`:

1. **Postgres volume:** make `postgres-data` a plain named volume (remove `driver_opts`) — Docker rejects the Podman-only option with `missing required option: "device"`.
2. **Postgres data directory:** postgres 18 images expect the volume at `/var/lib/postgresql` and set `PGDATA` themselves (`/var/lib/postgresql/data` is a symlink now). In the `postgres` service, mount `postgres-data:/var/lib/postgresql` and remove the `PGDATA` line, otherwise the container exits with `mkdir: Permission denied`.

After changing the volume config, recreate it once: `docker volume rm mucgpt-stack_postgres-data`.

### WSL2 specifics

The login flow redirects the browser to `http://keycloak:8100`. On WSL2 with the browser running on Windows, add `127.0.0.1 keycloak` to `C:\Windows\System32\drivers\etc\hosts` (as administrator) and run `ipconfig /flushdns`. An entry in the WSL `/etc/hosts` is not enough since WSL auto-creates that file.

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
│                    │  └──────┬─────┘  │   │            │         │
│                    │         │        │   │ ┌────────┐ │         │
│                    │  ┌──────▼─────┐  │   │ │pgAdmin │ │         │
│                    │  │ xberg -    │  │   │ |:5050   │ │         │
│                    │  │ full :8000 │  │   │ └────────┘ │         │
│                    │  └────────────┘  │   │            │         │
│                    │                  │   │ ┌────────┐ │         │
│                    │  ┌────────────┐  │   │ │Valkey  │ │         │
│                    │  │ assistant- │  │   │ │:6379   │ │         │
│                    │  │ service    │  │   │ └────────┘ │         │
│                    │  │ :8084      │  │   │            │         │
│                    │  └────────────┘  │   └────────────┘         │
│                    │                  │                           │
│                    │  ┌────────────┐  │                           │
│                    │  │ assistant- │  │                           │
│                    │  │ migrations │  │                           │
│                    │  └────────────┘  │                           │
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
| **xberg-full** | 8086 | Document extraction service |

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

The `mcpdoc-server` image installs `mcpdoc` through the local `mcpdoc-server/pyproject.toml` project. Pin or override transitive dependencies there, for example when an upstream `mcp` release is incompatible with `mcpdoc`.

## Docker Compose Files

- **docker-compose.yml** - Local development/demo stack
- **docker-compose.dev.yml** - Development overrides (routes to local running services)

## Common Commands

### Local Compose Mode

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

**YAML keys are lowercase** (e.g. `models:`, `redis:`, `host:`, `password:`). Environment variable names stay UPPERCASE — they are matched case-insensitively against the settings, so existing env vars remain valid. Legacy UPPERCASE YAML keys are ignored; migrate existing config files (most mistakes fail loudly at startup).

> **Migration notes (from older versions):**
>
> - Lowercase your `config.yaml` keys (legacy UPPERCASE keys are ignored).
> - Move model connection settings (`type`/`endpoint`/`api_key`/`api_version`) into a `providers` section and reference it from each model via `provider: <key>`; inline provider fields on `models[]` entries are rejected at startup.
> - Replace `MUCGPT_CORE_LANGFUSE__*` environment variables with the standard `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` — the old prefixed variables are silently ignored.

> **Secrets:** Never store real secrets (passwords, API keys, tokens) in `config.yaml` — config files are typically mounted as ConfigMaps (leaking values into etcd) or risk being committed to Git. Provide secrets via **environment variables** instead (see [Environment Variable Overrides](#environment-variable-overrides)); they always override YAML values.

### Configuration Files

| File | Mounted to | Used by | Purpose |
|------|-----------|---------|---------|
| `core.config.yaml` | `/app/config.yaml` | core-service | Providers, models, prompts, MCP, Redis, SSO |
| `assistant.config.yaml` | `/app/config.yaml` | assistant-service, assistant-migrations | Database, Redis, LDAP, SSO |
| `.env` | env vars | all services | Proxies, SSL, infrastructure overrides |

### Quick Setup

1. Copy the example files:

   ```powershell
   cp .env.example .env
   cp core.config.yaml.example core.config.yaml
   cp assistant.config.yaml.example assistant.config.yaml
   ```

2. Edit `core.config.yaml` – configure your LLM providers and models, and optional features. The placeholder values and any local demo values in these examples are for local use only and must not be carried over to production or test environments:

   ```yaml
   providers:
     my_gateway:
       type: "openai"             # "openai" or "azure"
       endpoint: "https://your-endpoint.example.com/v1"
       # api_key: "sk-..."        # provide via MUCGPT_CORE_PROVIDERS__MY_GATEWAY__API_KEY instead

   models:
     - provider: "my_gateway"     # required reference into providers
       llm_name: "gpt-4.1"
       model_info:
         auto_enrich_from_model_info_endpoint: true
         internal_task_model_strength: "strong"

     - provider: "my_gateway"
       llm_name: "gpt-4.1-nano"
       model_info:
         auto_enrich_from_model_info_endpoint: true
         internal_task_model_strength: "weak"

   redis:
     host: "valkey"
     port: 6379

   mcp:
     sources:
       "my-mcp-server":
          url: "http://mcpdoc-server:8088/sse"
          transport: "sse"
   ```

   > **Note:** The `api_key` value above is a placeholder. In production, provide it via environment variables (see [Environment Variable Overrides](#environment-variable-overrides)) instead of storing it in `config.yaml`: `api_key` is configured **per provider** and can be overridden per provider via `MUCGPT_CORE_PROVIDERS__<PROVIDER>__API_KEY`, or the whole sections can be replaced via `MUCGPT_CORE_PROVIDERS` (JSON object) and `MUCGPT_CORE_MODELS` (JSON array).

   Langfuse is not configured in this file: the Langfuse SDK reads the standard environment variables `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` directly. `MUCGPT_CORE_LANGFUSE__*` variables are no longer read (silently ignored).

### Internal Task Models

The core service supports an optional internal model hint for lightweight generation tasks.

Set this per model under `models[].model_info.internal_task_model_strength`:

- `strong`: preferred for assistant draft generation
- `weak`: preferred for chat title generation

Example:

```yaml
providers:
  my_gateway:
    type: "openai"
    endpoint: "https://your-endpoint.example.com/v1"

models:
  - provider: "my_gateway"
    llm_name: "gpt-4.1-mini"
    model_info:
      internal_task_model_strength: "strong"

  - provider: "my_gateway"
    llm_name: "gpt-4.1-nano"
    model_info:
      internal_task_model_strength: "weak"
```

Selection behavior:

- Assistant drafts use the first model marked as `strong`
- Chat title generation uses the first model marked as `weak`
- If no matching model is configured for a task, the first model in `models` is used as a fallback

This setting is internal to the core service and is not exposed to the frontend config API.

### Prompt Pool Configuration

The optional `prompts` section in `core.config.yaml` maps core-service prompt names to Langfuse folders and labels. Configure a mapping only when the matching prompt exists in Langfuse. The full commented example is in `core.config.yaml.example`.

- `defaults/default_instructions` provides general chat instructions.
- `generation_prompts/chat_title` generates conversation titles.
- `generation_prompts/assistant_name`, `assistant_description`, and `assistant_systemprompt` generate the corresponding assistant draft fields.
- `compliance_prompts/*` classifies assistant prompts for high-risk use cases in migration/asylum/border control, public services, employment, and education.

1. Edit `assistant.config.yaml` – configure database and optional LDAP. The example credentials and other local values are intended for this isolated Compose stack only and must not be used in production or test environments:

   ```yaml
   db:
     host: "postgres"
     port: 5432
     name: "postgres"
     user: "admin"
     # Provide password via MUCGPT_ASSISTANT_DB__PASSWORD instead of storing it here.
     # password: "admin"

   redis:
     host: "valkey"
     port: 6379

   ldap:
     enabled: false
   ```

2. Edit `.env` for proxy/SSL settings (if needed).

3. Start the stack:

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

- Top-level fields: `MUCGPT_CORE_VERSION=1.0.0` → `version: "1.0.0"`
- Nested fields use `__`: `MUCGPT_ASSISTANT_DB__PASSWORD=secret` → `db: { password: "secret" }`
- Nested Redis: `MUCGPT_CORE_REDIS__HOST=valkey` → `redis: { host: "valkey" }`

**Examples – set via `.env` or container `environment:`:**

```bash
# Override assistant database password (nested under db section)
MUCGPT_ASSISTANT_DB__PASSWORD=my-secure-password

# Override core Redis host (nested under redis section)
MUCGPT_CORE_REDIS__HOST=my-redis-host

# Override one provider's api_key (segment mirrors the provider key, case-insensitive)
MUCGPT_CORE_PROVIDERS__MY_GATEWAY__API_KEY=sk-...

# Langfuse: standard SDK variables (no MUCGPT_CORE_ prefix)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://your-langfuse-host.example.com
```

> **Warning:** `MUCGPT_CORE_LANGFUSE__*` environment variables are **no longer read** (silently ignored) — use the standard `LANGFUSE_*` variables above.

This is the recommended way to provide **secrets**: keep them out of `config.yaml` (which is mounted as a file/ConfigMap and can leak into etcd or Git) and inject them via the container environment, Kubernetes Secrets, or a secret manager.

### Configuration Priority

Settings are loaded in this order (highest priority wins):

1. **Constructor / init** – used in tests
2. **Environment variables** – `MUCGPT_CORE_*` / `MUCGPT_ASSISTANT_*`, uses `__` for nesting
3. **YAML config file** – `config.yaml` mounted into each container
4. **`.env` file** – lowest priority; values here will **not** override anything set in `config.yaml` or environment variables

This means environment variables always override YAML values, which is useful for injecting secrets in CI/CD without storing them in config files.

## Technical Details

**Health Checks**: All services implement health checks with readiness probes ensuring proper startup order.

**Volumes**:

- PostgreSQL data (anonymous volume)
