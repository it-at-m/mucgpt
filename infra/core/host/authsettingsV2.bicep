param siteName string = 'app-backend-y53xwrhpfrete'

resource authsettingsV 'Microsoft.Web/sites/config@2022-09-01' = {
  name: '${siteName}/authsettingsV2'
  properties: {
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
    globalValidation: {
      requireAuthentication:  true
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'SSOTEST'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        login: {
          disableWWWAuthenticate: false
        }
      }
      customOpenIdConnectProviders: {
        SSOTEST: {
          registration: {
            clientId: 'mucgpt'
            clientCredential: {
              clientSecretSettingName: 'SSOTEST_AUTHENTICATION_SECRET'
            }
            openIdConnectConfiguration: {
              wellKnownOpenIdConfiguration: 'https://ssotest.muenchen.de/auth/realms/intrap/.well-known/openid-configuration'
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


