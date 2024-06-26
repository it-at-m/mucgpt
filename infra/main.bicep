targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

param appServicePlanName string = ''
param backendServiceName string = ''
param resourceGroupName string = ''

param applicationInsightsName string = ''

@secure()
param ssoSecret string
param ssoIssuer string
param configName string
param tagStage string
param dbHost string = ''
param dbName string = ''
param dbUser string = ''
param backendSkuName string
param backendCapacaty int 
@secure()
param dbPassword string = ''

param openAiServiceName string = ''
param openAiResourceGroupName string = ''
@description('Location for the OpenAI resource group')
@allowed(['canadaeast', 'eastus', 'francecentral', 'japaneast', 'northcentralus', 'westeurope'])
@metadata({
  azd: {
    type: 'location'
  }
})
param openAiResourceGroupLocation string

param openAiSkuName string = 'S0'

param chatGptDeploymentName string // Set in main.parameters.json
param chatGptDeploymentCapacity int = 70
param chatGptModelName string = 'gpt-35-turbo'
param chatGptModelVersion string = '0301'

@description('Use Application Insights for monitoring and performance tracing')
param useApplicationInsights bool = false

var ssoConfiguration = concat(ssoIssuer, '/.well-known/openid-configuration')
var abbrs = loadJsonContent('abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {'azd-env-name': environmentName,'BusinessCriticality': 'low','BusinessUnit': 'ITM-KM-DI-KI','CostCenter': '313-2-014400','ExpiryDate': '31.12.2999','RequestNumber': 'Nicht vorhanden','ServiceName': 'MUCGPT','ServiceOwner': 'Michael Jaumann - ITM-KM-DI-KI','Stage': tagStage}

// Organize resources in a resource group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

resource openAiResourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' existing = if (!empty(openAiResourceGroupName)) {
  name: !empty(openAiResourceGroupName) ? openAiResourceGroupName : resourceGroup.name
}


// Monitor application with Azure Monitor
module monitoring 'core/monitor/monitoring.bicep' = if (useApplicationInsights) {
  name: 'monitoring'
  scope: resourceGroup
  params: {
    location: location
    tags: tags
    applicationInsightsName: !empty(applicationInsightsName) ? applicationInsightsName : '${abbrs.insightsComponents}${resourceToken}'
  }
}

// Create an App Service Plan to group applications under the same payment plan and SKU
module appServicePlan 'core/host/appserviceplan.bicep' = {
  name: 'appserviceplan'
  scope: resourceGroup
  params: {
    name: !empty(appServicePlanName) ? appServicePlanName : '${abbrs.webServerFarms}${resourceToken}'
    location: location
    tags: tags
    sku: {
      name:  backendSkuName
      capacity: backendCapacaty
    }
    kind: 'linux'
  }
}

// Create an App Service Plan to group applications under the same payment plan and SKU
module db 'core/db/db.bicep' = {
  name: 'db'
  scope: resourceGroup
  params: {
    name: dbHost
    location: location
    tags: tags
    administratorLogin:  dbUser
    administratorLoginPassword: dbPassword
  }
}

// The application frontend
module backend 'core/host/appservice.bicep' = {
  name: 'web'
  scope: resourceGroup
  params: {
    name: !empty(backendServiceName) ? backendServiceName : '${abbrs.webSitesAppService}backend-${resourceToken}'
    location: location
    tags: union(tags, { 'azd-service-name': 'backend' })
    appServicePlanId: appServicePlan.outputs.id
    runtimeName: 'python'
    runtimeVersion: '3.10'
    appCommandLine: 'python3 -m gunicorn main:app'
    scmDoBuildDuringDeployment: true
    managedIdentity: true
    ssoSecret: ssoSecret
    healthCheckPath: '/health'
    appSettings: {
      AZURE_OPENAI_SERVICE: openAi.outputs.name
      AZURE_OPENAI_CHATGPT_DEPLOYMENT: chatGptDeploymentName
      AZURE_OPENAI_CHATGPT_MODEL: chatGptModelName
      APPLICATIONINSIGHTS_CONNECTION_STRING: useApplicationInsights ? monitoring.outputs.applicationInsightsConnectionString : ''
      SSO_ISSUER: ssoIssuer
      CONFIG_NAME: configName
      DB_HOST: concat(dbHost, '.postgres.database.azure.com')
      DB_NAME: dbName
      DB_USER: dbUser
      DB_PASSWORD: dbPassword
    }
  }
}

module openAi 'core/ai/cognitiveservices.bicep' = {
  name: 'openai'
  scope: openAiResourceGroup
  params: {
    name: !empty(openAiServiceName) ? openAiServiceName : '${abbrs.cognitiveServicesAccounts}${resourceToken}'
    location: openAiResourceGroupLocation
    tags: tags
    sku: {
      name: openAiSkuName
    }
    deployments: [
      {
        name: chatGptDeploymentName
        model: {
          format: 'OpenAI'
          name: chatGptModelName
          version: chatGptModelVersion
        }
        sku: {
          name: 'Standard'
          capacity: chatGptDeploymentCapacity
        }
      }
    ]
  }
}

module authsettingsV2 'core/host/authsettingsV2.bicep' = {
  name: 'authsettingsV2'
  scope: resourceGroup
  params: {
    location: location
    siteName: backend.outputs.name
    ssoConfiguration: ssoConfiguration
  }
}

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_RESOURCE_GROUP string = resourceGroup.name

output AZURE_OPENAI_SERVICE string = openAi.outputs.name
output AZURE_OPENAI_RESOURCE_GROUP string = openAiResourceGroup.name
output AZURE_OPENAI_CHATGPT_DEPLOYMENT string = chatGptDeploymentName
output AZURE_OPENAI_CHATGPT_MODEL string = chatGptModelName
output BACKEND_URI string = backend.outputs.uri
