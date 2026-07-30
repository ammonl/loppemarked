# Guards the blast radius of the per-environment CI Terraform role.
# Run with: terraform test
#
# The assertions are allowlists, not denylists: a denylist of retired verbs is
# satisfied by a bare "ec2:*", which grants everything it was meant to forbid.
# Anything not named below has to be added here deliberately.
#
# No AWS credentials are needed. The data sources that would call AWS are
# overridden and the provider skips credential resolution, so the only thing the
# plan renders is the policy JSON.

provider "aws" {
  region                      = "eu-north-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
}

override_data {
  target = data.aws_caller_identity.current
  values = {
    account_id = "123456789012"
  }
}

override_data {
  target = data.aws_region.current
  values = {
    id = "eu-north-1"
  }
}

override_data {
  target = data.aws_iam_openid_connect_provider.github
  values = {
    arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
  }
}

# The state backend resources reach AWS while planning. Nothing asserted here
# depends on them.
override_resource {
  target = aws_dynamodb_table.tflock
}

# The assertions below name each environment's policy document explicitly, so a
# new environment would otherwise go unchecked.
run "every_environment_is_covered" {
  command = plan

  assert {
    condition     = toset(keys(var.ci_terraform_environments)) == toset(["staging", "prod"])
    error_message = "ci_terraform_environments no longer matches the environments this file asserts over. Add the new environment to each assertion below."
  }
}

# The API Lambda's egress-only security group in the shared VPC is the only
# network resource this stack owns, so the allowlist is that group's lifecycle
# plus the reads the provider needs to resolve it and the Lambda's vpc_config.
# un17-infra-shared owns everything else in that VPC.
run "ec2_actions_within_allowlist" {
  command = plan

  assert {
    condition = length(setsubtract(
      toset([
        for action in flatten([
          for statement in concat(
            jsondecode(data.aws_iam_policy_document.ci_terraform_resources["staging"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_resources["prod"].json).Statement,
          ) : flatten([statement.Action]) if statement.Effect == "Allow"
        ]) : action if startswith(action, "ec2:")
      ]),
      toset([
        "ec2:CreateSecurityGroup",
        "ec2:DeleteSecurityGroup",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSecurityGroupRules",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupEgress",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:DescribeVpcs",
        "ec2:DescribeVpcAttribute",
        "ec2:DescribeSubnets",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribeNetworkInterfaceAttribute",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:DescribeTags",
      ]),
    )) == 0
    error_message = "ci-terraform grants ec2: actions outside the allowlist in this file. Only the shared-VPC security group's lifecycle and the vpc_config reads belong here; widen the allowlist once a resource under modules/loppemarked_stack needs the action, not before."
  }
}

# This stack uses shared-db and owns no RDS instance, subnet group, or
# parameter group. The plan refresh still reads shared-RDS metadata.
run "rds_actions_are_read_only" {
  command = plan

  assert {
    condition = length(setsubtract(
      toset([
        for action in flatten([
          for statement in concat(
            jsondecode(data.aws_iam_policy_document.ci_terraform_resources["staging"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_resources["prod"].json).Statement,
          ) : flatten([statement.Action]) if statement.Effect == "Allow"
        ]) : action if startswith(action, "rds:")
      ]),
      toset([
        "rds:DescribeDBInstances",
        "rds:DescribeDBSubnetGroups",
        "rds:DescribeDBParameterGroups",
        "rds:DescribeDBParameters",
        "rds:DescribeDBSnapshots",
        "rds:DescribeDBEngineVersions",
        "rds:DescribeOrderableDBInstanceOptions",
        "rds:ListTagsForResource",
      ]),
    )) == 0
    error_message = "ci-terraform grants rds: actions outside the read-only allowlist in this file. This stack owns no database; the runtime reaches the shared RDS instance through db_secret_id, and un17-infra-shared owns the instance."
  }
}

# IAM counts a role's inline policies against one 10,240-byte aggregate limit,
# ignoring whitespace. Exceeding it fails the bootstrap apply outright, so this
# trips at 90% to leave room to react.
run "inline_policies_fit_the_iam_size_limit" {
  command = plan

  assert {
    condition = max(
      length(replace(data.aws_iam_policy_document.ci_terraform_resources["staging"].json, "/\\s/", "")) +
      length(replace(data.aws_iam_policy_document.ci_terraform_state["staging"].json, "/\\s/", "")),
      length(replace(data.aws_iam_policy_document.ci_terraform_resources["prod"].json, "/\\s/", "")) +
      length(replace(data.aws_iam_policy_document.ci_terraform_state["prod"].json, "/\\s/", "")),
    ) <= 9216
    error_message = "The ci-terraform role's aggregate inline policy is within 10% of IAM's 10,240-byte limit. Move a statement into an attached managed policy (those do not count against the limit) rather than shaving actions to fit."
  }
}
