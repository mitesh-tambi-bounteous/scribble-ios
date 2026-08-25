# Single primary-region provider. No us-east-1 alias — this POC has no
# us-east-1-only services (CloudFront uses its default certificate).
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = local.default_tags
  }
}
