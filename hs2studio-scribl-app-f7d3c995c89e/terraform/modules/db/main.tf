locals {
  prefix = "${var.project}-${var.environment}"
}

# ---------------------------------------------------------------------------
# Scribl POC database — a small, publicly-reachable RDS PostgreSQL instance in
# a dedicated, self-contained VPC.
#
# The account has no default VPC, and the only existing VPCs belong to other
# stacks (partner-pathfinder, a shared sandbox) that this throwaway POC must not
# squat in. So this module stands up its own minimal VPC (2 public subnets + IGW)
# purely to host RDS — trivial to destroy with the DB.
#
# POC-scoped choices (flagged in the handoff):
#   - publicly_accessible = true and the SG admits 5432 from 0.0.0.0/0. App Runner
#     egress has no static IP without a VPC connector, so the source cannot be
#     narrowed. Acceptable for a throwaway POC ONLY.
#   - The master password is Terraform-generated and therefore lives in state
#     (encrypted S3). Unavoidable with aws_db_instance.
# ---------------------------------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "this" {
  cidr_block           = "10.90.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true # required for the public RDS endpoint DNS to resolve

  tags = {
    Name      = "${local.prefix}-db"
    Component = "db"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name      = "${local.prefix}-db"
    Component = "db"
  }
}

# Two public subnets across the first two AZs — RDS requires a subnet group
# spanning ≥2 AZs even for a single-AZ instance.
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = "10.90.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name      = "${local.prefix}-db-public-${count.index}"
    Component = "db"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = {
    Name      = "${local.prefix}-db-public"
    Component = "db"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Outbound internet path for the App Runner service.
#
# The service routes ALL egress through the VPC connector so it can reach the
# private RDS instance. App Runner connector ENIs never receive public IPs, so
# a public subnet + IGW gives them no internet at all — live STT (OpenAI) fails
# with "fetch failed". Fix: put the connector in private subnets that default-
# route to a NAT gateway in a public subnet. RDS stays private and its subnet
# group is deliberately untouched (moving it would replace the instance).
# ---------------------------------------------------------------------------

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.this.id
  cidr_block        = "10.90.${count.index + 11}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name      = "${local.prefix}-db-private-${count.index}"
    Component = "db"
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name      = "${local.prefix}-nat"
    Component = "db"
  }
}

# Single NAT gateway (one AZ). A per-AZ NAT would be the HA choice; this POC
# accepts the single point of failure to halve the hourly cost.
resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  depends_on = [aws_internet_gateway.this]

  tags = {
    Name      = "${local.prefix}-nat"
    Component = "db"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }

  tags = {
    Name      = "${local.prefix}-db-private"
    Component = "db"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.prefix}-db"
  subnet_ids = aws_subnet.public[*].id

  tags = {
    Component = "db"
  }
}

# Security group for the App Runner VPC connector's ENIs. It only needs egress;
# the DB SG admits Postgres traffic from this SG specifically.
resource "aws_security_group" "apprunner" {
  name        = "${local.prefix}-apprunner"
  description = "Scribl POC App Runner VPC connector egress."
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Component = "db"
  }
}

# SG for the NAT-routed connector's ENIs. App Runner rejects a second connector
# whose security-group set matches an existing one, so the replacement connector
# needs its own SG rather than reusing aws_security_group.apprunner. Same posture:
# egress only, NO ingress rules at all.
resource "aws_security_group" "apprunner_nat" {
  name        = "${local.prefix}-apprunner-nat"
  description = "Scribl POC App Runner VPC connector egress (NAT-routed private subnets)."
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Component = "db"
  }
}

# DB is reachable ONLY from the App Runner connector SG (no public ingress). The
# instance is not publicly_accessible, so it has no internet-facing endpoint at all.
# NOTE: the description string is intentionally left as-created — SG descriptions are
# immutable, so editing it forces a replacement that can't detach the RDS-managed ENI.
resource "aws_security_group" "db" {
  name        = "${local.prefix}-db"
  description = "Scribl POC Postgres access (POC: open 5432 - App Runner egress has no static IP)."
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "PostgreSQL from the App Runner VPC connectors only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.apprunner.id, aws_security_group.apprunner_nat.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Component = "db"
  }
}

# App Runner reaches the private DB over this connector, and reaches the
# internet (live STT) via the NAT gateway the private subnets route to.
# (ECR image pulls and Secrets Manager injection happen on the App
# Runner-managed side, not via the connector.)
#
# Connector subnets are immutable, so moving public -> private REPLACES this
# resource. create_before_destroy (plus the -nat name) stands the new connector
# up and repoints the service before the old one is torn down, so the service
# is never left referencing a deleted connector.
resource "aws_apprunner_vpc_connector" "this" {
  vpc_connector_name = "${local.prefix}-db-nat"
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.apprunner_nat.id]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Component = "db"
  }
}

# Alphanumeric only (special = false) so the value drops straight into a URL
# with no percent-encoding.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_instance" "this" {
  identifier     = "${local.prefix}-db"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = var.publicly_accessible

  # POC lifecycle: no HA, no backups, destroyable without a final snapshot.
  multi_az                = false
  backup_retention_period = 0
  skip_final_snapshot     = true
  deletion_protection     = false
  apply_immediately       = true

  tags = {
    Component = "db"
  }
}
