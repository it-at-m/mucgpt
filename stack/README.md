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
│                    │                  │   │ │Redis   │ │         │
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
| **redis** | 6379 | In-memory data store |
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

Environment variables are defined in `.env` file. Key variables:

- **Proxy Settings**: `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`
- **SSO/Auth**: `MUCGPT_SSO_*` (Keycloak configuration)
- **SSL/TLS**: `SSL_CERT_FILE`, `CA_BUNDLE_PATH`
- **Models**: `MUCGPT_CORE_MODELS` (LLM configuration)
- **MCP**: `MUCGPT_MCP_SOURCES` (Model Context Protocol sources)

📖 See the [main README](../README.md#️-configure-the-environment) for complete configuration documentation.

## Technical Details

**Health Checks**: All services implement health checks with readiness probes ensuring proper startup order.

**Volumes**:

- PostgreSQL data (anonymous volume)
