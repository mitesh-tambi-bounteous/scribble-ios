output "bucket_name" {
  description = "Name of the private S3 origin bucket (deploy script `aws s3 sync` target)."
  value       = aws_s3_bucket.web.bucket
}

output "distribution_id" {
  description = "CloudFront distribution ID (used for cache invalidation on deploy)."
  value       = aws_cloudfront_distribution.web.id
}

output "distribution_domain_name" {
  description = "CloudFront-assigned *.cloudfront.net domain serving the web app."
  value       = aws_cloudfront_distribution.web.domain_name
}
