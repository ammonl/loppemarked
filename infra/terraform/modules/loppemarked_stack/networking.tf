# ---------- Shared-VPC Lambda Security Group ----------
#
# The API Lambda attaches to the shared default VPC (owned by un17-infra-shared).
# Security groups are VPC-scoped, so this environment gets its own egress-only
# group in the shared VPC. Ingress to shared-db is authorized on the shared RDS
# security group (owned by un17-infra-shared), which already admits the
# default-VPC CIDR; egress here just needs to reach shared-db, Secrets Manager,
# and SES via the shared NAT.
#
# The dedicated per-environment VPC (subnets, gateways, interface endpoints,
# flow logs) and the shared-db peering were retired in #222; the shared VPC is
# now the only network the Lambda runs in.

resource "aws_security_group" "lambda_shared" {
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
  security_group_id = aws_security_group.lambda_shared.id
  description       = "Allow all outbound traffic"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# The shared-VPC group and its egress rule were previously count-gated on
# shared-tenancy mode (single [0] instance). Now that the dedicated VPC is gone
# they are always created; the moved blocks migrate their state address off the
# [0] index so the retirement apply is a clean no-op for them instead of a
# destroy-and-recreate.

moved {
  from = aws_security_group.lambda_shared[0]
  to   = aws_security_group.lambda_shared
}

moved {
  from = aws_vpc_security_group_egress_rule.lambda_shared_all_outbound[0]
  to   = aws_vpc_security_group_egress_rule.lambda_shared_all_outbound
}
