locals {
  prefix = "${var.project}-${var.environment}"

  # Logical name -> Secrets Manager secret name. Terraform manages only the secret
  # CONTAINER and a PLACEHOLDER version; real values are seeded out-of-band (console
  # / installer) and NEVER live in Terraform, tfvars, code, or logs. lifecycle
  # ignore_changes below stops a later manual credential update being reverted on
  # the next apply.
  secrets = {
    database_url      = "${local.prefix}/database-url"
    openai_api_key    = "${local.prefix}/openai-api-key"
    anthropic_api_key = "${local.prefix}/anthropic-api-key"
  }
}

resource "aws_secretsmanager_secret" "this" {
  for_each = local.secrets

  name        = each.value
  description = "Scribl POC ${each.key} credential. Value seeded out-of-band."

  tags = {
    Component = "secrets"
  }
}

resource "aws_secretsmanager_secret_version" "this" {
  for_each = local.secrets

  secret_id     = aws_secretsmanager_secret.this[each.key].id
  secret_string = each.key == "database_url" ? var.database_url_value : "PLACEHOLDER"

  lifecycle {
    # Never revert a manually-seeded real value on the next apply.
    ignore_changes = [secret_string]
  }
}
