<!-- PROJECT LOGO -->
<div align="center">
  <a href="#">
    <img src="mucgpt-frontend/src/assets/mucgpt_black_filled.png" alt="Logo" height="200" style="display: block; margin: 0 auto; filter: invert(0)">
  </a>
</div>
<br />

<!-- ABOUT THE PROJECT -->

[![Made with love by it@M][made-with-love-shield]][itm-opensource]
[![Gitmoij][gitmoij-shield]][gitmoij]
[![GitHub license][license-shield]][license]
[![GitHub release version][github-release-shield]][releases]
![Supported python versions][python-versions-shield]
![Supported npm versions][npm-versions-shield]
[![uv][uv-shield]][uv]
[![FastAPI][fastapi-shield]][fastapi]
[![React][react-shield]][fastapi]
[![Postgres][postgres-shield]][postgres]
[![LangGraph][langgraph-shield]][langgraph]
[![Demo-Frontend][pages-shield]][pages]

[![Assistant-service tests](https://github.com/it-at-m/mucgpt/actions/workflows/test-assistant-service.yaml/badge.svg)](https://github.com/it-at-m/mucgpt/actions/workflows/test-assistant-service.yaml)
[![Core service tests](https://github.com/it-at-m/mucgpt/actions/workflows/test-core-service.yaml/badge.svg)](https://github.com/it-at-m/mucgpt/actions/workflows/test-core-service.yaml)

[made-with-love-shield]: https://img.shields.io/badge/made%20with%20%E2%9D%A4%20by-it%40M-yellow?style=for-the-badge
[license-shield]: https://img.shields.io/github/license/it-at-m/itm-prettier-codeformat?style=for-the-badge
[github-release-shield]: https://img.shields.io/github/v/release/it-at-m/mucgpt?style=for-the-badge&color=orange
[python-versions-shield]: https://img.shields.io/badge/python-3.10|%203.11%20|%203.12-blue?style=for-the-badge
[gitmoij-shield]: https://img.shields.io/badge/gitmoij-😜😍-yellow?style=for-the-badge
[npm-versions-shield]: https://img.shields.io/badge/node-20+-blue?style=for-the-badge
[uv-shield]: https://img.shields.io/badge/⚡-uv-lightblue?style=for-the-badge
[fastapi-shield]: https://img.shields.io/badge/fastapi-lightblue?style=for-the-badge&logo=fastapi&logoColor=white
[react-shield]: https://shields.io/badge/react-lightblue?logo=react&style=for-the-badge&logoColor=white
[postgres-shield]: https://img.shields.io/badge/postgres-lightblue?&style=for-the-badge&logo=postgresql&logoColor=white
[langgraph-shield]: https://img.shields.io/badge/LangGraph-lightblue?&style=for-the-badge&logo=langgraph&logoColor=white
[pages-shield]: https://img.shields.io/badge/Demo-121013?logo=github&logoColor=white&style=for-the-badge
[itm-opensource]: https://opensource.muenchen.de/
[license]: https://github.com/it-at-m/mucgpt/blob/main/LICENSE
[releases]: https://github.com/it-at-m/mucgpt/releases
[gitmoij]: https://gitmoji.dev/
[uv]: https://github.com/astral-sh/uv
[fastapi]: https://fastapi.tiangolo.com/
[postgres]: https://www.postgresql.org/
[langgraph]: https://langchain-ai.github.io/langgraph/
[pages]: https://it-at-m.github.io/mucgpt/


MUCGPT provides a web interface based on a given large language model (LLM). The whole package is shipped with a Docker container. For a first impression, look at our [demo frontend](https://it-at-m.github.io/mucgpt/)

The interface currently connects to one or multiple OpenAI-compatible LLM-endpoints, which allows users to chat, summarise text, brainstorm ideas and translate a text to plain or easy language. The chat function allows text to be generated and refined in several steps. Summarising allows PDFs or text to be shortened and made more concise. Brainstorming allows users to create mind maps for different topics. Simplified language allows the user to translate a text into plain or easy language, resulting in a more understandable and easier-to-read text.

In addition, custom GPTs can be generated and saved. An own GPT is an assistant for a specific task with a custom system prompt.

See the [open issues](https://github.com/it-at-m/mucgpt/issues) for a full list of proposed features (and known issues).

## Table of contents

- [Built With](#built-with)
- [Getting Started](#getting-started)
- [Roadmap](#roadmap)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Built With

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

## Getting started

- Install uv: <https://docs.astral.sh/uv/getting-started/installation/>
  - [Using UV during development](/docs/DEVELOPMENT.md)
- Install [Node.js 20+](https://nodejs.org/en/download/package-manager)


### Configure

Configure your environment. For that, copy the content of the empty config from [/config/.env.empty](/config/.env.empty) to the stack directory [stack/.env](stack/.env). Add at least one model by providing one OpenAI compatible endpoint.

### Run with Docker

To start all required services using podman or docker run:

```bash
# in case of podman run
podman compose  --build up
# in case of docker run
docker-compose  --build up
```

This command launches the following components:

- **Frontend**: A modern web interface built with React, providing users with an intuitive and responsive experience directly in their browser.
- **Core-Service**: Manages the agent to call LLMs. Also orchestrates tool usage.
- **Assistant-Service**: Manages assistants. An Assistant is an configuratoin for an MUCGPT-Agent.
- **Assistant-Service-Migration**: Does database migrations on startup.
- **API Gateway**: Serves as the unified entry point for all client requests, efficiently routing traffic to backend services while managing authentication and security.
- **Keycloak**: A robust, open-source identity and access management system responsible for authentication, authorization, and user administration.
- **PostgresDB**: A reliable PostgreSQL database used to securely store and manage app statistics.

Once all services are running, you can access:

- The frontend at `localhost:8083` (Username: `mucgpt-user`, Password: `mucgpt`)
- The Keycloak admin panel at `localhost:8100` (Username: `admin`, Password: `admin`)
- The PGAdmin panel at `localhost:5050` (Username: `admin`, Password: `admin`)

Keycloak simulates a Single Sign-On (SSO) service, allowing you to log in to the frontend using the provided credentials (`mucgpt-user` / `mucgpt`).

## Roadmap
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
  title 🚀 MUCGPT Roadmap

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
    2025-07 : ☁️ Share Assistants : Share & use tools (Summarize, Brainstorm, Simple Language)
    2025-08 : 🔍 Websearch & Slides : Search the web, create presentations
    2025-09 : 🧠 Deep Research : Advanced research tools
    2025-10 : 📂 Knowledge Base : Assistants with their own KB & retrieval
    2025-12 : 🛡️ MCP Tools : Connect many MCP tools (e.g., DLF)
```

## Documentation

![Architecture](docs/architecture.png)
The architecture of MUCGPT is structured into three primary components: the frontend, the core service for handling tools and the communication with the llm, and the assistant service. Additionally, it features an API Gateway, a database, and integrates Single Sign-On (SSO) for authentication.

The frontend is based on a template from [Microsoft Azure](https://github.com/Azure-Samples/azure-search-openai-demo) and is implemented using React, Typescript and Javascript.

The framework used to implement the backend of MUCGPT is called [FastAPI](https://fastapi.tiangolo.com/). It is a modern, fast (high-performance), web framework for building APIs with Python based on standard Python type hints. The backend uses LangChain to connect to LLMs. In the [.env](config/.env.empty) file, you can provide the user with various LLM options to select from in the frontend.

The API Gateway is developed in Java based on the [Spring Cloud Gateway](https://spring.io/projects/spring-cloud-gateway), providing robust routing, security, and scalability for all services. [IT@M](https://github.com/it-at-m) distributes the gateway as a container image: `ghcr.io/it-at-m/refarch/refarch-gateway`. For detailed documentation, see [here](https://refarch.oss.muenchen.de/gateway.html).

Authentication is managed using [Keycloak](https://www.keycloak.org/), a robust open-source identity and access management solution. Keycloak handles user authentication, authorization, and user management for the MUCGPT platform, enabling secure Single Sign-On (SSO) across all services.
For more details on customizing authentication or extending user management, refer to the [Keycloak Migration Framework documentation](https://mayope.github.io/keycloakmigration/).

For more information about all the features of MUCGPT click [here](/docs/FEATURES.md).

## Contributing

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

## License

Distributed under the MIT License. See [LICENSE](LICENSE) file for more information.

## Contact

it@M - <itm.kicc@muenchen.de>
