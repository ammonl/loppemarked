terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
      # CloudFront ACM certificates must live in us-east-1; the stable API
      # domain (api_domain.tf) requests its certificate through this alias.
      configuration_aliases = [aws.us_east_1]
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.0"
    }
  }
}

locals {
  naming_prefix = "${var.project}-${var.environment}-${var.season}"

  # Shared-tenancy mode: the API Lambda runs in the shared default VPC instead
  # of this stack's dedicated VPC. Toggled on by providing shared_vpc_id.
  shared_tenancy = var.shared_vpc_id != null

  # Peering into the shared-db VPC is only needed while the Lambda is in the
  # dedicated VPC. In shared-tenancy mode shared-db is reached VPC-locally.
  create_peering = var.shared_db_vpc_id != null && !local.shared_tenancy

  # Dedicated VPC interface endpoints (SES, Secrets Manager) exist only for the
  # dedicated-VPC Lambda; in shared-tenancy egress rides the shared NAT gateway.
  create_vpc_endpoints = !local.shared_tenancy && local.dedicated_active

  # Dedicated-infrastructure retirement. When true, this environment's dedicated
  # VPC (subnets, gateways, interface endpoints, flow logs), dedicated RDS
  # instance, dedicated DB credentials secret, and the data KMS key are no longer
  # created — the environment relies entirely on the shared VPC and shared-db.
  # Retirement is only valid once the Lambda is in the shared VPC and the runtime
  # is on shared-db (enforced by a precondition on the API Lambda).
  dedicated_active = !var.retire_dedicated_db_and_vpc
  dedicated_count  = var.retire_dedicated_db_and_vpc ? 0 : 1

  # The app-secrets secret is application-scoped, not DB-scoped, so it outlives the
  # dedicated DB. While the dedicated stack exists it shares the data KMS key (with
  # RDS and the DB credentials); once that key is retired the app secret rides the
  # logs KMS key, which is not part of the dedicated stack.
  app_secret_kms_key_arn = local.dedicated_active ? one(aws_kms_key.data[*].arn) : aws_kms_key.logs.arn

  # Identifier of the dedicated RDS instance, or null once retired. Used by the
  # RDS alarms (which are also gated on dedicated_active) and the dashboard.
  db_instance_identifier = one(aws_db_instance.main[*].identifier)
}

output "naming_prefix" {
  description = "Deterministic naming prefix for environment-scoped resources."
  value       = local.naming_prefix
}
