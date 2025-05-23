<!-- PROJECT LOGO -->
<div align="center">
  <a href="#">
    <img src="app/frontend/src/assets/mucgpt_black_filled.png" alt="Logo" height="200" style="display: block; margin: 0 auto; filter: invert(0)">
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
[![Langchain][langchain-shield]][langchain]
[![Demo-Frontend][pages-shield]][pages]

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
[langchain-shield]: https://img.shields.io/badge/LangChain-lightblue?&style=for-the-badge&logo=langchain&logoColor=white
[pages-shield]: https://img.shields.io/badge/Demo-121013?logo=github&logoColor=white&style=for-the-badge
[itm-opensource]: https://opensource.muenchen.de/
[license]: https://github.com/it-at-m/mucgpt/blob/main/LICENSE
[releases]: https://github.com/it-at-m/mucgpt/releases
[gitmoij]: https://gitmoji.dev/
[uv]: https://github.com/astral-sh/uv
[fastapi]: https://fastapi.tiangolo.com/
[postgres]: https://www.postgresql.org/
[langchain]: https://python.langchain.com/docs/introduction/
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
- [LangChain](https://www.langchain.com/)

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

### Install deps

Sync python environment for development:

```bash
cd mucgpt-core-service
uv sync --all-extras # installs dev/test dependencies
# if you only want to run mucgpt without using development deps
uv sync
```

Install frontend deps

```bash
cd mucgpt-frontend
npm install
```

### Configure

Configure your environment. For that, copy the content of the empty config from [/config/.env.empty](/config/.env.empty) to the stack directory [stack/.env](stack/.env). Add at least one model by providing one OpenAI compatible endpoint.

### Run with Docker

To start all required services using Docker Compose, run:

```bash
docker-compose --profile=frontend --profile=backend up --build
```

This command launches the following components:

- **Frontend**: A modern web interface built with React, providing users with an intuitive and responsive experience directly in their browser.
- **Backend**: The core service that processes API requests, manages business logic, and communicates with both the database and connected LLMs.
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
timeline
    title MUCGPT Roadmap

    section Open Source Release
    2024-06 : Open Source : 🚀 Available to the public under an open-source license, allowing anyone to access, use, and modify MUCGPT without restrictions or payment.

    section  UI Features
    2024-07 : Chat History : 💾 Users can save their chat history in the browser.
    2024-08 : LiveCycle LLM : ⚙️ The employed LLM can be configured to meet specific requirements.
    2024-09 : Simplified Language : 🗣️ Translate text into simple or easy-to-understand language.

    section Own GPTs
    2025-01 : Own GPTs : 🔧 Create and generate custom assistants for specific tasks.

    section Major Update for improved reusability
    2025-05 : MUCGPT 2.0 : 🌟 Roles and rights concept for assistants; splitting into smaller Microservices: API-Gateway, MUCGPT-Core, and a Team Management Service.

    section Improving Own GPTs with more Tools
    2025-06 : Own GPTs : ☁️ Share Assistants with others.
    2025-07 : Own GPTs : 🔍 Use Websearch/Deep Research to provide additional knowledge.
    2025-09 : Chat with Own Documents : 📂 Own GPTs will have access to shared knowledge and can answer questions based on provided sources.
```

## Documentation

![Architecture](docs/appcomponents_en.png)
The architecture of MUCGPT is structured into two primary components: the frontend and the backend. Additionally, it features an API Gateway, a database, and integrates Single Sign-On (SSO) for authentication.

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
