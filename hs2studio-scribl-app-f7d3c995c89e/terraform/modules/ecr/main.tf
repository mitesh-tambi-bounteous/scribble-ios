locals {
  prefix = "${var.project}-${var.environment}"
}

# Container registry for the Scribl API image. Fixed repo name (not prefixed) so
# the image URI is stable across environments; MUTABLE tags let CI overwrite a
# rolling tag (e.g. :latest) while scan_on_push flags CVEs on every push.
resource "aws_ecr_repository" "api" {
  name                 = "scribl-poc/api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Component = "ecr"
  }
}

# Keep only the last 10 images to cap storage cost; older untagged/tagged images
# are expired oldest-first.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
