# MUCGPT

<!-- PROJECT LOGO -->
<div align="center">
  <a href="#">
    <img src="app/frontend/src/assets/mucgpt_black_filled.png" alt="Logo" height="400" style="display: block; margin: 0 auto; filter: invert(0)">
  </a>
</div>
<br />

<!-- ABOUT THE PROJECT -->
[![Made with love by it@M][made-with-love-shield]][itm-opensource]
[![GitHub license][license-shield]][license]
[![GitHub release version][github-release-shield]][releases]
![Supported python versions][python-versions-shield]

[made-with-love-shield]: https://img.shields.io/badge/made%20with%20%E2%9D%A4%20by-it%40M-yellow?style=for-the-badge
[license-shield]: https://img.shields.io/github/license/it-at-m/itm-prettier-codeformat?style=for-the-badge
[github-release-shield]: https://img.shields.io/github/v/release/it-at-m/mucgpt?style=for-the-badge
[python-versions-shield]: https://img.shields.io/badge/python-3.10|%203.11%20|%203.12-blue?style=for-the-badge

[itm-opensource]: https://opensource.muenchen.de/
[license]: https://github.com/it-at-m/mucgpt/blob/main/LICENSE
[releases]: https://github.com/it-at-m/mucgpt/releases
MUCGPT provides a web interface based on a large language model (LLM). The interface currently connects to one or multiple OpenAI-compatible LLM-enpdoints,  which allows users to chat, summarise text, brainstorm some ideas and translate a text to plain or easy language. The chat function allows text to be generated and refined in several steps. Summarizing allows PDFs or text to be shortened and made more concise. Brainstorming allows users to create mind maps for different topics. Simplified language allows the user to translate a text into plain or easy language, resulting in a more understandable and easier-to-read text. The included IAC files for Azure make it easy to deploy the project in just a few steps.

Why should you use MUCGPT? See for yourself:  
  
![Essay of MUCGPT to convince the user to use it!](/docs/convince-the-user.png) 


## Built With

The documentation project is built with technologies we use in our projects (see [requirements-dev.txt](/requirements-dev.txt)):
### Backend:
* [Python 3.10, 3.11 or 3.12](https://www.python.org/downloads/)
* [FastAPI](https://fastapi.tiangolo.com/)
* [LangChain](https://www.langchain.com/)

### Frontend:

* [React](https://de.react.dev/)
* [Typescript](https://www.typescriptlang.org/)
* [Javascript](https://wiki.selfhtml.org/wiki/JavaScript)

### Deployment:
  * [Node.js 20+](https://nodejs.org/en/download/package-manager)
  * [Git](https://git-scm.com/downloads)
  * Python 3.12
  * [uv](https://github.com/astral-sh/uv)
  * Docker

## Table of contents
* [Built With](#built-with)
* [Roadmap](#roadmap)
* [Run](#Run)
* [Documentation](#documentation)
* [Contributing](#contributing)
* [License](#license)
* [Contact](#contact)

## Roadmap

![Roadmap](/docs/roadmap_2024.png)


See the [open issues](https://github.com/it-at-m/mucgpt/issues) for a full list of proposed features (and known issues).

## Run
 Configure your environment in [config/default.json](config/default.json). The schema of the configuration is [cofnig/mucgpt_config.schema.json](config/mucgpt_config.schema.json) described.  Insert Model Endpoint and API Key for your connection to an OpenAI completion endpoint or an Azure OpenAI completions endpoint.

### Generate python requirements for your python version
```bash
pip install uv # in case it isn't installed
uv pip compile pyproject.toml  -o app/backend/requirements.txt --python-version <python-version>  # generate deps
uv pip compile pyproject.toml  -o requirements-dev.txt --python-version <python-version> --all-extras # generate dev deps
```
### Run locally
```bash
cd app\backend
pip install --no-cache-dir --upgrade -r requirements.txt   
cd ..\frontend
npm run build
cd ..\backend
$env:MUCGPT_CONFIG="path to default.json"
$env:MUCGPT_BASE_CONFIG="path to base.json"
uvicorn app:backend --reload   
```


### Run with docker
1. Build an Image
   ``` docker build --tag mucgpt-local . --build-arg   fromconfig="./config/default.json"```
2. Run the image ```docker run --detach --publish 8080:8000 mucgpt-local```


## Documentation
![Architecture](docs/appcomponents_en.png)  
 The architecture of MUCGPT is divided into two parts, the frontend and the backend. MUCGPT is deployed on Microsoft Azure as an AppService with a PostgreSQL database and an Azure OpenAI resource.
  
The frontend is based on a template from [Microsoft Azure](https://github.com/Azure-Samples/azure-search-openai-demo) and is implemented using React, Typescript and Javascript.
  
The framework used to implement the backend of MUCGPT is called [FastAPI](https://fastapi.tiangolo.com/). It is a modern, fast (high-performance), web framework for building APIs with Python based on standard Python type hints. The backend uses LangChain to connect to LLMs. In the [config](config/default.json) file, you can provide the user with various LLM options to select from in the frontend.

  
For more information about all the features of MUCGPT click [here](/docs/FEATURES.md).  
  
A cheatsheat to use MUCGPT is located [here](app/frontend/src/assets/mucgpt_cheatsheet.pdf).

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

it@M - itm.kicc@muenchen.de

