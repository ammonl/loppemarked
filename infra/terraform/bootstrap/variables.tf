variable "aws_region" {
  description = "AWS region for the state backend resources."
  type        = string
  default     = "eu-north-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform remote state."
  type        = string
  default     = "loppemarked-2026-tfstate"
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking."
  type        = string
  default     = "loppemarked-2026-tflock"
}

variable "github_repo" {
  description = "GitHub repository in owner/name format for OIDC trust on the per-environment ci-terraform roles."
  type        = string
  default     = "ammonl/loppemarked"
}

variable "ci_terraform_environments" {
  description = <<-EOT
    Per-environment configuration for the CI Terraform roles created in
    bootstrap. Keys are short environment identifiers used in resource
    naming (must match the `environment` input passed to the
    loppemarked_stack module). Each value supplies the GitHub Actions
    environment name used in the OIDC `sub` claim and a naming prefix
    used for ARN scoping in the role's policy. Defining the roles here
    (rather than in the per-environment stack) breaks the IAM
    propagation race that occurs when the role grants itself a new
    permission and immediately tries to use it.
  EOT
  type = map(object({
    github_environment = string
    naming_prefix      = string
  }))
  default = {
    staging = {
      github_environment = "staging"
      naming_prefix      = "loppemarked-staging-2026"
    }
    prod = {
      github_environment = "production"
      naming_prefix      = "loppemarked-prod-2026"
    }
  }
}
