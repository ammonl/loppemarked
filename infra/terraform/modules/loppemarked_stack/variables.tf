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

# ---------- Networking ----------

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "availability_zones" {
  description = "List of availability zones for subnet placement."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones required for HA."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (one per AZ)."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ)."
  type        = list(string)
}

# ---------- Shared DB (cross-VPC) ----------
#
# Phase B of the shared-db migration. The shared-db VPC and per-environment
# credential secrets are owned by infra-shared-db (Phase A). These inputs wire
# requester-side peering and the runtime secret switch. They default to null so
# the module stays self-contained until an environment opts in.

variable "shared_db_vpc_id" {
  description = "VPC id of the shared-db VPC to peer with (Phase A output from infra-shared-db). Null disables requester-side peering."
  type        = string
  default     = null

  validation {
    condition     = var.shared_db_vpc_id == null || can(regex("^vpc-[0-9a-f]+$", var.shared_db_vpc_id))
    error_message = "shared_db_vpc_id must be a valid VPC id (vpc-...) or null."
  }
}

variable "shared_db_vpc_cidr" {
  description = "CIDR block of the shared-db VPC, used for the requester-side peering route. Required when shared_db_vpc_id is set."
  type        = string
  default     = null

  validation {
    condition     = var.shared_db_vpc_cidr == null || can(cidrhost(var.shared_db_vpc_cidr, 0))
    error_message = "shared_db_vpc_cidr must be a valid CIDR block or null."
  }
}

variable "db_secret_id" {
  description = "Secrets Manager id/name of the shared-db credentials secret (e.g. rds/shared/loppemarked_staging). When set, the API runtime builds its DB connection from this secret instead of the dedicated DB env vars. Null keeps the dedicated DB active (no cutover)."
  type        = string
  default     = null
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

# ---------- Database ----------

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum storage autoscaling limit in GB."
  type        = number
  default     = 50
}

variable "db_backup_retention_days" {
  description = "Number of days to retain automated backups."
  type        = number
  default     = 7

  validation {
    condition     = var.db_backup_retention_days >= 1 && var.db_backup_retention_days <= 35
    error_message = "db_backup_retention_days must be between 1 and 35."
  }
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment for RDS."
  type        = bool
  default     = false
}

variable "db_name" {
  description = "Name of the default database to create."
  type        = string
  default     = "loppemarked"
}

variable "db_master_username" {
  description = "Master username for the RDS instance."
  type        = string
  default     = "loppemarked"
}

variable "db_deletion_protection" {
  description = "Override for RDS deletion protection. When null (the default), protection is enabled for prod and disabled for non-prod. Set to false on prod only for a planned destructive maintenance window (e.g. a VPC re-IP that replaces the instance), then restore it afterward. Disabling protection must be applied before the apply that triggers the replacement."
  type        = bool
  default     = null
}

# ---------- Migration host (temporary) ----------

variable "enable_db_migration_host" {
  description = "Provision a temporary SSM-accessed EC2 host in a private subnet with PostgreSQL 16 client tools, for the prod shared-db data migration. Defaults to false; flip to true only for the migration window and back to false to tear it down."
  type        = bool
  default     = false
}

variable "db_migration_host_instance_type" {
  description = "Instance type for the migration host (arm64, to match the AL2023 arm64 AMI)."
  type        = string
  default     = "t4g.micro"
}

variable "db_migration_host_volume_size" {
  description = "Root volume size in GB for the migration host. Size for the largest dump/restore the move needs to stage on disk."
  type        = number
  default     = 50

  validation {
    condition     = var.db_migration_host_volume_size >= 20 && var.db_migration_host_volume_size <= 500
    error_message = "db_migration_host_volume_size must be between 20 and 500 GB."
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

variable "alarm_rds_connections_threshold" {
  description = "Threshold for the RDS database connections alarm. Adjust per instance class (e.g. ~85 for db.t4g.micro, ~170 for db.t4g.small)."
  type        = number
  default     = 80
}
