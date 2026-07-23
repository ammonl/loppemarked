# ---------- VPC ----------
#
# The dedicated per-environment VPC (and everything in it) is created only while
# `local.dedicated_active`. Once an environment is fully on the shared VPC and
# shared-db, `retire_dedicated_db_and_vpc` drops the whole dedicated network.

resource "aws_vpc" "main" {
  count = local.dedicated_count

  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.naming_prefix}-vpc"
  }
}

# Always-present indirection for VPC-replacement triggers. `replace_triggered_by`
# on an un-gated resource (the API Lambda) cannot point at the count-gated
# aws_vpc.main: once the VPC is retired (count 0, gone from state) every later plan
# errors "no change found for aws_vpc.main". This resource carries the VPC id (null
# when retired) and is what the dedicated RDS instance, DB subnet group, and API
# Lambda trigger their replacement on — so a dedicated-VPC re-IP still forces those
# replacements, and retirement resolves cleanly.
resource "terraform_data" "vpc_identity" {
  triggers_replace = one(aws_vpc.main[*].id)
}

# ---------- Internet Gateway ----------

resource "aws_internet_gateway" "main" {
  count = local.dedicated_count

  vpc_id = aws_vpc.main[0].id

  tags = {
    Name = "${local.naming_prefix}-igw"
  }
}

# ---------- Public Subnets ----------

resource "aws_subnet" "public" {
  count = local.dedicated_active ? length(var.public_subnet_cidrs) : 0

  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.naming_prefix}-public-${var.availability_zones[count.index]}"
  }
}

resource "aws_route_table" "public" {
  count = local.dedicated_count

  vpc_id = aws_vpc.main[0].id

  tags = {
    Name = "${local.naming_prefix}-public-rt"
  }
}

resource "aws_route" "public_internet" {
  count = local.dedicated_count

  route_table_id         = aws_route_table.public[0].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main[0].id
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

# ---------- Private Subnets ----------
#
# Private subnets have no default route to the internet. The Lambda's
# only external dependencies are AWS SES (outbound email) and AWS
# Secrets Manager (DB password lookup at cold start), both reached via
# VPC interface endpoints declared below.

resource "aws_subnet" "private" {
  count = local.dedicated_active ? length(var.private_subnet_cidrs) : 0

  vpc_id            = aws_vpc.main[0].id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${local.naming_prefix}-private-${var.availability_zones[count.index]}"
  }
}

resource "aws_route_table" "private" {
  count = local.dedicated_count

  vpc_id = aws_vpc.main[0].id

  tags = {
    Name = "${local.naming_prefix}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

# ---------- Security Groups ----------

resource "aws_security_group" "api" {
  count = local.dedicated_count

  name_prefix = "${local.naming_prefix}-api-"
  description = "Security group for API Lambda functions"
  vpc_id      = aws_vpc.main[0].id

  tags = {
    Name = "${local.naming_prefix}-api-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_egress_rule" "api_all_outbound" {
  count = local.dedicated_count

  security_group_id = aws_security_group.api[0].id
  description       = "Allow all outbound traffic"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ---------- Shared-VPC Lambda Security Group ----------
#
# In shared-tenancy mode the API Lambda attaches to the shared default VPC.
# Security groups are VPC-scoped, so the dedicated `api` group above cannot
# follow — this environment gets its own egress-only group in the shared VPC.
# Ingress to shared-db is authorized on the shared RDS security group (owned by
# infra-shared-db), which already admits the default-VPC CIDR; egress here just
# needs to reach shared-db, Secrets Manager, and SES via the shared NAT.

resource "aws_security_group" "lambda_shared" {
  count = local.shared_tenancy ? 1 : 0

  name_prefix = "${local.naming_prefix}-lambda-shared-"
  description = "Egress-only security group for the API Lambda in the shared VPC"
  vpc_id      = var.shared_vpc_id

  tags = {
    Name = "${local.naming_prefix}-lambda-shared-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_egress_rule" "lambda_shared_all_outbound" {
  count = local.shared_tenancy ? 1 : 0

  security_group_id = aws_security_group.lambda_shared[0].id
  description       = "Allow all outbound traffic"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_security_group" "db" {
  count = local.dedicated_count

  name_prefix = "${local.naming_prefix}-db-"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main[0].id

  tags = {
    Name = "${local.naming_prefix}-db-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_api" {
  count = local.dedicated_count

  security_group_id            = aws_security_group.db[0].id
  description                  = "PostgreSQL from API security group"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.api[0].id
}

# ---------- VPC Interface Endpoints ----------
#
# The dedicated-VPC API Lambda's only outbound dependencies are SES (email
# send) and Secrets Manager (DB password retrieval at cold start). Both are
# reached through interface endpoints in lieu of a NAT gateway. KMS is
# not required: the Secrets Manager secret uses a CMK, but the
# decryption happens server-side inside Secrets Manager, not from the
# Lambda. CloudWatch Logs traffic from a VPC Lambda flows over the
# Lambda service network and bypasses the customer VPC entirely.
#
# In shared-tenancy mode the Lambda leaves this VPC and egress rides the shared
# NAT gateway, so these endpoints are not created (see local.create_vpc_endpoints).

resource "aws_security_group" "vpc_endpoints" {
  count = local.create_vpc_endpoints ? 1 : 0

  name_prefix = "${local.naming_prefix}-vpce-"
  description = "Security group for VPC interface endpoints"
  vpc_id      = aws_vpc.main[0].id

  tags = {
    Name = "${local.naming_prefix}-vpce-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "vpc_endpoints_from_api" {
  count = local.create_vpc_endpoints ? 1 : 0

  security_group_id            = aws_security_group.vpc_endpoints[0].id
  description                  = "HTTPS from API security group"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.api[0].id
}

resource "aws_vpc_endpoint" "ses" {
  count = local.create_vpc_endpoints ? 1 : 0

  vpc_id              = aws_vpc.main[0].id
  service_name        = "com.amazonaws.${data.aws_region.current.id}.email"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name = "${local.naming_prefix}-ses-endpoint"
  }
}

resource "aws_vpc_endpoint" "secretsmanager" {
  count = local.create_vpc_endpoints ? 1 : 0

  vpc_id              = aws_vpc.main[0].id
  service_name        = "com.amazonaws.${data.aws_region.current.id}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name = "${local.naming_prefix}-secretsmanager-endpoint"
  }
}

# These four resources previously had no count. Gating them moves their state
# address to the [0] index; the moved blocks make an environment that keeps the
# endpoints (dedicated mode, e.g. prod today) a clean no-op instead of a
# destroy-and-recreate. When create_vpc_endpoints is false (shared-tenancy) the
# renamed [0] instances are then destroyed, which is the intended teardown.

moved {
  from = aws_security_group.vpc_endpoints
  to   = aws_security_group.vpc_endpoints[0]
}

moved {
  from = aws_vpc_security_group_ingress_rule.vpc_endpoints_from_api
  to   = aws_vpc_security_group_ingress_rule.vpc_endpoints_from_api[0]
}

moved {
  from = aws_vpc_endpoint.ses
  to   = aws_vpc_endpoint.ses[0]
}

moved {
  from = aws_vpc_endpoint.secretsmanager
  to   = aws_vpc_endpoint.secretsmanager[0]
}
