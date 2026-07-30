# Guards the blast radius of the per-environment CI Terraform role.
# Run with: terraform test
#
# The assertions are allowlists, not denylists: a denylist of retired verbs is
# satisfied by a bare "ec2:*", which grants everything it was meant to forbid.
# Anything not named below has to be added here deliberately.
#
# Two things make the allowlists harder to walk past than a naive prefix match.
# Actions are lowercased before comparison, because IAM matches them
# case-insensitively and "EC2:CreateVpc" is a live grant of "ec2:CreateVpc" that
# a case-sensitive "ec2:" filter would discard unchecked. And every action is
# required to be a wildcard-free service:verb pair, so "*", "*:*", and "iam:*"
# fail regardless of which service allowlist they would have been filtered into.
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

# The assertions below name each environment and each policy document
# explicitly, so a new environment — or a third inline policy on the role —
# would otherwise go unchecked. Adding either means extending every run below.
run "every_environment_is_covered" {
  command = plan

  assert {
    condition     = toset(keys(var.ci_terraform_environments)) == toset(["staging", "prod"])
    error_message = "ci_terraform_environments no longer matches the environments this file asserts over. Add the new environment to each assertion below."
  }
}

# A NotAction grant allows everything it does not name, so the allowlists below
# cannot reason about it — they would see no Action key at all. Reject it up
# front rather than teaching the later runs to tolerate a missing key, which
# would turn a NotAction grant into a silent pass.
run "no_not_action_statements" {
  command = plan

  assert {
    condition = alltrue([
      for statement in concat(
        jsondecode(data.aws_iam_policy_document.ci_terraform_resources["staging"].json).Statement,
        jsondecode(data.aws_iam_policy_document.ci_terraform_resources["prod"].json).Statement,
        jsondecode(data.aws_iam_policy_document.ci_terraform_state["staging"].json).Statement,
        jsondecode(data.aws_iam_policy_document.ci_terraform_state["prod"].json).Statement,
        jsondecode(data.aws_iam_policy_document.ci_terraform_shared_network.json).Statement,
      ) : !contains(keys(statement), "NotAction")
    ])
    error_message = "ci-terraform uses a NotAction statement. It grants every action it does not name, which no allowlist below can bound — write the verbs out instead."
  }
}

# Catches the grants no per-service allowlist can see: a bare "*", a wildcard
# verb like "iam:*", or anything that is not a service:verb pair at all. Covers
# both inline policies and the attached managed policy.
run "no_wildcard_or_malformed_actions" {
  command = plan

  assert {
    condition = alltrue([
      for action in flatten([
        for statement in concat(
          jsondecode(data.aws_iam_policy_document.ci_terraform_resources["staging"].json).Statement,
          jsondecode(data.aws_iam_policy_document.ci_terraform_resources["prod"].json).Statement,
          jsondecode(data.aws_iam_policy_document.ci_terraform_state["staging"].json).Statement,
          jsondecode(data.aws_iam_policy_document.ci_terraform_state["prod"].json).Statement,
          jsondecode(data.aws_iam_policy_document.ci_terraform_shared_network.json).Statement,
        ) : flatten([statement.Action]) if statement.Effect == "Allow"
      ]) : can(regex("^[a-z0-9]+:[a-z0-9]+$", lower(action)))
    ])
    error_message = "ci-terraform grants an action that is not a wildcard-free service:verb pair. A bare '*' or a 'service:*' grant is never the right fix for a permission error — name the verbs."
  }
}

# The API Lambda's egress-only security group in the shared VPC is the only
# network resource this stack owns, so the allowlist is that group's lifecycle,
# the reads that resolve it, and the ENI cleanup the provider performs under
# this role's credentials when it destroys the group. un17-infra-shared owns
# everything else in that VPC.
run "ec2_actions_within_allowlist" {
  command = plan

  assert {
    condition = length(setsubtract(
      toset([
        for action in flatten([
          for statement in concat(
            jsondecode(data.aws_iam_policy_document.ci_terraform_resources["staging"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_resources["prod"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_state["staging"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_state["prod"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_shared_network.json).Statement,
          ) : flatten([statement.Action]) if statement.Effect == "Allow"
        ]) : lower(action) if startswith(lower(action), "ec2:")
      ]),
      toset([
        "ec2:createsecuritygroup",
        "ec2:deletesecuritygroup",
        "ec2:describesecuritygroups",
        "ec2:describesecuritygrouprules",
        "ec2:authorizesecuritygroupegress",
        "ec2:revokesecuritygroupegress",
        "ec2:modifysecuritygrouprules",
        "ec2:authorizesecuritygroupingress",
        "ec2:revokesecuritygroupingress",
        "ec2:describevpcs",
        "ec2:describevpcattribute",
        "ec2:describesubnets",
        "ec2:describenetworkinterfaces",
        "ec2:describenetworkinterfaceattribute",
        "ec2:createtags",
        "ec2:deletetags",
        "ec2:describetags",
        "ec2:detachnetworkinterface",
        "ec2:deletenetworkinterface",
      ]),
    )) == 0
    error_message = "ci-terraform grants ec2: actions outside the allowlist in this file. Only the shared-VPC security group's lifecycle, the reads that resolve it, and the provider's lingering-ENI cleanup belong here; widen the allowlist once a resource under modules/loppemarked_stack needs the action, not before."
  }
}

# This stack uses shared-db and owns no RDS instance, subnet group, or
# parameter group, so nothing beyond reads can ever be justified here.
run "rds_actions_are_read_only" {
  command = plan

  assert {
    condition = length(setsubtract(
      toset([
        for action in flatten([
          for statement in concat(
            jsondecode(data.aws_iam_policy_document.ci_terraform_resources["staging"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_resources["prod"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_state["staging"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_state["prod"].json).Statement,
            jsondecode(data.aws_iam_policy_document.ci_terraform_shared_network.json).Statement,
          ) : flatten([statement.Action]) if statement.Effect == "Allow"
        ]) : lower(action) if startswith(lower(action), "rds:")
      ]),
      toset([
        "rds:describedbinstances",
        "rds:describedbsubnetgroups",
        "rds:describedbparametergroups",
        "rds:describedbparameters",
        "rds:describedbsnapshots",
        "rds:describedbengineversions",
        "rds:describeorderabledbinstanceoptions",
        "rds:listtagsforresource",
      ]),
    )) == 0
    error_message = "ci-terraform grants rds: actions outside the read-only allowlist in this file. This stack owns no database; the runtime reaches the shared RDS instance through db_secret_id, and un17-infra-shared owns the instance."
  }
}

# IAM counts a role's inline policies against one 10,240-byte aggregate limit,
# ignoring whitespace. Exceeding it fails the bootstrap apply outright, so this
# trips at 90% to leave room to react. The attached shared-network managed
# policy is deliberately absent: managed policies do not count against it.
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
