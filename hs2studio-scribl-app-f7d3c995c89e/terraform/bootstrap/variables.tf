variable "aws_region" {
  type        = string
  description = "Primary AWS region for scribl-poc."
  default     = "us-east-2"
}

variable "aws_profile" {
  type        = string
  description = "AWS CLI/SSO profile used to provision the state backend. Null uses the default credential chain."
  default     = null
}

variable "project" {
  type        = string
  description = "Project name prefix."
  default     = "scribl-poc"
}
