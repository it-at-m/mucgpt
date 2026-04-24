<!-- PROJECT LOGO -->
<div align="center">
  <img src="assets/mucgpt_title.svg" alt="MUCGPT logo" width="900" />
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
[python-versions-shield]: https://img.shields.io/badge/python-3.13-blue?style=for-the-badge
[gitmoij-shield]: https://img.shields.io/badge/gitmoij-😜😍-blue?style=for-the-badge
[npm-versions-shield]: https://img.shields.io/badge/node-22+-blue?style=for-the-badge
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

Users can create their own assistants and share them within the organization. A personal assistant is a configuration of the MUCGPT agent, particularly the activated tools and system prompts.

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

- [Python 3.13](https://www.python.org/downloads/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [LangGraph](https://www.langchain.com/langgraph)

### Frontend

- [React](https://de.react.dev/)
- [Typescript](https://www.typescriptlang.org/)
- [Javascript](https://wiki.selfhtml.org/wiki/JavaScript)

### Deployment

- [Node.js 22+](https://nodejs.org/en/download/package-manager)
- [Git](https://git-scm.com/downloads)
- Python 3.13
- [uv](https://github.com/astral-sh/uv)
- Docker

## 🏃‍♂️‍➡️ Getting started

Please check the [Getting Started documentation](docs/GETTING_STARTED.md) for detailed instructions on configuration, LDAP, SSO, MCP setup, and running the application.

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

- **Document Parsing**: Extracts text and structure from uploaded documents for the Core Service. Currently, only Kreuzberg is supported as the parsing backend.

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

Please note that MUCGPT uses **Kreuzberg** as an optional dependency for document parsing. Kreuzberg is distributed under the **Elastic License v2.0 (ELv2)**, which deviates from the MIT license used for the rest of this project.

## 📬 Contact

it@M - <itm.kicc@muenchen.de>
