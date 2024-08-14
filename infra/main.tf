
resource "random_id" "server" {
  byte_length = 16
}



resource "azurerm_container_registry" "acr" {
  name                = var.container_reg_name == "" ? "containerReg${random_id.server.hex}" :  var.container_reg_name 
  resource_group_name = var.rg_name
  location            = var.location
  sku                 = "Standard"
  admin_enabled       = true
}

resource "azurerm_service_plan" "asp" {
  name                = var.service_plan_name == "" ? "${var.prefix}_serviceplan_${random_id.server.hex}" :  var.service_plan_name 
  location            = var.location
  resource_group_name = var.rg_name
  os_type             = "Linux"
  sku_name            = var.service_plan_sku
}

resource "azurerm_linux_web_app" "webapp" {
  name                = var.backend_name == "" ?  "${var.prefix}-backend-${random_id.server.hex}" : var.backend_name
  location            = var.location
  resource_group_name = var.rg_name
  service_plan_id     = azurerm_service_plan.asp.id

  app_settings = {
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
    LHMSSO_PROVIDER_AUTHENTICATION_SECRET = var.sso_secret
    WEBSITES_PORT = 8000
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = false
    DOCKER_ENABLE_CI = "true"
  }

  site_config {
    always_on = "true"
    application_stack {
      docker_image_name   = var.image_name
      docker_registry_url = "https://${azurerm_container_registry.acr.login_server}" 
      docker_registry_username = var.registry_username
      docker_registry_password = var.registry_password
    }
    health_check_path = "/health"
  }
  auth_settings_v2 {
    auth_enabled = true
    require_authentication = true
    unauthenticated_action = "RedirectToLoginPage"
    default_provider = "LHMSSO"
    excluded_paths=["/health"]
    custom_oidc_v2 {
      name = "LHMSSO"
      client_id = "mucgpt"
      openid_configuration_endpoint = var.sso_configuration_endpoint
      scopes = ["openid"]
    }
    login {

    }
  }


  logs{
    application_logs{
      file_system_level = "Verbose"

    }
    http_logs{
      file_system{
        retention_in_mb =  30
        retention_in_days = 7
      }
    }
  }
}
