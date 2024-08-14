variable "location" {
  description = "(Required) The Azure location where the resource should be deployed"
  type        = string
  default     = "westeurope"
}

variable "prefix" {
  type        = string
  description = "The prefix used for all resources in this example"
  default = "mucgpt"
}


variable "rg_name" {
  description = "(Required) The RG_name. Please refer to the naming convention described in confluence."
  type        = string
}

variable "container_reg_name" {
  description = "The Container Registry Name. Please refer to the naming convention described in confluence."
  type        = string
  default = ""
}

variable "service_plan_name" {
  description = "The Service Plan Name."
  type        = string
  default = ""
}

variable "service_plan_sku" {
  description = "The Service Plan Name"
  type        = string
  default = ""
}

variable "backend_name" {
  description = "The Webapp Name for the App Service"
  type        = string
  default = ""
}

variable "registry_username" {
  description = "The username for the container registry"
  type        = string
}

variable "registry_password" {
  description = "The password for the container registry"
  type        = string
}

variable "image_name"{
  description = "The image name of the image in the appservice"
  type        = string
}

variable "sso_secret"{
  description = "The secret for the sso"
  type        = string
}

variable "sso_configuration_endpoint"{
  description = "The configuration endpoint for the openid-connect endpoint. Ends with .well-known/openid-configuration"
  type        = string
}

variable "tags" {
  description = "(Required) The necessary tags defined in the tagging concept are mandatory."
  type = object({
        cce-businesscriticality: string
        cce-costcenter: string
        cce-businessunit: string
        cce-expirydate: string
        cce-requestnumber: string
        cce-serviceid: string
        cce-serviceowner: string
        cce-shortname: string
        cce-stage: string
  })
}
