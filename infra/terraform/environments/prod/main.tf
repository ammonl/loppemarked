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
    key            = "environments/prod/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "loppemarked-2026-tflock"
    encrypt        = true
  }
}

provider "aws" {
  region = "eu-north-1"

  default_tags {
    tags = {
      project     = "loppemarked"
      season      = "2026"
      environment = "prod"
      managed_by  = "terraform"
    }
  }
}

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

module "loppemarked_stack" {
  source             = "../../modules/loppemarked_stack"
  environment        = "prod"
  github_environment = "production"

  github_oidc_provider_arn = data.aws_iam_openid_connect_provider.github.arn

  # Prod re-IP is deferred to a scheduled maintenance window. Prod RDS has
  # deletion_protection enabled, so a CIDR change (which forces a VPC/subnet
  # and therefore RDS replacement) would fail mid-destroy and leave prod in a
  # half-torn-down state. Re-IP prod only after disabling deletion protection
  # and confirming a snapshot, off-hours. Staging re-IPs to 10.2.0.0/16 now.
  vpc_cidr             = "10.1.0.0/16"
  availability_zones   = ["eu-north-1a", "eu-north-1b"]
  public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24"]
  private_subnet_cidrs = ["10.1.10.0/24", "10.1.11.0/24"]
  log_retention_days   = 90

  # Requester-side peering into the shared-db VPC (Phase B). db_secret_id is
  # intentionally left unset here: the dedicated DB stays active until the
  # Phase D cutover wires DB_SECRET_ID = "rds/shared/loppemarked_prod".
  shared_db_vpc_id   = "vpc-908203f9"
  shared_db_vpc_cidr = "172.31.0.0/16"

  db_instance_class        = "db.t4g.micro"
  db_allocated_storage     = 20
  db_max_allocated_storage = 100
  db_backup_retention_days = 35
  db_multi_az              = false

  lambda_reserved_concurrency = -1

  ses_sender_domain  = "un17hub.com"
  ses_reply_to_email = "ammonl@hotmail.com"

  alarm_email = "ammonl@hotmail.com"

  amplify_branch_name             = "main"
  amplify_enable_auto_build       = false
  amplify_domain_prefix           = "loppemarked"
  amplify_enable_preview_branches = false
  amplify_enable_custom_domain    = true
}

output "alarm_sns_topic_arn" {
  value = module.loppemarked_stack.alarm_sns_topic_arn
}

output "dashboard_name" {
  value = module.loppemarked_stack.dashboard_name
}

output "naming_prefix" {
  value = module.loppemarked_stack.naming_prefix
}

output "vpc_id" {
  value = module.loppemarked_stack.vpc_id
}

output "api_runtime_role_arn" {
  value = module.loppemarked_stack.api_runtime_role_arn
}

output "ci_deploy_role_arn" {
  value = module.loppemarked_stack.ci_deploy_role_arn
}

output "ci_terraform_role_arn" {
  value = module.loppemarked_stack.ci_terraform_role_arn
}

output "db_endpoint" {
  value = module.loppemarked_stack.db_endpoint
}

output "db_secret_arn" {
  value = module.loppemarked_stack.db_secret_arn
}

output "app_secret_arn" {
  value = module.loppemarked_stack.app_secret_arn
}

output "api_function_name" {
  value = module.loppemarked_stack.api_function_name
}

output "api_base_url" {
  value = module.loppemarked_stack.api_base_url
}

output "ses_domain_identity_arn" {
  value = module.loppemarked_stack.ses_domain_identity_arn
}

output "ses_configuration_set_name" {
  value = module.loppemarked_stack.ses_configuration_set_name
}

output "ses_sender_email" {
  value = module.loppemarked_stack.ses_sender_email
}

output "ses_reply_to_email" {
  value = module.loppemarked_stack.ses_reply_to_email
}

output "route53_zone_id" {
  value = module.loppemarked_stack.route53_zone_id
}

output "route53_nameservers" {
  value = module.loppemarked_stack.route53_nameservers
}

output "amplify_app_id" {
  value = module.loppemarked_stack.amplify_app_id
}

output "amplify_default_domain" {
  value = module.loppemarked_stack.amplify_default_domain
}

output "amplify_custom_domain" {
  value = module.loppemarked_stack.amplify_custom_domain
}
