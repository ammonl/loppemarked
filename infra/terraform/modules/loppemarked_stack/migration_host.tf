# ---------- Prod shared-db migration host (temporary) ----------
#
# A short-lived execution path for PostgreSQL client tools (psql, pg_dump,
# pg_restore) with network reachability to BOTH databases involved in the prod
# shared-db migration: the dedicated prod RDS (this VPC) and the shared-db prod
# RDS (reached over the requester-side peering route in peering.tf).
#
# The host lives in a private subnet with no public IP and no inbound rules; it
# is reached exclusively through SSM Session Manager. Private subnets have no
# NAT, so SSM connectivity and package installation are provided by VPC
# endpoints: interface endpoints for ssm/ssmmessages/ec2messages (Session
# Manager) and a gateway endpoint for S3 (the AL2023 dnf repos are S3-backed).
#
# Everything here is gated on `var.enable_db_migration_host` (default false) so
# the host exists only during the migration window. Tearing it down is a matter
# of setting the flag back to false and applying — see
# docs/runbooks/prod-shared-db-migration-host.md.

locals {
  migration_host_count = var.enable_db_migration_host ? 1 : 0
}

# Latest Amazon Linux 2023 AMI (arm64; matches the t4g default instance type).
# AL2023 ships the SSM agent preinstalled and `postgresql16` in its default
# repos, so no internet egress is required to provision the host.
data "aws_ssm_parameter" "migration_host_ami" {
  count = local.migration_host_count

  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

# ---------- Security group (egress-only) ----------

resource "aws_security_group" "migration_host" {
  count = local.migration_host_count

  name_prefix = "${local.naming_prefix}-migration-"
  description = "Temporary prod shared-db migration host (SSM-only, no inbound)"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.naming_prefix}-migration-host-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Egress is scoped to the two protocols the host actually needs: 5432 to reach
# the dedicated DB and the shared-db over peering, and 443 for the SSM/S3
# endpoints and Secrets Manager. (DNS to the Amazon resolver is not subject to
# security-group filtering.) With no internet route, egress only resolves to what
# the route tables permit anyway.
resource "aws_vpc_security_group_egress_rule" "migration_host_postgres" {
  count = local.migration_host_count

  security_group_id = aws_security_group.migration_host[0].id
  description       = "PostgreSQL to the dedicated and shared-db RDS instances"
  ip_protocol       = "tcp"
  from_port         = 5432
  to_port           = 5432
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "migration_host_https" {
  count = local.migration_host_count

  security_group_id = aws_security_group.migration_host[0].id
  description       = "HTTPS to SSM/S3/Secrets Manager VPC endpoints"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

# ---------- Dedicated-DB ingress from the host ----------

resource "aws_vpc_security_group_ingress_rule" "db_from_migration_host" {
  count = local.migration_host_count

  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from the migration host"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.migration_host[0].id
}

# ---------- VPC endpoints for SSM + package install ----------
#
# The migration host reaches the shared VPC-endpoint SG (which already fronts the
# SES + Secrets Manager interface endpoints) so the operator can pull the DB
# password via `aws secretsmanager get-secret-value` from the box.
resource "aws_vpc_security_group_ingress_rule" "vpc_endpoints_from_migration_host" {
  count = local.migration_host_count

  security_group_id            = aws_security_group.vpc_endpoints.id
  description                  = "HTTPS from the migration host"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.migration_host[0].id
}

# Session Manager requires these three interface endpoints to reach the host in a
# private subnet with no internet route.
resource "aws_vpc_endpoint" "ssm" {
  for_each = var.enable_db_migration_host ? toset(["ssm", "ssmmessages", "ec2messages"]) : toset([])

  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.id}.${each.key}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name = "${local.naming_prefix}-${each.key}-endpoint"
  }
}

# Gateway endpoint for S3: dnf pulls postgresql16 from the regional AL2023 repos,
# which are S3-backed. Gateway endpoints are free and attach to the route table.
resource "aws_vpc_endpoint" "s3" {
  count = local.migration_host_count

  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.id}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]

  tags = {
    Name = "${local.naming_prefix}-s3-endpoint"
  }
}

# ---------- Instance role / profile ----------

data "aws_iam_policy_document" "migration_host_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "migration_host" {
  count = local.migration_host_count

  name               = "${local.naming_prefix}-migration-host"
  assume_role_policy = data.aws_iam_policy_document.migration_host_assume.json

  tags = {
    Name = "${local.naming_prefix}-migration-host"
  }
}

resource "aws_iam_role_policy_attachment" "migration_host_ssm" {
  count = local.migration_host_count

  role       = aws_iam_role.migration_host[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Read access to the credentials needed for the move: the dedicated DB secret
# (naming-prefix scoped) and this project's shared-db secret when wired. Scoped
# to specific name prefixes only (the trailing -* matches Secrets Manager's
# random ARN suffix); never the shared-db master secret, never another project's.
data "aws_iam_policy_document" "migration_host_secrets" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    resources = concat(
      [
        "arn:aws:secretsmanager:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:secret:${local.naming_prefix}-*",
      ],
      var.db_secret_id != null ? [
        "arn:aws:secretsmanager:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:secret:${var.db_secret_id}-*",
      ] : []
    )
  }

  statement {
    effect = "Allow"
    actions = [
      "kms:Decrypt",
    ]
    resources = [
      aws_kms_key.data.arn,
    ]
  }
}

resource "aws_iam_role_policy" "migration_host_secrets" {
  count = local.migration_host_count

  name   = "secrets-read"
  role   = aws_iam_role.migration_host[0].id
  policy = data.aws_iam_policy_document.migration_host_secrets.json
}

resource "aws_iam_instance_profile" "migration_host" {
  count = local.migration_host_count

  name = "${local.naming_prefix}-migration-host"
  role = aws_iam_role.migration_host[0].name

  tags = {
    Name = "${local.naming_prefix}-migration-host"
  }
}

# ---------- Instance ----------

resource "aws_instance" "migration_host" {
  count = local.migration_host_count

  ami           = data.aws_ssm_parameter.migration_host_ami[0].value
  instance_type = var.db_migration_host_instance_type

  subnet_id                   = aws_subnet.private[0].id
  vpc_security_group_ids      = [aws_security_group.migration_host[0].id]
  iam_instance_profile        = aws_iam_instance_profile.migration_host[0].name
  associate_public_ip_address = false

  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    dnf install -y postgresql16
  EOT

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.db_migration_host_volume_size
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "${local.naming_prefix}-migration-host"
  }
}
