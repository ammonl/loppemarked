# Validates that IAM policies do not use wildcard resources.
# Run with: terraform test

variables {
  environment          = "test"
  vpc_cidr             = "10.99.0.0/16"
  availability_zones   = ["eu-north-1a", "eu-north-1b"]
  public_subnet_cidrs  = ["10.99.1.0/24", "10.99.2.0/24"]
  private_subnet_cidrs = ["10.99.10.0/24", "10.99.11.0/24"]

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
