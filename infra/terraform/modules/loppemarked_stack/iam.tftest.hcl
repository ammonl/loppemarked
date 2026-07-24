# Validates that IAM policies do not use wildcard resources.
# Run with: terraform test

# The module requires a us-east-1 provider alias for the CloudFront ACM
# certificate (api_domain.tf). Define both provider configurations so the test
# can plan the module.
provider "aws" {
  region = "eu-north-1"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

variables {
  environment = "test"

  shared_vpc_id             = "vpc-0123456789abcdef0"
  shared_private_subnet_ids = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
  db_secret_id              = "rds/shared/loppemarked_test"

  github_oidc_provider_arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"

  ses_sender_domain = "test.example.com"
}

run "ses_policy_uses_scoped_arns" {
  command = plan

  assert {
    condition     = !contains([for s in jsondecode(data.aws_iam_policy_document.api_ses.json).Statement : s if s.Sid == "SESSend"][0].Resource, "*")
    error_message = "SES send policy must not use wildcard '*' resource. Scope to specific identity ARN(s)."
  }
}

run "ses_sender_domain_reject_invalid" {
  command = plan

  variables {
    ses_sender_domain = "not a domain!"
  }

  expect_failures = [var.ses_sender_domain]
}
