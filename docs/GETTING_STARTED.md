# Getting Started

> **Local development and demo only:** The Docker Compose instructions in this guide are intended exclusively for isolated local development and demonstrations. Do not use this setup unchanged for production or test systems; those systems require a separate, non-public and appropriately secured deployment procedure.

- Install uv: <https://docs.astral.sh/uv/getting-started/installation/>
  - [Using UV during development](./DEVELOPMENT.md)
- Install [Node.js 22+](https://nodejs.org/en/download/package-manager)

## ⚙️ Configure the environment

Configuration is done via **YAML configuration files** (primary) with optional **environment variable overrides**.

Each service reads a `config.yaml` mounted into the container. Environment variables can override any YAML setting using a service-specific prefix and `__` (double underscore) as the nested delimiter.

**YAML keys are lowercase** (e.g. `models:`, `redis:`, `host:`, `password:`). Environment variable names stay UPPERCASE — they are matched case-insensitively against the settings, so existing env vars remain valid.

| Service              | YAML file (in `stack/`) | Env Prefix          |
| -------------------- | ----------------------- | ------------------- |
| core-service         | `core.config.yaml`      | `MUCGPT_CORE_`      |
| assistant-service    | `assistant.config.yaml` | `MUCGPT_ASSISTANT_` |
| assistant-migrations | `assistant.config.yaml` | `MUCGPT_ASSISTANT_` |

> **Migration notes (from older versions):**
>
> - **Lowercase your `config.yaml` keys** (e.g. `models:`, `redis:`, `host:`, `password:`). Legacy UPPERCASE YAML keys are ignored — most mistakes fail loudly at startup (missing required database fields, empty models list).
> - **Move model connection settings into a `providers` section** and reference it from each model via `provider: <key>` (see [Models Configuration](#models-configuration-yaml)). Inline `type`/`endpoint`/`api_key`/`api_version` on `models[]` entries are rejected at startup with a pointer to the new scheme.
> - **Replace `MUCGPT_CORE_LANGFUSE__*` environment variables with the standard `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST`** — the old prefixed variables are silently ignored (see [Secrets](#secrets)).

### Secrets

**Never store real secrets (passwords, API keys, tokens) in `config.yaml`.** Config files are typically mounted as ConfigMaps (leaking values into etcd) or risk being committed to Git. Provide secrets via **environment variables** instead — they always override YAML values (see [Configuration Priority](#configuration-priority)).

```bash
# Core service
MUCGPT_CORE_REDIS__PASSWORD=secret
MUCGPT_CORE_PROVIDERS__MY_GATEWAY__API_KEY=sk-...

# Assistant service and migrations
MUCGPT_ASSISTANT_DB__PASSWORD=secret
MUCGPT_ASSISTANT_LDAP__BIND_PASSWORD=secret

# Langfuse (standard SDK variables, no MUCGPT_CORE_ prefix)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://your-langfuse-host.example.com
```

Inject them via Kubernetes Secrets, docker-compose `environment:` entries, or a secret manager — not via the mounted YAML file.

Model API keys are configured **per provider** in the `providers` section (see [Models Configuration](#models-configuration-yaml)) and can be overridden per provider via environment variables: `MUCGPT_CORE_PROVIDERS__<PROVIDER>__API_KEY`. The middle segment must mirror the provider key (case-insensitively): provider `my_gateway` maps to `MUCGPT_CORE_PROVIDERS__MY_GATEWAY__API_KEY`. Prefer hyphen-free provider keys so the variable is a valid shell identifier. Whole sections can also be replaced: `MUCGPT_CORE_PROVIDERS` (JSON object) and `MUCGPT_CORE_MODELS` (JSON array, see [below](#models-configuration-environment-variable)) — which can themselves be injected as secrets.

> **Warning:** `MUCGPT_CORE_LANGFUSE__*` environment variables are **no longer read** (silently ignored) — a common migration error. Langfuse is configured exclusively via the standard SDK variables `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` (the host defaults to Langfuse cloud if unset). Tracing degrades gracefully: without credentials the core service logs this and runs with tracing disabled.

### Initial Setup

```bash
cd stack
cp .env.example .env
cp core.config.yaml.example core.config.yaml
cp assistant.config.yaml.example assistant.config.yaml
```

### Models Configuration (YAML)

Configure your LLM models in `core.config.yaml`. Connection settings (type, endpoint, credentials) live in the `providers` section; each model entry references a provider via `provider: <key>`. Provider keys must be lowercase (env-var name segments are lowercased, so uppercase keys would silently miss their env overrides). The placeholder values in this example, as well as any local demo values, must not be used unchanged in production or test environments:

```yaml
providers:
  my_gateway:
    type: "openai"             # "openai" or "azure"
    endpoint: "https://your-litellm-gateway.example.org/"
    api_version: ""            # only for azure
    # Provide api_key via MUCGPT_CORE_PROVIDERS__MY_GATEWAY__API_KEY instead of storing it here.

models:
  - provider: "my_gateway"     # required reference into providers
    llm_name: "<your-llm-name>"
    deployment: ""             # only for azure
    model_info:
      auto_enrich_from_model_info_endpoint: true
      max_output_tokens: 16384
      max_input_tokens: 128000
      display_name: "<human-readable name>"  # Optional: shown instead of llm_name
      description: "<description>"
      short_description: "<one-line summary>"
      input_cost_per_token: 0.00000009
      output_cost_per_token: 0.00000036
      supports_reasoning: false
      knowledge_cut_off: "2024-07-01"
```

See `mucgpt-core-service/config.yaml.example` and `mucgpt-assistant-service/config.yaml.example` for complete examples.

> **Note:** `api_key` is configured per provider in the `providers` section and — unlike the old per-model key — can be overridden via environment variables; see [Secrets](#secrets).

### Prompt Configuration

See the [AI governance and compliance checks guide](AI_GOVERNANCE.md) for the
end-to-end screening flow, version lifecycle, review queue, and operational
responsibilities.

The optional `prompts` section maps prompt names used by the core service to prompts stored in [langfuse](https://langfuse.com/docs/prompt-management/overview). Each prompt is configured under its Langfuse folder (`prompts.folders`) with the label to use; folder and prompt names must match Langfuse exactly. See `mucgpt-core-service/config.yaml.example` for the complete YAML structure.

- `defaults/default_instructions`: general system instructions for regular chat.
- `generation_prompts/chat_title`: generates concise chat titles.
- `generation_prompts/assistant_name`: generates assistant names from prompt seeds.
- `generation_prompts/assistant_description`: generates assistant descriptions from prompt seeds.
- `generation_prompts/assistant_systemprompt`: generates assistant system prompts from prompt seeds.
- `compliance_prompts/*`: screens assistant prompts for high-risk use cases (eu-ai-act) in migration/asylum/border control, public services, employment, and education.

### Document Parsing Configuration (YAML)

The core service supports extracting text and structure from uploaded documents using an optional parser. Configure the document parser in `core.config.yaml`. By default, document parsing is disabled (`parser_backend: "none"`).

Currently, Xberg is the only supported parser backend. To enable it, set the parser backend to `"xberg"` and configure the URL and timeout:

```yaml
parser_backend: "xberg" # Default is "none"
xberg_url: "http://xberg-full:8000"
xberg_timeout: 120.0
```

Where:

- `parser_backend`: Defines the parser used (`none` to disable, or `xberg`).
- `xberg_url`: Points to your Xberg parsing service.
- `xberg_timeout`: Execution timeout in seconds.

### Transcription Configuration (YAML)

MUCGPT offers browser-based speech-to-text (beta): users can dictate into the chat input, and the audio is transcribed entirely inside their browser. The backend only gates the feature — no audio ever leaves the user's browser; the resulting transcript is placed in the chat input and can be submitted through the normal chat request. It is disabled by default (`transcription_enabled: false`).

To enable it, set the flag in `core.config.yaml`:

```yaml
transcription_enabled: true # Default is false
```

Or via environment variable: `MUCGPT_CORE_TRANSCRIPTION_ENABLED=true`

Optionally, preselect a default model for first-time users:

```yaml
transcription_default_model: "onnx-community/whisper-small" # Default is null (frontend built-in default)
```

The id must match an entry of the frontend's model list (`mucgpt-frontend/src/config/transcriptionModels.ts`); unknown ids are ignored. The choice applies once — as soon as a user picks a model themselves, it is stored in their browser and later changes to the default do not affect them.

Notes for operators:

- All transcription models (Whisper, NVIDIA Canary/Parakeet) run client-side on WebGPU or WASM; the browser downloads them directly from their model registry (Hugging Face) and caches them locally.
- Model choice, language support, and hardware requirements are managed in the frontend (`mucgpt-frontend/src/config/transcriptionModels.ts`); the backend cannot define the model inventory or runtime, but it can preselect the default model ID through `transcription_default_model` (applied on first use before the user picks a model).
- Users on hardware without WebGPU see a reduced model selection (CPU-based WASM models).

### Models Configuration (Environment Variable)

Alternatively, models can be configured via environment variables. Providers are set as a JSON object (`MUCGPT_CORE_PROVIDERS`), models as a JSON array (`MUCGPT_CORE_MODELS`) whose entries reference a provider instead of carrying inline endpoint/credentials:

```env
MUCGPT_CORE_PROVIDERS='{
  "my_gateway": {
    "type": "openai",
    "endpoint": "https://your-litellm-gateway.example.org/",
    "api_key": "<your-sk>"
  }
}'

MUCGPT_CORE_MODELS='[
  {
    "provider": "my_gateway",
    "llm_name": "<your-llm-name>",
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

This means environment variables always override YAML values. This is the recommended way to provide **secrets** (see [Secrets](#secrets)) and is useful for injecting them in CI/CD without storing them in config files.

### Data storage overview

MUCGPT stores data in two layers:

- PostgreSQL (persistent):
  - Assistants and their versions
  - Assistant subscriptions
- Redis/Valkey (temporary cache):
  - MCP tool metadata cache (core service, key prefix: `mcp_tools_raw:`)
  - LDAP/Active Directory data cache (assistant service, key: `mucgpt:directory-tree:v1`)
  - Assistant compliance verification cache (key prefix: `mucgpt:assistant-compliance:v1:`)

Notes:

- PostgreSQL is the source of truth for assistant and subscription data.
- Redis/Valkey entries are TTL-based and can expire:
  - MCP tools: configured via `mcp.cache_ttl` (default: 12h)
  - LDAP directory cache: configured via `ldap.cache_ttl` (default: 14d)
  - Compliance verification cache: configured via `compliance_cache_ttl_seconds` (default: 30m)

### Browser storage (frontend)

In addition to backend storage, the frontend uses browser storage for UX state and local history:

- IndexedDB:
  - `MUCGPT-ASSISTANTS` (assistant data)
  - `MUCGPT-CHAT` (chat data)
  - `MUCGPT-COMMUNITY-ASSISTANTS` (community assistant data)
- localStorage:
  - UI/user preferences (for example language, theme, selected tools, selected model)
  - Parsed document history/content cache (`MUCGPT_PARSED_DOCUMENTS_V1`)
  - Transcription settings: enabled flag, selected model, downloaded model list (`SETTINGS_TRANSCRIPTION_*`)
- Cache API (browser):
  - NeMo transcription model files (Canary/Parakeet encoder/decoder/vocab, cache name `mucgpt-nemo-models-v1`)
  - Whisper transcription model files (cached by transformers.js)
- sessionStorage:
  - Route-local draft text in the question input
- Cookies:
  - `XSRF-TOKEN` is read by the frontend and sent as `X-XSRF-TOKEN` request header

Note: Browser storage is client-local and can be cleared by the user/browser.

### Environment Variable Override Examples

Any YAML setting can be overridden. Nested sections use `__` (double underscore). Env var names stay UPPERCASE and are matched case-insensitively against the lowercase YAML keys:

```bash
# Top-level field
MUCGPT_CORE_VERSION=1.0.0              # → version: "1.0.0"
MUCGPT_CORE_AI_ACT_COMPLIANCE_CHECK_ENABLED=false  # → ai_act_compliance_check_enabled: false

# Nested field (DB section in assistant service)
MUCGPT_ASSISTANT_DB__HOST=postgres      # → db: { host: "postgres" }
MUCGPT_ASSISTANT_DB__PASSWORD=secret    # → db: { password: "secret" }

# Nested field (Redis section in core service)
MUCGPT_CORE_REDIS__HOST=valkey          # → redis: { host: "valkey" }

# Provider api_key (keyed by provider name; segment mirrors the provider key)
MUCGPT_CORE_PROVIDERS__MY_GATEWAY__API_KEY=sk-...  # → providers.my_gateway.api_key
```

> **Warning:** `MUCGPT_CORE_LANGFUSE__*` environment variables are no longer read (silently ignored). Use the standard `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` variables instead — see [Secrets](#secrets).

**Provider fields (`providers.<key>`):**

- `type`: The provider type (`openai` or `azure`).
- `endpoint`: The API endpoint URL for the provider.
- `api_key`: The API key or secret for authentication, configured per provider.
- `api_version`: Azure API version (only needed for `type: "azure"`).

**Model fields (`models[]`):**

- `provider`: Required reference to a key in the `providers` section.
- `llm_name`: The name or identifier of your LLM model.
- `deployment`: Azure deployment name (only needed for `type: "azure"`).

**`model_info` fields:**

- `auto_enrich_from_model_info_endpoint`: If `true` (default), missing metadata is fetched from `<endpoint>/model/info` (as it is available in litellm). Set to `false` to require manual values.
- `max_output_tokens`: Maximum number of tokens the model can generate in a response.
- `max_input_tokens`: Maximum number of tokens accepted as input.
- `display_name`: Optional human-readable name shown in the UI. `llm_name` stays the technical identifier used in requests and saved assistants; without `display_name` the UI shows `llm_name`.
- `description`: A human-readable description of the model, shown in the model picker.
- `short_description`: One-line summary of what the model is best suited for, shown in the model picker.
- `knowledge_cut_off`: Optional ISO date string describing the model's latest training data cutoff.
- `input_cost_per_token` / `output_cost_per_token`: Optional pricing hints per token.
- `supports_reasoning`: Whether the model supports reasoning. Only these models receive the requested `reasoning_effort`.
- `creativity_{low,medium,high}_temperature`: Map abstract creativity levels to specific `temperature` values (0.0 - 1.0 or higher depending on model). Defaults are low=0.0, medium=0.5, high=1.0.

Replace the placeholder values with your actual model configuration.

### LDAP integration

Assistants can be published to specific departments. MUCGPT reads the organization’s department tree from the configured LDAP directory, so published assistants are scoped according to that hierarchy. Configure LDAP in `assistant.config.yaml` under the `ldap` section:

```yaml
ldap:
  enabled: true
  host: "ldaps://ldap.example.org"
  port: 636
  use_ssl: true
  start_tls: false
  verify_ssl: true
  ca_cert_file: "/path/to/ca-bundle.pem"
  bind_dn: "cn=mucgpt,ou=service-accounts,dc=example,dc=org"
  # Provide bind_password via MUCGPT_ASSISTANT_LDAP__BIND_PASSWORD instead of storing it here.
  # bind_password: "<secret>"
  search_base: "dc=example,dc=org"
  search_filter: "(objectClass=organizationalUnit)"
  display_attribute: "ou"
  shortname_attribute: "departmentCode"
  parent_attribute: "parentDepartment" # optional
  additional_attributes: ["departmentName", "departmentCode"]
  required_attributes: ["departmentName", "departmentCode"]
  ignored_ou_prefixes: ["_"]
  ignored_ou_suffixes: ["-xxx"]
  ignored_ou_shortname_exceptions: ["DEPT-EXAMPLE"]
  page_size: 500
  connect_timeout: 5.0
  read_timeout: 10.0
```

Individual fields can be overridden via environment variables using the `MUCGPT_ASSISTANT_LDAP__` prefix:

```bash
MUCGPT_ASSISTANT_LDAP__ENABLED=true
MUCGPT_ASSISTANT_LDAP__BIND_PASSWORD=<secret>
MUCGPT_ASSISTANT_LDAP__IGNORED_OU_SHORTNAME_EXCEPTIONS=["DEPT-EXAMPLE"]
```

- `search_base` defines the root of the organization tree.
- Toggle `use_ssl` / `start_tls` / `verify_ssl` depending on your directory security requirements; set `ca_cert_file` if your LDAP server uses a custom CA.
- `display_attribute` (default `ou`) controls the label shown for each organizational unit; `shortname_attribute` selects its stable identifier; `parent_attribute` can be set if your LDAP schema exposes a parent reference.
- `additional_attributes` fetches extra attributes for display; `required_attributes` are enforced during loading. Adapt all attribute names to your LDAP schema.
- `ignored_ou_prefixes` / `ignored_ou_suffixes` let you skip placeholder OUs (by default everything starting with `_` or ending with `-xxx`).
- `ignored_ou_shortname_exceptions` allows specific OUs to bypass ignore rules when their configured short-name attribute matches one of the listed values (case-insensitive).
- Typical use case: keep a business-relevant OU like `_Hidden` by adding its shortname (for example `DEPT-EXAMPLE`) to `ignored_ou_shortname_exceptions`.
- Pagination and robustness: `page_size` (default 500), `connect_timeout` (default 5s), and `read_timeout` (default 10s).

### Demo credentials

The local Docker demo stack includes a standard user and an admin user for testing role-based access:

- `demo-user` / `mucgpt`
- `demo-admin` / `mucgpt`

These credentials are only for the isolated local development stack and must not be reused in production or test environments.

### SSO integration

Authentication is performed in front of the services through an OpenID Connect-compatible API gateway. MUCGPT only accepts access tokens that contain a configured authorization role and uses a configurable organization claim for authorization checks.

The SSO role is configured in each service's `config.yaml` under the `sso` section:

```yaml
sso:
  role: "mucgpt-user"
  admin_role: "mucgpt-admin"
  user_id_claim: "user_id"
  organization_unit_claim: "organization_unit"
```

Or via environment variable:

```bash
# Core service
MUCGPT_CORE_SSO__ROLE=mucgpt-user
# Assistant service
MUCGPT_ASSISTANT_SSO__ROLE=mucgpt-user
```

- Configure a role that is emitted by your identity provider, such as `mucgpt-user`.
- The API Gateway handles OpenID Connect login, token issuance, and validation; services receive a validated access token.
- The access token includes a configured user-ID claim and a configurable organization claim. The latter is combined with the LDAP organization tree to scope assistant publishing and access.

### MCP (optional)

Besides static tools, MUCGPT allows configuration of MCP sources, for which tools are fetched and can be called.

Configure MCP in `core.config.yaml` under the `mcp` section:

```yaml
mcp:
  sources:
    "<source_id>":
      url: "http://mcpdoc-server:8088/sse"
      forward_token: true
      transport: "sse"
  cache_ttl: 43200 # seconds, default: 12h
```

Or via environment variable:

```bash
MUCGPT_CORE_MCP__SOURCES='{"<source_id>": {"url": "...", "forward_token": true, "transport": "sse"}}'
MUCGPT_CORE_MCP__CACHE_TTL=43200
```

- `sources`: Map of MCP source configurations.
  - `<source_id>`: Unique id of one MCP source.
    - `url`: URL of the MCP endpoint.
    - `forward_token`: If the OAuth 2.0 JWT token used for authentication should be forwarded to the MCP endpoint.
    - `transport`: Transport protocol (`"sse"` or `"streamable_http"`), see <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>
- `cache_ttl`: Time-to-live of cached MCP tools in seconds (default: 12h).

## 🐋 Run with Docker

The Docker Compose setup is for isolated local development and demos only. Do not expose it as a production or test deployment and do not reuse its demo credentials or other local defaults. Production and test systems must use a separate, non-public and appropriately secured deployment procedure.

See the [stack README](../stack/README.md) for the local Docker Compose setup instructions, including:

- Quick start guide
- Service architecture and ports
- Local Compose and local development modes
- Common commands and troubleshooting
- [Using Docker instead of Podman (incl. Windows/WSL2)](../stack/README.md#using-docker-instead-of-podman)

### Prebuilt container images

For real deployments, pull the prebuilt release images instead of building from source. Every release publishes the same runnable image (same tags and platform images) to two registries — pick whichever suits your environment. The openCode mirror omits GHCR-only BuildKit attestations:

| Component | ghcr.io | registry.opencode.de |
| --- | --- | --- |
| Frontend | `ghcr.io/it-at-m/mucgpt/mucgpt-frontend` | `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-frontend` |
| Core service | `ghcr.io/it-at-m/mucgpt/mucgpt-core` | `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-core` |
| Assistant service | `ghcr.io/it-at-m/mucgpt/mucgpt-assistant` | `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-assistant` |
| Migrations service | `ghcr.io/it-at-m/mucgpt/mucgpt-assistant-migrations` | `registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-assistant-migrations` |

Tags follow the release tags (`mucgpt-<component>-<version>`): each image is available as `<version>` and as `latest`, for example:

```bash
docker pull registry.opencode.de/landeshauptstadt-muenchen/mucgpt/mucgpt-core:latest
docker pull ghcr.io/it-at-m/mucgpt/mucgpt-core:1.0.0
```

Pulling from ghcr.io is anonymous. The openCode registry is the GitLab container registry of gitlab.opencode.de: anonymous pulls work if the project is public, otherwise authenticate with a GitLab account or an access token with `read_registry` scope.

## 🔧 Troubleshooting

- **Chat requests fail with `Prompt configuration missing`:** prompts are fetched from Langfuse when configured; otherwise the core service uses the local fallback files in `mucgpt-core-service/app/agent/prompt_pool/` (see [Prompt Configuration](#prompt-configuration)). Create the missing `.md` files there and rebuild the core-service image.
