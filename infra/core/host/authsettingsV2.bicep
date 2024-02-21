param siteName string
param location string = resourceGroup().location
param ssoConfiguration string

resource authsettingsV 'Microsoft.Web/sites/config@2022-09-01' = {
  name: '${siteName}/authsettingsV2'
  location: location
  properties: {
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
    globalValidation: {
      requireAuthentication:  true
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'LHMSSO'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        login: {
          disableWWWAuthenticate: false
        }
      }
      customOpenIdConnectProviders: {
        LHMSSO: {
          registration: {
            clientId: 'mucgpt'
            clientCredential: {
              clientSecretSettingName: 'SSO_AUTHENTICATION_SECRET'
            }
            openIdConnectConfiguration: {
              wellKnownOpenIdConfiguration: ssoConfiguration
            }
          }
          login: {
            scopes: [
              'LHM'
            ]
          }
        }
      }
    }
    login: {
      tokenStore: {
        enabled: true
        tokenRefreshExtensionHours: 72
      }
      preserveUrlFragmentsForLogins: false
      allowedExternalRedirectUrls: []
      cookieExpiration: {
        convention: 'FixedTime'
        timeToExpiration: '08:00:00'
      }
      nonce: {
        validateNonce: true
        nonceExpirationInterval: '00:05:00'
      }
    }
    httpSettings: {
      requireHttps: true
      routes: {
        apiPrefix: '/.auth'
      }
      forwardProxy: {
        convention: 'NoProxy'
      }
    }
  }
}


