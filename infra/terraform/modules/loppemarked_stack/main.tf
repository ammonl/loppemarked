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
}

output "naming_prefix" {
  description = "Deterministic naming prefix for environment-scoped resources."
  value       = local.naming_prefix
}
