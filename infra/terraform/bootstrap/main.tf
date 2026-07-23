terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  # State for the bootstrap stack itself lives in the bucket bootstrap
  # creates. Initial provisioning uses local state; once the bucket and
  # lock table exist, run `terraform init -migrate-state` to move it
  # here. CI drift detection assumes this remote backend so it can read
  # state without operator credentials.
  backend "s3" {
    bucket         = "loppemarked-2026-tfstate"
    key            = "bootstrap/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "loppemarked-2026-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project    = "loppemarked"
      season     = "2026"
      managed_by = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# ---------- S3 bucket for Terraform state ----------

resource "aws_s3_bucket" "tfstate" {
  bucket = var.state_bucket_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }

  # The AWS provider's refresh of this resource serializes
  # `blocked_encryption_types` differently than apply does: the bucket
  # is created with the field unset (which AWS surfaces as `["SSE-C"]`
  # via GetBucketEncryption), so every refresh-only plan reports a
  # full rule-replace diff. The remote configuration is unchanged.
  # Ignoring the entire rule is acceptable here — its contents are two
  # trivial fields that get re-applied from this config on any real
  # operator run, and the attributes that change rarely (sse_algorithm,
  # bucket_key_enabled) are still owned by terraform on apply.
  lifecycle {
    ignore_changes = [rule]
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------- DynamoDB table for state locking ----------

resource "aws_dynamodb_table" "tflock" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    purpose = "terraform-state-lock"
  }
}

# ---------- GitHub Actions OIDC Provider ----------

# The account-global GitHub OIDC provider
# (token.actions.githubusercontent.com) is owned and managed by the
# un17hub bootstrap. There is exactly one such provider per AWS account,
# so loppemarked consumes it via a data source rather than managing it —
# managing it here would perpetually fight un17hub over the shared
# resource's tags and thumbprint. This mirrors the pattern the
# environment stacks already use.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# This bootstrap previously managed the provider as a resource, so the
# object still lives in loppemarked's bootstrap state. Dropping the
# resource block alone would make the next apply plan a DESTROY of the
# shared, account-global provider. This `removed` block detaches it from
# state without destroying it — the declarative equivalent of
# `terraform state rm` — so the shared provider un17hub owns is left
# intact. Safe to delete once every bootstrap state has been applied
# past this change.
removed {
  from = aws_iam_openid_connect_provider.github

  lifecycle {
    destroy = false
  }
}
