# Connection string consumed by the backend (postgres-client / bootstrap / prompts).
# sslmode=no-verify: RDS forces TLS by default and the pg client sets no ssl option
# of its own (TLS is URL-driven), so we enable TLS but skip cert verification rather
# than bundling the RDS CA — POC-appropriate.
output "database_url" {
  description = "Full DATABASE_URL for the RDS instance (fed into the database-url secret)."
  value       = "postgres://${var.db_username}:${random_password.db.result}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}?sslmode=no-verify"
  sensitive   = true
}

output "endpoint" {
  description = "host:port of the RDS instance."
  value       = aws_db_instance.this.endpoint
}

output "security_group_id" {
  description = "Security group guarding the RDS instance."
  value       = aws_security_group.db.id
}

output "vpc_connector_arn" {
  description = "App Runner VPC connector ARN — attach to the API service so it reaches the private DB."
  value       = aws_apprunner_vpc_connector.this.arn
}
