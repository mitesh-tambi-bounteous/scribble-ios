locals {
  project = "scribl-poc"
  env     = var.environment

  default_tags = {
    Project     = local.project
    Environment = local.env
    ManagedBy   = "terraform"
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Container registry for the API image.
module "ecr" {
  source = "../../modules/ecr"

  project     = local.project
  environment = local.env
}

# RDS PostgreSQL — the POC's system of record (replaces external Neon).
module "db" {
  source = "../../modules/db"

  project     = local.project
  environment = local.env
}

# Secrets Manager containers. database-url is populated from the RDS connection
# string; the AI keys stay PLACEHOLDER (seeded out-of-band if live AI is wanted).
module "secrets" {
  source = "../../modules/secrets"

  project     = local.project
  environment = local.env

  database_url_value = module.db.database_url
}

# App Runner API service, pulling the ECR image and reading the app secrets.
module "api" {
  source = "../../modules/api"

  project     = local.project
  environment = local.env

  ecr_repository_url = module.ecr.repository_url
  api_image_tag      = var.api_image_tag

  # Route API egress through the DB's VPC connector so it reaches the private RDS.
  vpc_connector_arn = module.db.vpc_connector_arn

  database_url_secret_arn      = module.secrets.database_url_secret_arn
  openai_api_key_secret_arn    = module.secrets.openai_api_key_secret_arn
  anthropic_api_key_secret_arn = module.secrets.anthropic_api_key_secret_arn
}

# S3 + CloudFront hosting for the Expo web export.
module "web" {
  source = "../../modules/web"

  project     = local.project
  environment = local.env
}
