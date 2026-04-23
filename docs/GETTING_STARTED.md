# Getting Started

- Install uv: <https://docs.astral.sh/uv/getting-started/installation/>
  - [Using UV during development](./DEVELOPMENT.md)
- Install [Node.js 22+](https://nodejs.org/en/download/package-manager)

## ⚙️ Configure the environment

Configuration is done via **YAML configuration files** (primary) with optional **environment variable overrides**.

Each service reads a `config.yaml` mounted into the container. Environment variables can override any YAML setting using a service-specific prefix and `__` (double underscore) as the nested delimiter.

| Service              | YAML file (in `stack/`) | Env Prefix          |
| -------------------- | ----------------------- | ------------------- |
| core-service         | `core.config.yaml`      | `MUCGPT_CORE_`      |
| assistant-service    | `assistant.config.yaml` | `MUCGPT_ASSISTANT_` |
| assistant-migrations | `assistant.config.yaml` | `MUCGPT_ASSISTANT_` |

### Initial Setup

```bash
cd stack
cp .env.example .env
cp core.config.yaml.example core.config.yaml
cp assistant.config.yaml.example assistant.config.yaml
```

### Models Configuration (YAML)

Configure your LLM models in `core.config.yaml`:

```yaml
MODELS:
  - type: "OPENAI"
    llm_name: "<your-llm-name>"
    endpoint: "<your-endpoint>"
    api_key: "<your-sk>"
    model_info:
      auto_enrich_from_model_info_endpoint: true
      max_output_tokens: 16384
      max_input_tokens: 128000
      description: "<description>"
      input_cost_per_token: 0.00000009
      output_cost_per_token: 0.00000036
      supports_function_calling: true
      supports_reasoning: false
      supports_vision: true
      litellm_provider: "<provider>"
      inference_location: "<region>"
      knowledge_cut_off: "2024-07-01"
```

See `mucgpt-core-service/config.yaml.example` and `mucgpt-assistant-service/config.yaml.example` for complete examples.

### Document Parsing Configuration (YAML)

The core service supports extracting text and structure from uploaded documents using different parsers. Configure the document parser in `core.config.yaml`:

Currently only `kreuzberg` is supported.

```yaml
PARSER_BACKEND: "kreuzberg"
KREUZBERG_URL: "http://kreuzberg-full:8000"
KREUZBERG_TIMEOUT: 120.0
```

Where:

- `PARSER_BACKEND`: Defines the parser used (`kreuzberg`).
- `KREUZBERG_URL`: Points to your Kreuzberg parsing service.
- `KREUZBERG_TIMEOUT`: Execution timeout in seconds.

### Models Configuration (Environment Variable)

Alternatively, models can be configured via the `MUCGPT_CORE_MODELS` environment variable as a JSON array:

```env
MUCGPT_CORE_MODELS='[
  {
    "type": "OPENAI",
    "llm_name": "<your-llm-name>",
    "endpoint": "<your-endpoint>",
    "api_key": "<your-sk>",
    "model_info": {
      "auto_enrich_from_model_info_endpoint": true,
      "max_output_tokens": "<number>",
      "max_input_tokens": "<number>",
      "description": "<description>"
    }
  }
]'
```

### Configuration Priority

Settings are loaded in this order (highest priority wins):

1. **Init values** – constructor kwargs / `init_settings`
2. **Environment variables** – `MUCGPT_CORE_*` / `MUCGPT_ASSISTANT_*`, using `__` for nested sections
3. **YAML config file** – `config.yaml` mounted into each container
4. **`.env` file** – lowest priority; values here will **not** override anything set in `config.yaml` or environment variables

This means environment variables always override YAML values, which is useful for injecting secrets in CI/CD.

### Environment Variable Override Examples

Any YAML setting can be overridden. Nested sections use `__` (double underscore):

```bash
# Top-level field
MUCGPT_CORE_VERSION=1.0.0              # → VERSION: "1.0.0"

# Nested field (DB section in assistant service)
MUCGPT_ASSISTANT_DB__HOST=postgres      # → DB: { HOST: "postgres" }
MUCGPT_ASSISTANT_DB__PASSWORD=secret    # → DB: { PASSWORD: "secret" }

# Nested field (Redis section in core service)
MUCGPT_CORE_REDIS__HOST=valkey          # → REDIS: { HOST: "valkey" }

# Nested field (Langfuse section)
MUCGPT_CORE_LANGFUSE__SECRET_KEY=sk-... # → LANGFUSE: { SECRET_KEY: "sk-..." }
```

**Top-level fields:**

- `type`: The provider type (e.g., `OPENAI`).
- `llm_name`: The name or identifier of your LLM model.
- `endpoint`: The API endpoint URL for the model.
- `api_key`: The API key or secret for authentication.

**`model_info` fields:**

- `auto_enrich_from_model_info_endpoint`: If `true` (default), missing metadata is fetched from `<endpoint>/model/info` (as it is available in litellm). Set to `false` to require manual values.
- `max_output_tokens`: Maximum number of tokens the model can generate in a response.
- `max_input_tokens`: Maximum number of tokens accepted as input.
- `description`: A human-readable description of the model.
- `knowledge_cut_off`: Optional ISO date string describing the model's latest training data cutoff.
- `input_cost_per_token` / `output_cost_per_token`: Optional pricing hints per token.
- `supports_function_calling`, `supports_reasoning`, `supports_vision`: Capability flags advertised to the UI.
- `litellm_provider`: Provider identifier reported by LiteLLM.
- `inference_location`: Region or deployment location for the model.
- `creativity_{low,medium,high}_temperature`: Map abstract creativity levels to specific `temperature` values (0.0 - 1.0 or higher depending on model). Defaults are low=0.0, medium=0.5, high=1.0.

Replace the placeholder values with your actual model configuration.

### LDAP integration

Assistants can be published to specific departments. MUCGPT reads the organization’s department tree from the configured LDAP directory, so published assistants are scoped according to that hierarchy. Configure LDAP in `assistant.config.yaml` under the `LDAP` section:

```yaml
LDAP:
  ENABLED: true
  HOST: "ldaps://ldap.example.de"
  PORT: 636
  USE_SSL: true
  START_TLS: false
  VERIFY_SSL: true
  CA_CERT_FILE: "/path/to/ca-bundle.pem"
  BIND_DN: "cn=mucgpt,ou=Service Accounts,o=Example Org,c=de"
  BIND_PASSWORD: "<secret>"
  SEARCH_BASE: "o=Example Org,c=de"
  SEARCH_FILTER: "(objectClass=organizationalUnit)"
  DISPLAY_ATTRIBUTE: "ou"
  PARENT_ATTRIBUTE: "lhmParentOu" # optional
  ADDITIONAL_ATTRIBUTES: ["lhmOULongname", "lhmOUShortname"]
  REQUIRED_ATTRIBUTES: ["lhmOULongname", "lhmOUShortname"]
  IGNORED_OU_PREFIXES: ["_"]
  IGNORED_OU_SUFFIXES: ["-xxx"]
  PAGE_SIZE: 500
  CONNECT_TIMEOUT: 5.0
  READ_TIMEOUT: 10.0
```

Individual fields can be overridden via environment variables using the `MUCGPT_ASSISTANT_LDAP__` prefix:

```bash
MUCGPT_ASSISTANT_LDAP__ENABLED=true
MUCGPT_ASSISTANT_LDAP__BIND_PASSWORD=<secret>
```

- `SEARCH_BASE` defines the root of the organization tree.
- Toggle `USE_SSL` / `START_TLS` / `VERIFY_SSL` depending on your directory security requirements; set `CA_CERT_FILE` if your LDAP server uses a custom CA.
- `DISPLAY_ATTRIBUTE` (default `ou`) controls the label shown for each organizational unit; `PARENT_ATTRIBUTE` can be set if your LDAP schema exposes a parent reference.
- `ADDITIONAL_ATTRIBUTES` fetches extra attributes for display; `REQUIRED_ATTRIBUTES` are enforced and default to `lhmOULongname` and `lhmOUShortname`.
- `IGNORED_OU_PREFIXES` / `_SUFFIXES` let you skip placeholder OUs (by default everything starting with `_` or ending with `-xxx`).
- Pagination and robustness: `PAGE_SIZE` (default 500), `CONNECT_TIMEOUT` (default 5s), and `READ_TIMEOUT` (default 10s).

### SSO integration

Authentication is performed in front of the services via the [refarch API Gateway](https://refarch.oss.muenchen.de/gateway.html). MUCGPT only accepts access tokens that contain a specific role and forwards the department claim for authorization checks.

The SSO role is configured in each service's `config.yaml` under the `SSO` section:

```yaml
SSO:
  ROLE: "lhm-ab-mucgpt-user"
```

Or via environment variable:

```bash
# Core service
MUCGPT_CORE_SSO__ROLE=lhm-ab-mucgpt-user
# Assistant service
MUCGPT_ASSISTANT_SSO__ROLE=lhm-ab-mucgpt-user
```

- The role defaults to `lhm-ab-mucgpt-user`.
- The API Gateway handles OpenID Connect login, token issuance, and validation; services receive a validated access token.
- The access token includes the user's `department` claim, which is combined with the LDAP organization tree to scope assistant publishing and access.

### MCP (optional)

Besides static tools, MUCGPT allows configuration of MCP sources, for which tools are fetched and can be called.

Configure MCP in `core.config.yaml` under the `MCP` section:

```yaml
MCP:
  SOURCES:
    "<source_id>":
      url: "http://mcpdoc-server:8088/sse"
      forward_token: true
      transport: "sse"
  CACHE_TTL: 43200 # seconds, default: 12h
```

Or via environment variable:

```bash
MUCGPT_CORE_MCP__SOURCES='{"<source_id>": {"url": "...", "forward_token": true, "transport": "sse"}}'
MUCGPT_CORE_MCP__CACHE_TTL=43200
```

- `SOURCES`: Map of MCP source configurations.
  - `<source_id>`: Unique id of one MCP source.
    - `url`: URL of the MCP endpoint.
    - `forward_token`: If the OAuth 2.0 JWT token used for authentication should be forwarded to the MCP endpoint.
    - `transport`: Transport protocol (`"sse"` or `"streamable_http"`), see <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>
- `CACHE_TTL`: Time-to-live of cached MCP tools in seconds (default: 12h).

## 🐋 Run with Docker

See the [stack README](../stack/README.md) for complete Docker Compose setup instructions, including:

- Quick start guide
- Service architecture and ports
- Production and development modes
- Common commands and troubleshooting
