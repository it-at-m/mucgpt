# MUCGPT Stack - Docker Compose

This directory contains the Docker Compose configuration for running the complete MUCGPT stack locally.

> 📚 For complete project documentation, see the [main README](../README.md) and [development guide](../docs/DEVELOPMENT.md).

## Quick Start

**Prerequisites:**

- Podman or Docker installed
- `keycloak` entry in your `hosts` file (see [RefArch-Docs](https://refarch.oss.muenchen.de/templates/develop.html#container-engine))

**Steps:**

1. Configure environment variables:

   ```powershell
   cp .env.example .env
   # Edit .env with your settings (see main README for configuration details)
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

The stack uses **YAML configuration files** for service-specific settings, making it easier to configure models and services without dealing with complex JSON in environment variables.

### Configuration Files

1. **core-service-config.yaml** - Core service configuration (models, frontend settings)
2. **assistant-service-config.yaml** - Assistant service configuration (database, backend settings)
3. **shared-config.yaml** - Shared configuration (SSO, Redis, Langfuse, MCP, LDAP)
4. **.env** - Infrastructure settings (gateway, proxies, SSL)

### Quick Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the YAML configuration files with your settings:
   - **core-service-config.yaml**: Configure your LLM models
   - **assistant-service-config.yaml**: Configure database connection (usually defaults work)
   - **shared-config.yaml**: Uncomment and configure optional features (Redis, Langfuse, MCP, LDAP)

3. Edit `.env` for gateway settings:
   - SSO/Keycloak configuration
   - Proxy settings (if needed)
   - SSL/TLS certificates (if needed)

### Example: Configuring LLM Models

Instead of this complex JSON in environment variables:
```bash
MUCGPT_CORE_MODELS='[{"type": "OPENAI", "llm_name": "gpt-4", ...}]'
```

Simply edit **core-service-config.yaml**:
```yaml
MODELS:
  - type: "OPENAI"
    llm_name: "gpt-4"
    endpoint: "https://api.openai.com/v1"
    api_key: "sk-..."
    model_info:
      max_output_tokens: 16384
      max_input_tokens: 128000
      description: "GPT-4 model"
```

### Configuration Priority

Settings are loaded in this order (highest priority first):
1. **Environment variables** - Can override any YAML setting
2. **YAML configuration files** - Main configuration source
3. **.env file** - Infrastructure defaults

This means you can use YAML for most settings and still override specific values with environment variables when needed.

📖 See the [main README](../README.md#️-configure-the-environment) for detailed configuration documentation.

## Technical Details

**Health Checks**: All services implement health checks with readiness probes ensuring proper startup order.

**Volumes**:

- PostgreSQL data (anonymous volume)
