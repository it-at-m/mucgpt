<!-- PROJECT LOGO -->
<div align="center">
  <a href="#">
    <img src="mucgpt-frontend/src/assets/mucgpt_pride.png" alt="Logo" height="200" style="display: block; margin: 0 auto; filter: invert(0)">
  </a>
</div>
<br />

<div align="center">

<!-- Project / Meta -->
### Project Information

[![Made with love by it@M][made-with-love-shield]][itm-opensource]
[![Gitmoij][gitmoij-shield]][gitmoij]
[![GitHub license][license-shield]][license]
[![GitHub release version][github-release-shield]][releases]
[![Demo-Frontend][pages-shield]][pages]

<!-- Tech Stack -->
### Technology Stack

![Supported python versions][python-versions-shield]
![Supported npm versions][npm-versions-shield]
[![uv][uv-shield]][uv]
[![FastAPI][fastapi-shield]][fastapi]
[![React][react-shield]][react]
[![Postgres][postgres-shield]][postgres]
[![LangGraph][langgraph-shield]][langgraph]

<!-- CI -->
### Build Status

[![Assistant-service tests][assistant-service-tests-shield]][assistant-service-tests]
[![Core service tests][core-service-tests-shield]][core-service-tests]

<!-- Container Images -->
### Container Images

[![Frontend version][frontend-version-shield]][frontend-container]
[![Core service version][core-service-version-shield]][core-service-container]
[![Assistant service version][assistant-service-version-shield]][assistant-service-container]
[![Migrations service version][migrations-service-version-shield]][migrations-service-container]

</div>

<!-- ABOUT THE PROJECT -->

[made-with-love-shield]: https://img.shields.io/badge/made%20with%20%E2%9D%A4%20by-it%40M-blue?style=for-the-badge
[license-shield]: https://img.shields.io/github/license/it-at-m/itm-prettier-codeformat?style=for-the-badge&color=blue
[github-release-shield]: https://img.shields.io/github/v/release/it-at-m/mucgpt?style=for-the-badge&color=blue
[python-versions-shield]: https://img.shields.io/badge/python-3.10|%203.11%20|%203.12-blue?style=for-the-badge
[gitmoij-shield]: https://img.shields.io/badge/gitmoij-😜😍-blue?style=for-the-badge
[npm-versions-shield]: https://img.shields.io/badge/node-20+-blue?style=for-the-badge
[uv-shield]: https://img.shields.io/badge/⚡-uv-blue?style=for-the-badge
[fastapi-shield]: https://img.shields.io/badge/fastapi-blue?style=for-the-badge&logo=fastapi&logoColor=white
[react-shield]: https://shields.io/badge/react-blue?logo=react&style=for-the-badge&logoColor=white
[postgres-shield]: https://img.shields.io/badge/postgres-blue?&style=for-the-badge&logo=postgresql&logoColor=white
[langgraph-shield]: https://img.shields.io/badge/LangGraph-blue?&style=for-the-badge&logo=langgraph&logoColor=white
[pages-shield]: https://img.shields.io/badge/Demo-blue?logo=github&logoColor=white&style=for-the-badge
[frontend-version-shield]: https://img.shields.io/github/v/tag/it-at-m/mucgpt?filter=mucgpt-frontend-*&label=frontend&style=for-the-badge&color=blue
[core-service-version-shield]: https://img.shields.io/github/v/tag/it-at-m/mucgpt?filter=mucgpt-core-*&label=core-service&style=for-the-badge&color=blue
[assistant-service-version-shield]: https://img.shields.io/github/v/tag/it-at-m/mucgpt?filter=mucgpt-assistant-0*&label=assistant-service&style=for-the-badge&color=blue
[migrations-service-version-shield]: https://img.shields.io/github/v/tag/it-at-m/mucgpt?filter=mucgpt-assistant-migrations-*&label=migrations&style=for-the-badge&color=blue
[assistant-service-tests-shield]: https://github.com/it-at-m/mucgpt/actions/workflows/test-assistant-service.yaml/badge.svg
[core-service-tests-shield]: https://github.com/it-at-m/mucgpt/actions/workflows/test-core-service.yaml/badge.svg
[assistant-service-tests]: https://github.com/it-at-m/mucgpt/actions/workflows/test-assistant-service.yaml
[core-service-tests]: https://github.com/it-at-m/mucgpt/actions/workflows/test-core-service.yaml
[frontend-container]: https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-frontend
[core-service-container]: https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-core
[assistant-service-container]: https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant
[migrations-service-container]: https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt%2Fmucgpt-assistant-migrations

