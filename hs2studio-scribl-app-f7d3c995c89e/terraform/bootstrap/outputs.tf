output "state_bucket" {
  description = "Name of the S3 bucket holding remote Terraform state."
  value       = aws_s3_bucket.tfstate.id
}

output "lock_table" {
  description = "Name of the DynamoDB state-lock table."
  value       = aws_dynamodb_table.tflock.name
}

output "backend_hcl_files" {
  description = "Generated per-environment backend config files."
  value       = [for f in local_file.backend_hcl : f.filename]
}
