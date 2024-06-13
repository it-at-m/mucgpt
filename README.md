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

[made-with-love-shield]: https://img.shields.io/badge/made%20with%20%E2%9D%A4%20by-it%40M-yellow?style=for-the-badge
[license-shield]: https://img.shields.io/github/license/it-at-m/itm-prettier-codeformat?style=for-the-badge
[github-release-shield]: https://img.shields.io/github/v/release/it-at-m/mucgpt?style=for-the-badge

[itm-opensource]: https://opensource.muenchen.de/
[license]: https://github.com/it-at-m/mucgpt/blob/main/LICENSE
[releases]: https://github.com/it-at-m/mucgpt/releases
MUCGPT provides a web interface based on a large language model (LLM). Currently, the interface uses ChatGPT3.5, which allows users to chat, summarise text and brainstorm. The chat function allows text to be generated and refined in several steps. Summarising allows PDFs or text to be shortened and made more concise. Brainstorming allows users to create mind maps for different topics. The included IAC files for Azure make it easy to deploy the project in just a few steps.

Why should you use MUCGPT? Let itself convince you:  
  
![Essay of MUCGPT to convince the user to use it!](/docs/convince-the-user.png) 


## Built With

The documentation project is built with technologies we use in our projects (see [requirements-dev.txt](/requirements-dev.txt)):
### Backend:
* [Python 3.9, 3.10 or 3.11](https://www.python.org/downloads/)
* [Quart](https://pgjones.gitlab.io/quart/)
* [Azure OpenAI](https://azure.microsoft.com/de-de/products/ai-services/openai-service)
* [LangChain](https://www.langchain.com/)

### Frontend:

* [React](https://de.react.dev/)
* [Typescript](https://www.typescriptlang.org/)
* [Javascript](https://wiki.selfhtml.org/wiki/JavaScript)

### Deployment:
  * [Azure Developer CLI](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd?tabs=winget-windows%2Cbrew-mac%2Cscript-linux&pivots=os-windows)
  * [Node.js 14+](https://nodejs.org/en/download/package-manager)
  * [Git](https://git-scm.com/downloads)
  * [Powershell 7+ (pwsh)](https://github.com/powershell/powershell)

## Table of contents
* [Built With](#built-with)
* [Roadmap](#roadmap)
* [Set up](#set-up-on-azure)
* [Documentation](#documentation)
* [Contributing](#contributing)
* [License](#license)
* [Contact](#contact)

## Roadmap

![Roadmap](/docs/roadmap_2024.png)


See the [open issues](#) for a full list of proposed features (and known issues).


## Set up on Azure
As this project bases on a template of Microsoft Azure see also [here](https://github.com/Azure-Samples/azure-search-openai-demo?tab=readme-ov-file#azure-deployment) for the deployment documentation.
### You need the following requirements to set up MUCGPT on Azure:
* Azure account
* Azure subscription with access enabled for the Azure OpenAI service
* Account Permissions:
  * `Microsoft.Authorization/roleAssignments/write`
  * Role Based Access Control Administrator, User Access Administrator, or Owner
  * subscription-level permissions
  * `Microsoft.Resources/deployments/write` on the subscription level 


### Cost estimation: 
Pricing varies per region and usage, so it isn't possible to predict exact costs for your usage. However, you can try the [Azure pricing calculator](https://azure.microsoft.com/en-us/pricing/calculator/) for the resources below.
* Azure App Service
* Azure OpenAI
* Flexibler Azure Database for PostgreSQL-Server
* App Service-Plan

### Deploying
1. Install the [required tools](#built-with)
2. Clone the repository with the command `git clone https://github.com/it-at-m/mucgpt` and switch in your terminal to the folder
3. Login to your Azure account: `azd auth login`
4. Create a new azd environemnt with `azd env new`. Enter a name that will be used for the resource group. This will create a new folder in the `.azure` folder, and set it as the active environment for any calls to `azd` going forward.
5. (Optional) This is the point where you can customize the deployment by setting environment variables, in order to use existing resources, enable optional features (such as auth or vision), or deploy to free tiers.
6. Run `azd up` - This will provision Azure resources and deploy this sample to those resources.
7. After the application has been successfully deployed you will see a URL printed to the console. Click that URL to interact with the application in your browser. It will look like the following:  
![](/docs/endpoint.png)
    > **_NOTE:_**  It may take 5-10 minutes after you see 'SUCCESS' for the application to be fully deployed. If you see a "Python Developer" welcome screen or an error page, then wait a bit and refresh the page.

### Deploying again
If you've only changed the backend/frontend code in the `app` folder, then you don't need to re-provision the Azure resources. You can just run:

`azd deploy`

If you've changed the infrastructure files (`infra` folder or `azure.yaml`), then you'll need to re-provision the Azure resources. You can do that by running:

`azd up`

### Runnig locally
You can only run locally after having successfully run the `azd up` command. If you haven't yet, follow the steps in [Deploying](#deploying) above.

1. Run `azd auth login`
2. Change dir to app
3. Run `./start.ps1` or `./start.sh` to start the app

## Documentation
![Architecture](docs/appcomponents_en.png)  
The Architecture of MUCGPT splits into two parts, the frontend and the backend. MUCGPT is deployed on Microsoft Azure as a AppService with an PostgreSQL Database and a Azure OpenAI unit.
  
The Frontend bases on a Template from [Microsoft Azure](https://github.com/Azure-Samples/azure-search-openai-demo) and is implemented and enriched with features using React, Typescript and Javascript.    
  
The Framework used to implement the Backend of MUCGPT is called [Quart](https://pgjones.gitlab.io/quart/). It is a Fast Python web microframework to build JSON APIs, render and serve HTML, serve Web Sockets an much more. The Backend is using LangChain to connect LLMs like Chat-GPT-3.5, wich is currently in use.  
  
To get more informations about all the feautures of MUCGPT click [here](/docs/FEATURES.md).  
  
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

it@M - opensource@muenchen.de