MUCGPT is a system that enables users to interact with a large language model (LLM) through a web interface. This interaction is facilitated by an agentic system that can access several tools. To get a feel for it, take a look at our [demo frontend](https://it-at-m.github.io/mucgpt/).

Roles and rights management is facilitated by access to an OpenID Connect provider.

Users can create their own assistants and share them within the organisation. A personal assistant is a configuration of the MUCGPT agent, particularly the activated tools and system prompts.

See the [open issues](https://github.com/it-at-m/mucgpt/issues) for a full list of proposed features (and known issues).

## Table of contents

- [Built With](#️built-with)
- [Getting Started](#getting-started)
- [Roadmap](#%EF%B8%8F-roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

[itm-opensource]: https://opensource.muenchen.de/
[license]: https://github.com/it-at-m/mucgpt/blob/main/LICENSE
[releases]: https://github.com/it-at-m/mucgpt/releases
[gitmoij]: https://gitmoji.dev/
[uv]: https://github.com/astral-sh/uv
[fastapi]: https://fastapi.tiangolo.com/
[postgres]: https://www.postgresql.org/
[langgraph]: https://langchain-ai.github.io/langgraph/
[pages]: https://it-at-m.github.io/mucgpt/
[react]: https://react.dev/

## ⚒️ Built With

### Backend

- [Python 3.10, 3.11 or 3.12](https://www.python.org/downloads/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [LangGraph](https://www.langchain.com/langgraph)

### Frontend

- [React](https://de.react.dev/)
- [Typescript](https://www.typescriptlang.org/)
- [Javascript](https://wiki.selfhtml.org/wiki/JavaScript)

### Deployment

- [Node.js 20+](https://nodejs.org/en/download/package-manager)
- [Git](https://git-scm.com/downloads)
- Python 3.12
- [uv](https://github.com/astral-sh/uv)
- Docker

## 🏃‍♂️‍➡️ Getting started

- Install uv: <https://docs.astral.sh/uv/getting-started/installation/>
  - [Using UV during development](/docs/DEVELOPMENT.md)
- Install [Node.js 20+](https://nodejs.org/en/download/package-manager)

### ⚙️ Configure the environment

Configuration can be done in two ways:
1. **Environment variables** (via `.env` file) - recommended for simple deployments
2. **YAML configuration file** - recommended for complex deployments with multiple models

#### Environment Variables Configuration

Configuration can be found in form of an .env file

```bash
cd stack
cp .env.example .env
```

Below is an example of how to configure the `MUCGPT_CORE_MODELS` environment variable in your `.env` file. This variable defines the available LLM models for the core backend as a JSON array. Each object in the array specifies the model type, name, endpoint, API key, token limits, and a description.

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
      "description": "<description>",
      "input_cost_per_token": "<price>",
      "output_cost_per_token": "<price>",
      "supports_function_calling": true,
      "supports_reasoning": false,
      "supports_vision": true,
      "litellm_provider": "<provider>",
      "inference_location": "<region>"
    }
  }
]'
```

#### YAML Configuration File (Recommended)

Instead of using base64-encoded JSON in environment variables, you can use a YAML configuration file for easier model configuration. Create a `config.yaml` file in the service directory (e.g., `mucgpt-core-service/config.yaml`).

Example `config.yaml` for the core service:

```yaml
# Core service configuration
VERSION: "0.0.1"
ENV_NAME: "MUCGPT"

# Models configuration - much cleaner than JSON in environment variables!
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

**Configuration Priority:**
1. Environment variables (highest priority)
2. YAML configuration file
3. `.env` file (lowest priority)

This means you can use YAML for most settings and override specific values with environment variables when needed.

#### Docker Compose Configuration

When using the Docker Compose stack (in the `stack/` directory), configuration is done via YAML files that are mounted into the containers. This is the **recommended approach** for running MUCGPT with Docker.

**Setup:**

1. Copy the environment file for gateway settings:
   ```bash
   cd stack
   cp .env.example .env
   ```

2. Edit the YAML configuration files:
   - **core-service-config.yaml**: Configure your LLM models
   - **assistant-service-config.yaml**: Configure database (defaults usually work)
   - **shared-config.yaml**: Configure optional features (Redis, Langfuse, MCP, LDAP)

3. Start the stack:
   ```bash
   docker compose up -d
   # or with podman
   podman compose up -d
   ```

The YAML files are mounted as read-only volumes in the containers, making it easy to update configurations without rebuilding images.

📖 See [stack/README.md](stack/README.md) for detailed Docker Compose documentation.

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

Replace the placeholder values with your actual model configuration.

#### LDAP integration

Assistants can be published to specific departments. MUCGPT reads the organization’s department tree from the configured LDAP directory, so published assistants are scoped according to that hierarchy. Ensure LDAP integration is enabled and the relevant organizational units are exposed so departments can be targeted correctly.

```env
MUCGPT_LDAP_ENABLED=true
MUCGPT_LDAP_HOST=ldaps://ldap.example.de
MUCGPT_LDAP_PORT=636
MUCGPT_LDAP_USE_SSL=true
MUCGPT_LDAP_START_TLS=false
MUCGPT_LDAP_VERIFY_SSL=true
MUCGPT_LDAP_CA_CERT_FILE="/path/to/ca-bundle.pem"
MUCGPT_LDAP_BIND_DN="cn=mucgpt,ou=Service Accounts,o=Landeshauptstadt München,c=de"
MUCGPT_LDAP_BIND_PASSWORD="<secret>"
MUCGPT_LDAP_SEARCH_BASE="o=Landeshauptstadt München,c=de"
MUCGPT_LDAP_SEARCH_FILTER="(objectClass=organizationalUnit)"
MUCGPT_LDAP_DISPLAY_ATTRIBUTE="ou"
MUCGPT_LDAP_PARENT_ATTRIBUTE="lhmParentOu" # optional
MUCGPT_LDAP_ADDITIONAL_ATTRIBUTES='["lhmOULongname","lhmOUShortname"]'
MUCGPT_LDAP_REQUIRED_ATTRIBUTES='["lhmOULongname","lhmOUShortname"]'
MUCGPT_LDAP_IGNORED_OU_PREFIXES='["_"]'
MUCGPT_LDAP_IGNORED_OU_SUFFIXES='["-xxx"]'
MUCGPT_LDAP_PAGE_SIZE=500
MUCGPT_LDAP_CONNECT_TIMEOUT=5.0
MUCGPT_LDAP_READ_TIMEOUT=10.0
```

- `MUCGPT_LDAP_SEARCH_BASE` defaults to `o=Landeshauptstadt München,c=de` and defines the root of the organization tree.
- Toggle `MUCGPT_LDAP_USE_SSL` / `MUCGPT_LDAP_START_TLS` / `MUCGPT_LDAP_VERIFY_SSL` depending on your directory security requirements; set `MUCGPT_LDAP_CA_CERT_FILE` if your LDAP server uses a custom CA.
- `MUCGPT_LDAP_DISPLAY_ATTRIBUTE` (default `ou`) controls the label shown for each organizational unit; `MUCGPT_LDAP_PARENT_ATTRIBUTE` can be set if your LDAP schema exposes a parent reference.
- `MUCGPT_LDAP_ADDITIONAL_ATTRIBUTES` fetches extra attributes for display; `MUCGPT_LDAP_REQUIRED_ATTRIBUTES` are enforced and default to `lhmOULongname` and `lhmOUShortname`.
- `MUCGPT_LDAP_IGNORED_OU_PREFIXES` / `_SUFFIXES` let you skip placeholder OUs (by default everything starting with `_` or ending with `-xxx`).
- Pagination and robustness: `MUCGPT_LDAP_PAGE_SIZE` (default 500), `MUCGPT_LDAP_CONNECT_TIMEOUT` (default 5s), and `MUCGPT_LDAP_READ_TIMEOUT` (default 10s).

#### SSO integration

Authentication is performed in front of the services via the [refarch API Gateway](https://refarch.oss.muenchen.de/gateway.html). MUCGPT only accepts access tokens that contain a specific role and forwards the department claim for authorization checks.

```env
MUCGPT_SSO_ROLE=lhm-ab-mucgpt-user
```

- The role required to access MUCGPT defaults to `lhm-ab-mucgpt-user` (configurable via `MUCGPT_SSO_ROLE`).
- The API Gateway handles OpenID Connect login, token issuance, and validation; services receive a validated access token.
- The access token includes the user’s `department` claim, which is combined with the LDAP organization tree to scope assistant publishing and access.


#### MCP (optional)

Besides static tools, MucGPT allows configuration of MCP sources, for which tools are fetched and can be called.

```env
MUCGPT_MCP_SOURCES='{
    "<source_id>": {
        "url": "...",
        "forward_token": true,
        "transport": "sse"
    }
}'
```

- `MUCGPT_MCP_SOURCES`
  - `<source_id>`: Unique id of one MCP source.
    - `url`: URL of the mcp endpoint.
    - `forward_token`: If the oAuth 2.0 JWT token used for authentication should be forwarded to the MCP endpoint.
    - `transport`: Transport protocol (`"sse"` or `"streamable_http"`), see <https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>
- `MUCGPT_MCP_CACHE_TTL`: Time-to-live of cached MCP tools in s (default: 12h).

### 🐋 Run with Docker

See the [stack README](/stack/README.md) for complete Docker Compose setup instructions, including:

- Quick start guide
- Service architecture and ports
- Production and development modes
- Common commands and troubleshooting

## 🛤️ Roadmap

```mermaid
%%{init:
{
  "theme": "base",
  "themeVariables": {
      "primaryColor": "#F8B6B8",
      "primaryTextColor": "#222222",
      "primaryBorderColor": "#F6A6A6",
      "lineColor": "#FFE5B4",
      "secondaryColor": "#B6E2D3",
      "tertiaryColor": "#FFFFFF",
      "background": "#FFF8F0",
      "fontSize": "20px",
      "fontFamily": "Inter, Segoe UI, Trebuchet MS, Verdana, Arial, sans-serif"
  }
}
}%%
timeline
  title 🚀 MUCGPT Roadmap (24.11.2025)

  section 🎉 Open Source
    2024-06 : 🟢 Open Source : Public release for everyone!

  section 🖥️ UI & Experience
    2024-07 : 💾 Chat History : Save chats in your browser
    2024-08 : ⚙️ LLM Config : Tune the LLM to your needs
    2024-09 : 🗣️ Easy Language : Simplify any text

  section 🤖 Custom Assistants
    2025-01 : 🛠️ Build Assistants : Create your own helpers

  section 🌐 MUCGPT 2.0: Agent Mode
    2025-07 : 🧩 Microservices : API-Gateway, Core, Assistant-Service
    2025-12 : ☁️ Share Assistants : Share & use tools (Summarize, Brainstorm, Simple Language)
    2025-12 : 🛡️ MCP Tools : Connect MCP tools

  section 💡 Knowledge and document processing
    2026: 📃 Chat with your documents
    2026: 📂 Shared Knowledge Base: Access shared information in chat and assistants (reuse F13 components)

  section 🪚 Additional tools
    2026: 🔍 Websearch: Search the Web
    2026: ...
```

## 📃 Documentation

## Architecture Overview

MUCGPT uses a modern microservices architecture optimized for scalability and maintainability:

- **Frontend**: User interface layer built with React
- **API Gateway**: Entry point for all client requests
- **Core Service**: LLM agent orchestration and tool integration
- **Assistant Service**: Configuration management for assistants
- **PostgreSQL**: Database for persistence
- **Keycloak**: Authentication and user management

<!-- markdownlint-disable MD033 -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.png">
  <img alt="MUCGPT Architecture Diagram" src="docs/architecture.png">
</picture>
<!-- markdownlint-enable MD033 -->

The architecture of MUCGPT is structured into these primary components: the frontend, the core service for handling tools and the communication with the LLM, and the assistant service. Additionally, it features an API Gateway, a database, and integrates Single Sign-On (SSO) for authentication.

The frontend is based on a template from [Microsoft Azure](https://github.com/Azure-Samples/azure-search-openai-demo) and is implemented using React, Typescript and Javascript.

The framework used to implement the backends (the core- and the assistant service) of MUCGPT is called [FastAPI](https://fastapi.tiangolo.com/). It is a modern, fast (high-performance), web framework for building APIs with Python based on standard Python type hints. The `core service` uses LangGraph to connect to LLMs.
Each service provides specialized functionality:

- **Core Service**: Manages LLM interactions and orchestrates tools. It uses LangGraph to create an agent architecture that can process user requests, call appropriate tools, and generate responses.

- **Assistant Service**: Manages the creation, modification, and sharing of assistant configurations. These configurations define which tools are available to an agent and what system prompts guide their behavior.

- **Migration Service**: Handles database migrations for the Assistant Service, ensuring schema updates are applied consistently.

The API Gateway is developed in Java based on the [Spring Cloud Gateway](https://spring.io/projects/spring-cloud-gateway), providing robust routing, security, and scalability for all services. [IT@M](https://github.com/it-at-m) distributes the gateway as a container image: `ghcr.io/it-at-m/refarch/refarch-gateway`. For detailed documentation, see the [gateway documentation](https://refarch.oss.muenchen.de/gateway.html).

Authentication is managed using [Keycloak](https://www.keycloak.org/), a robust open-source identity and access management solution. Keycloak handles user authentication, authorization, and user management for the MUCGPT platform, enabling secure Single Sign-On (SSO) across all services.
For more details on customizing authentication or extending user management, refer to the [Keycloak Migration Framework documentation](https://mayope.github.io/keycloakmigration/).

[Langfuse](https://langfuse.com/) is an open-source LLM observability platform that supports agent tracing and prompt management. It is optional in MUCGPT.

For more information, see the [MUCGPT Features documentation](/docs/FEATURES.md).

## 🖊️ Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please open an issue with the tag "enhancement", fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Open an issue with the tag "enhancement"
2. Fork the Project
3. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
4. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
5. Push to the Branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

More about this in the [CODE_OF_CONDUCT](/CODE_OF_CONDUCT.md) file.

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) file for more information.

## 📬 Contact

it@M - <itm.kicc@muenchen.de>
