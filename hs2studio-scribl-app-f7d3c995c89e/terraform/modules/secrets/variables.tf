variable "project" {
  type        = string
  description = "Project name prefix."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev | prod)."
}

variable "database_url_value" {
  type        = string
  description = "Value seeded into the database-url secret. Defaults to PLACEHOLDER; the dev root passes the RDS connection string. ignore_changes keeps any later manual override."
  default     = "PLACEHOLDER"
  sensitive   = true
}
