variable "project" {
  description = "Project tag and naming prefix."
  type        = string
  default     = "loppemarked"
}

variable "season" {
  description = "Season tag."
  type        = string
  default     = "2026"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
}

# ---------- Shared-VPC tenancy ----------
#
# The API Lambda runs inside the shared default VPC (owned by infra-shared-db).
# It attaches to the published private egress subnets and reaches shared-db,
# Secrets Manager, and SES over the shared NAT gateway. The dedicated
# per-environment VPCs and RDS instances were retired in #222; the shared VPC is
# now the only network the Lambda runs in, so both inputs are required.

variable "shared_vpc_id" {
  description = "VPC id of the shared default VPC to run the API Lambda in (published as /shared/network/vpc-id)."
  type        = string

  validation {
    condition     = can(regex("^vpc-[0-9a-f]+$", var.shared_vpc_id))
    error_message = "shared_vpc_id must be a valid VPC id (vpc-...)."
  }
}

variable "shared_private_subnet_ids" {
  description = "Private egress subnet ids in the shared VPC for the API Lambda (published as /shared/network/private-subnet-ids)."
  type        = list(string)

  validation {
    condition     = length(var.shared_private_subnet_ids) > 0 && alltrue([for id in var.shared_private_subnet_ids : can(regex("^subnet-[0-9a-f]+$", id))])
    error_message = "shared_private_subnet_ids must be non-empty and all valid subnet ids (subnet-...)."
  }
}

# ---------- Shared DB ----------
#
# The API runtime builds its DB connection entirely from this shared-db
# credentials secret (host, port, database, username, password), owned by
# infra-shared-db. It is the only DB source now that the dedicated RDS instances
# are retired.

variable "db_secret_id" {
  description = "Secrets Manager id/name of the shared-db credentials secret (e.g. rds/shared/loppemarked_staging). The API runtime builds its DB connection from this secret."
  type        = string

  validation {
    condition     = length(var.db_secret_id) > 0
    error_message = "db_secret_id must be a non-empty Secrets Manager id/name."
  }
}

# ---------- IAM / CI ----------

variable "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC identity provider created by the bootstrap stack."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:oidc-provider/", var.github_oidc_provider_arn))
    error_message = "github_oidc_provider_arn must be a valid IAM OIDC provider ARN (arn:aws:iam::<account>:oidc-provider/...)."
  }
}

variable "github_repo" {
  description = "GitHub repository in owner/name format for OIDC trust."
  type        = string
  default     = "ammonl/loppemarked"
}

variable "github_environment" {
  description = "GitHub Actions environment name for OIDC trust (may differ from var.environment). Defaults to var.environment."
  type        = string
  default     = null
}

variable "ses_sender_domain" {
  description = "Domain name for SES sender identity and Route 53 hosted zone."
  type        = string

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", var.ses_sender_domain))
    error_message = "ses_sender_domain must be a valid domain name (e.g. example.com)."
  }
}

variable "ses_sender_email" {
  description = "Default From address for outbound email. Defaults to loppemarked@<ses_sender_domain>."
  type        = string
  default     = null
}

variable "ses_reply_to_email" {
  description = "Default Reply-To address for outbound email."
  type        = string
  default     = "ammonl@hotmail.com"
}

# ---------- Amplify ----------

variable "amplify_repository" {
  description = "GitHub repository URL the Amplify app builds from. The GitHub connection token is established out-of-band (kept out of Terraform); this only asserts the URL so prod and staging cannot drift onto different repos."
  type        = string
  default     = "https://github.com/ammonl/loppemarked"

  validation {
    condition     = can(regex("^https://github\\.com/[^/]+/[^/]+$", var.amplify_repository))
    error_message = "amplify_repository must be a GitHub repository URL (https://github.com/<owner>/<repo>)."
  }
}

variable "amplify_branch_name" {
  description = "Git branch name for Amplify to build and deploy."
  type        = string
  default     = "main"
}

variable "amplify_enable_auto_build" {
  description = "Enable automatic builds on push to the configured branch."
  type        = bool
  default     = true
}

variable "amplify_enable_preview_branches" {
  description = "Enable automatic branch creation for preview environments on feature branch PRs."
  type        = bool
  default     = false
}

variable "amplify_preview_branch_patterns" {
  description = "Glob patterns for branches that trigger automatic preview environments."
  type        = list(string)
  default     = ["feature/**", "fix/**"]
}

variable "amplify_domain_prefix" {
  description = "Subdomain prefix for the Amplify custom domain (e.g. 'loppemarked' → loppemarked.<domain>)."
  type        = string
  default     = "loppemarked"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", var.amplify_domain_prefix))
    error_message = "amplify_domain_prefix must be a valid subdomain label."
  }
}

variable "amplify_enable_custom_domain" {
  description = "Whether to attach the custom domain to the Amplify app. Disable to fall back to the default *.amplifyapp.com domain."
  type        = bool
  default     = true
}

# ---------- API Domain ----------

variable "enable_api_custom_domain" {
  description = "Whether to front the API Lambda Function URL with a stable CloudFront domain (<api_domain_prefix>.<ses_sender_domain>). When true, Amplify's API_URL points at the stable host so a Lambda replacement (e.g. a VPC re-IP) no longer changes the URL baked into the web build. When false, API_URL falls back to the raw Function URL."
  type        = bool
  default     = true
}

variable "api_domain_prefix" {
  description = "Subdomain prefix for the stable API domain (e.g. 'loppemarked-api' -> loppemarked-api.<ses_sender_domain>). Must not collide with hostnames the un17hub DNS repo already owns: api.<domain> there is un17hub's own API Gateway backend, so this stays distinct from 'api'."
  type        = string
  default     = "loppemarked-api"

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", var.api_domain_prefix))
    error_message = "api_domain_prefix must be a valid subdomain label."
  }
}

# ---------- Lambda ----------

variable "lambda_memory_size" {
  description = "Memory allocation for the API Lambda function in MB."
  type        = number
  default     = 256

  validation {
    condition     = var.lambda_memory_size >= 128 && var.lambda_memory_size <= 10240
    error_message = "lambda_memory_size must be between 128 and 10240 MB."
  }
}

variable "lambda_timeout" {
  description = "Timeout for the API Lambda function in seconds."
  type        = number
  default     = 30

  validation {
    condition     = var.lambda_timeout >= 1 && var.lambda_timeout <= 900
    error_message = "lambda_timeout must be between 1 and 900 seconds."
  }
}

variable "lambda_reserved_concurrency" {
  description = "Reserved concurrent executions for the API Lambda. Set to -1 for unrestricted."
  type        = number
  default     = 50

  validation {
    condition     = var.lambda_reserved_concurrency >= -1 && var.lambda_reserved_concurrency <= 1000
    error_message = "lambda_reserved_concurrency must be between -1 (unrestricted) and 1000."
  }
}

# ---------- Monitoring ----------

variable "log_retention_days" {
  description = "CloudWatch log group retention in days."
  type        = number
  default     = 30

  validation {
    condition     = contains([0, 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653], var.log_retention_days)
    error_message = "log_retention_days must be a valid CloudWatch retention value."
  }
}

variable "enable_observability_alerts" {
  description = "Whether to provision the CloudWatch dashboard, metric alarms, and SNS alerting topic for the environment."
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarm notifications. Set to null to skip subscription. Ignored when enable_observability_alerts is false."
  type        = string
  default     = null
}
