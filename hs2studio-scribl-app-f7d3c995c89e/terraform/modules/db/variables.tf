variable "project" {
  type        = string
  description = "Project name prefix."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev | prod)."
}

variable "db_name" {
  type        = string
  description = "Initial database name created on the instance."
  default     = "scribl"
}

variable "db_username" {
  type        = string
  description = "Master username for the Postgres instance."
  default     = "scribl"
}

variable "instance_class" {
  type        = string
  description = "RDS instance class. db.t4g.micro is the cheapest Graviton option for a POC."
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage (GiB)."
  default     = 20
}

variable "engine_version" {
  type        = string
  description = "PostgreSQL major version; AWS selects the latest matching minor."
  default     = "16"
}

variable "publicly_accessible" {
  type        = bool
  description = "Whether the instance gets a public endpoint. False: the DB is private, reachable only from the App Runner VPC connector."
  default     = false
}
