variable "project" {
  type        = string
  description = "Project name prefix."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev | prod)."
}

variable "ecr_repository_url" {
  type        = string
  description = "URL of the API ECR repository (from module.ecr) — the image URI base."
}

variable "api_image_tag" {
  type        = string
  description = "ECR image tag to deploy on the App Runner service."
  default     = "dev"
}

variable "vpc_connector_arn" {
  type        = string
  description = "App Runner VPC connector ARN. When set, the service routes egress through the VPC to reach the private DB. Null keeps default public egress."
  default     = null
}

variable "database_url_secret_arn" {
  type        = string
  description = "ARN of the DATABASE_URL secret (from module.secrets)."
}

variable "openai_api_key_secret_arn" {
  type        = string
  description = "ARN of the OPENAI_API_KEY secret (from module.secrets)."
}

variable "anthropic_api_key_secret_arn" {
  type        = string
  description = "ARN of the ANTHROPIC_API_KEY secret (from module.secrets)."
}
