output "repository_url" {
  description = "URL of the API ECR repository (used as the image URI base)."
  value       = aws_ecr_repository.api.repository_url
}

output "repository_arn" {
  description = "ARN of the API ECR repository."
  value       = aws_ecr_repository.api.arn
}

output "repository_name" {
  description = "Name of the API ECR repository."
  value       = aws_ecr_repository.api.name
}
