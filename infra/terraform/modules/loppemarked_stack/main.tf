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
  create_vpc_endpoints = !local.shared_tenancy
}

output "naming_prefix" {
  description = "Deterministic naming prefix for environment-scoped resources."
  value       = local.naming_prefix
}
