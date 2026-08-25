locals {
  prefix = "${var.project}-${var.environment}"

  # AWS managed cache policy "CachingOptimized" — long TTLs, gzip/brotli, no
  # cookie/header/query forwarding. Ideal for immutable Expo static web assets.
  cache_policy_caching_optimized = "658327ea-f89d-4fab-a63d-7e88639e58f6"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ---------------------------------------------------------------------------
# Private origin bucket for the Expo static web export.
#
# NOTE: the environment is intentionally DROPPED from the bucket name here.
# S3 bucket names are globally unique; account_id + region already guarantee
# uniqueness and keep the name short. Objects are uploaded OUT OF BAND by the
# deploy script (`aws s3 sync`) — Terraform never manages bucket objects.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "web" {
  bucket = "${var.project}-web-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.region}"

  tags = {
    Component = "web"
  }
}

# Keep a version history of the static export so a bad deploy can be rolled back.
resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Public static assets — SSE-S3 (AES256) is sufficient; no KMS needed.
resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# The bucket is private; the ONLY reader is CloudFront via OAC. Block all
# public access so nothing is ever served directly from S3.
resource "aws_s3_bucket_public_access_block" "web" {
  bucket                  = aws_s3_bucket.web.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------------------------------------------------------------------
# CloudFront Origin Access Control (OAC) — the modern replacement for OAI.
# CloudFront signs origin requests with SigV4 so the private bucket can trust
# them via the SourceArn condition on the bucket policy below.
# ---------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.prefix}-web-oac"
  description                       = "OAC for ${local.prefix} web origin bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---------------------------------------------------------------------------
# CloudFront distribution fronting the private S3 origin.
#
# 403/404 -> 200 /index.html: SPA / expo-router deep-link fallback so client
# routes resolve to the app shell instead of an S3/CloudFront error page.
# ---------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "${local.prefix} Expo web export"

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = local.cache_policy_caching_optimized
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Component = "web"
  }
}

# ---------------------------------------------------------------------------
# Bucket policy — grant ONLY the CloudFront service principal s3:GetObject,
# scoped to THIS distribution via the AWS:SourceArn condition (OAC pattern).
# No other principal can read the private origin.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "web" {
  statement {
    sid       = "AllowCloudFrontServiceGetObject"
    effect    = "Allow"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.web.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.web.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.web.json
}
