output "service_url" {
  description = "Public HTTPS URL of the App Runner API service."
  value       = "https://${aws_apprunner_service.api.service_url}"
}

output "service_arn" {
  description = "ARN of the App Runner API service."
  value       = aws_apprunner_service.api.arn
}

output "service_id" {
  description = "ID of the App Runner API service."
  value       = aws_apprunner_service.api.service_id
}
