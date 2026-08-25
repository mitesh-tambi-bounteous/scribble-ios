locals {
  prefix = "${var.project}-${var.environment}"
}

# ---------------------------------------------------------------------------
# Scribl API — AWS App Runner service running our API container from ECR.
#
# App Runner needs two distinct roles:
#   - Access role  (build.apprunner.amazonaws.com) : lets App Runner PULL the
#     image from our private ECR repo. Attached to source_configuration.
#   - Instance role (tasks.apprunner.amazonaws.com): the running task's identity;
#     least-privilege — only reads the three app secrets from Secrets Manager.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# IAM — access role (ECR pull). Assumed by the App Runner build service.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "access_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "access" {
  name               = "${local.prefix}-api-access"
  assume_role_policy = data.aws_iam_policy_document.access_assume.json

  tags = {
    Component = "api"
  }
}

# AWS-managed policy granting the ECR pull permissions App Runner requires.
resource "aws_iam_role_policy_attachment" "access_ecr" {
  role       = aws_iam_role.access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# ---------------------------------------------------------------------------
# IAM — instance role (task identity). Assumed by the running App Runner task.
# Least-privilege: secretsmanager:GetSecretValue on ONLY the three passed ARNs.
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${local.prefix}-api-instance"
  assume_role_policy = data.aws_iam_policy_document.instance_assume.json

  tags = {
    Component = "api"
  }
}

data "aws_iam_policy_document" "instance" {
  statement {
    sid    = "ReadAppSecrets"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = [
      var.database_url_secret_arn,
      var.openai_api_key_secret_arn,
      var.anthropic_api_key_secret_arn,
    ]
  }
}

resource "aws_iam_role_policy" "instance_inline" {
  name   = "${local.prefix}-api-instance-policy"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

# ---------------------------------------------------------------------------
# App Runner service
# Argument/attribute names verified against hashicorp/aws provider docs for
# aws_apprunner_service (provider aws ~> 6.0):
#   source_configuration.authentication_configuration.access_role_arn
#   source_configuration.image_repository.image_configuration.
#     runtime_environment_variables / runtime_environment_secrets
#   instance_configuration.instance_role_arn
#   health_check_configuration.{protocol,path,interval,timeout,
#     healthy_threshold,unhealthy_threshold}
# ---------------------------------------------------------------------------

resource "aws_apprunner_service" "api" {
  service_name = "${local.prefix}-api"

  source_configuration {
    # CI drives image rollout explicitly; no auto-deploy on ECR push.
    auto_deployments_enabled = false

    authentication_configuration {
      access_role_arn = aws_iam_role.access.arn
    }

    image_repository {
      image_identifier      = "${var.ecr_repository_url}:${var.api_image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "8787"

        runtime_environment_variables = {
          SCRIBL_DATA_MODE = "postgres"
          # RDS is not localhost, so force the node `pg` driver; without this the
          # data layer would use the Neon HTTP driver and fail against RDS.
          SCRIBL_PG_DRIVER = "node"
          PORT             = "8787"
          # Live speech-to-text ONLY. The OPENAI_API_KEY secret below is seeded
          # out-of-band (never in Terraform code or state); this flag selects the
          # real Whisper adapter. Ordering invariant: the transcription factory
          # THROWS on STT_PROVIDER=cloud with no key, so the secret must be
          # seeded BEFORE this flips. Revert to "stub" to go back offline.
          STT_PROVIDER = "cloud"
          # Enhancement / vision / Claude stay stubbed — deliberately not enabled.
          IMAGE_PROVIDER  = "stub"
          CLAUDE_PROVIDER = "stub"
          ENHANCE_ENABLED = "0"
        }

        # Secret ARNs injected at runtime; the instance role authorizes the reads.
        runtime_environment_secrets = {
          DATABASE_URL      = var.database_url_secret_arn
          OPENAI_API_KEY    = var.openai_api_key_secret_arn
          ANTHROPIC_API_KEY = var.anthropic_api_key_secret_arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = "256"
    memory            = "512"
    instance_role_arn = aws_iam_role.instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  # Route the service's outbound traffic through the VPC connector so it can reach
  # the private DB. Omitted (default public egress) when no connector is provided.
  dynamic "network_configuration" {
    for_each = var.vpc_connector_arn == null ? [] : [1]
    content {
      egress_configuration {
        egress_type       = "VPC"
        vpc_connector_arn = var.vpc_connector_arn
      }
    }
  }

  tags = {
    Component = "api"
  }
}
