terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  backend "s3" {
    bucket         = "loppemarked-2026-tfstate"
    key            = "dns/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "loppemarked-2026-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = "eu-north-1"

  default_tags {
    tags = {
      project    = "loppemarked"
      season     = "2026"
      scope      = "dns"
      managed_by = "terraform"
    }
  }
}

# ---------- Hosted zones ----------
#
# These zones are the single source of truth for their DNS names. Per-env
# stacks read the zone IDs from this stack's remote state and write records
# into them; they do not create zones of their own.

resource "aws_route53_zone" "root" {
  name = var.root_domain

  tags = {
    Name = "loppemarked-root-zone"
  }
}

resource "aws_route53_zone" "staging" {
  name = var.staging_domain

  tags = {
    Name = "loppemarked-staging-zone"
  }
}

# ---------- Subdomain delegation ----------
#
# Delegate staging.<root_domain> from the apex zone to the staging zone's
# nameservers so resolvers that reach the root zone for a staging record are
# referred to the staging zone.

resource "aws_route53_record" "staging_ns" {
  zone_id = aws_route53_zone.root.zone_id
  name    = var.staging_domain
  type    = "NS"
  ttl     = var.staging_ns_ttl
  records = aws_route53_zone.staging.name_servers
}
