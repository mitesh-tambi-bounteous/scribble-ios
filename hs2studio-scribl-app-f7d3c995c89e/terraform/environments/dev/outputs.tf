output "api_service_url" {
  description = "Public HTTPS URL of the App Runner API service."
  value       = module.api.service_url
}

output "web_distribution_domain_name" {
  description = "CloudFront domain serving the Expo web app."
  value       = module.web.distribution_domain_name
}

output "web_bucket_name" {
  description = "S3 origin bucket for the web export (aws s3 sync target)."
  value       = module.web.bucket_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for the API image."
  value       = module.ecr.repository_url
}

output "db_endpoint" {
  description = "host:port of the RDS PostgreSQL instance."
  value       = module.db.endpoint
}

output "database_url" {
  description = "Full DATABASE_URL for the RDS instance (for local db:bootstrap / db:prompts seeding)."
  value       = module.db.database_url
  sensitive   = true
}

output "account_id" {
  description = "AWS account this environment is deployed into."
  value       = data.aws_caller_identity.current.account_id
}

output "region" {
  description = "Primary AWS region."
  value       = data.aws_region.current.region
}
