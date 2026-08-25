variable "aws_region" {
  type        = string
  description = "Primary AWS region for all Scribl POC resources."
  default     = "us-east-2"
}

variable "aws_profile" {
  type        = string
  description = "AWS CLI/SSO profile used to authenticate Terraform."
  default     = "CraftMind"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev | prod)."
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be one of: dev, prod."
  }
}

variable "api_image_tag" {
  type        = string
  description = "ECR image tag to deploy on the App Runner API service."
  default     = "dev"
}
