# Bootstrap — creates the S3 + DynamoDB Terraform state backend.
# Uses LOCAL state by design (it provisions the remote backend the env roots use).
# Run once per account/region:
#   terraform -chdir=terraform/bootstrap init
#   terraform -chdir=terraform/bootstrap apply   # writes ../environments/{dev}/backend.hcl

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project   = var.project
      Component = "tf-backend"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id   = data.aws_caller_identity.current.account_id
  bucket_name  = "${var.project}-tfstate-${local.account_id}-${var.aws_region}"
  lock_table   = "${var.project}-tflock"
  environments = ["dev"]
}

resource "aws_s3_bucket" "tfstate" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "tfstate_tls_only" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.tfstate.arn, "${aws_s3_bucket.tfstate.arn}/*"]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  policy = data.aws_iam_policy_document.tfstate_tls_only.json
}

# State locking now uses S3-native locking (use_lockfile = true in the generated
# backend.hcl), supported since Terraform 1.11. This DynamoDB lock table is
# RETAINED (unused) to avoid a destructive change to bootstrap state; it can be
# removed in a later, deliberate apply.
resource "aws_dynamodb_table" "tflock" {
  name         = local.lock_table
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

# Generate each environment's partial-backend config. This POC ships DEV only;
# add more environments to local.environments to expand.
resource "local_file" "backend_hcl" {
  for_each = toset(local.environments)
  filename = "${path.module}/../environments/${each.key}/backend.hcl"
  content  = <<-EOT
    bucket       = "${local.bucket_name}"
    key          = "env/${each.key}/terraform.tfstate"
    region       = "${var.aws_region}"
    use_lockfile = true
    encrypt      = true
  EOT
}
