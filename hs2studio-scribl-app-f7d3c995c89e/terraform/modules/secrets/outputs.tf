output "database_url_secret_arn" {
  description = "ARN of the database-url secret."
  value       = aws_secretsmanager_secret.this["database_url"].arn
}

output "openai_api_key_secret_arn" {
  description = "ARN of the openai-api-key secret."
  value       = aws_secretsmanager_secret.this["openai_api_key"].arn
}

output "anthropic_api_key_secret_arn" {
  description = "ARN of the anthropic-api-key secret."
  value       = aws_secretsmanager_secret.this["anthropic_api_key"].arn
}
