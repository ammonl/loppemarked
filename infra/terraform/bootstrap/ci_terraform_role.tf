# ---------- CI Terraform Role (per environment) ----------
#
# These roles are intentionally created in the bootstrap stack rather
# than alongside the per-environment infrastructure. The role itself
# is what the per-environment Terraform apply assumes, so granting it a
# new permission and immediately exercising that permission in the same
# apply triggers an IAM eventual-consistency race (see ticket #181).
# Bootstrap is applied by an operator with admin credentials, so a
# permission update here is in effect before any environment apply
# tries to use it.

data "aws_iam_policy_document" "ci_terraform_assume" {
  for_each = var.ci_terraform_environments

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:ref:refs/heads/main",
        "repo:${var.github_repo}:pull_request",
        "repo:${var.github_repo}:environment:${each.value.github_environment}",
      ]
    }
  }
}

resource "aws_iam_role" "ci_terraform" {
  for_each = var.ci_terraform_environments

  name               = "${each.value.naming_prefix}-ci-terraform"
  assume_role_policy = data.aws_iam_policy_document.ci_terraform_assume[each.key].json

  tags = {
    Name        = "${each.value.naming_prefix}-ci-terraform"
    environment = each.key
  }

  # Losing this role wedges every CI terraform apply for the
  # environment and recovery requires admin credentials.
  lifecycle {
    prevent_destroy = true
  }
}

data "aws_iam_policy_document" "ci_terraform_state" {
  for_each = var.ci_terraform_environments

  statement {
    sid    = "TerraformStateS3List"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
    ]
    resources = [
      "arn:aws:s3:::${var.state_bucket_name}",
    ]
  }

  statement {
    sid    = "TerraformStateS3Read"
    effect = "Allow"
    actions = [
      "s3:GetObject",
    ]
    resources = [
      "arn:aws:s3:::${var.state_bucket_name}/environments/*",
    ]
  }

  statement {
    sid    = "TerraformStateS3Write"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = [
      "arn:aws:s3:::${var.state_bucket_name}/environments/${each.key}/*",
    ]
  }

  statement {
    sid    = "TerraformStateLock"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      "arn:aws:dynamodb:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:table/${var.lock_table_name}",
    ]
  }
}

resource "aws_iam_role_policy" "ci_terraform_state" {
  for_each = var.ci_terraform_environments

  name   = "terraform-state"
  role   = aws_iam_role.ci_terraform[each.key].id
  policy = data.aws_iam_policy_document.ci_terraform_state[each.key].json
}

data "aws_iam_policy_document" "ci_terraform_resources" {
  for_each = var.ci_terraform_environments

  statement {
    sid    = "VPCNetworking"
    effect = "Allow"
    actions = [
      "ec2:CreateVpc",
      "ec2:DeleteVpc",
      "ec2:DescribeVpcs",
      "ec2:DescribeVpcAttribute",
      "ec2:ModifyVpcAttribute",
      "ec2:CreateSubnet",
      "ec2:DeleteSubnet",
      "ec2:DescribeSubnets",
      "ec2:ModifySubnetAttribute",
      "ec2:CreateInternetGateway",
      "ec2:DeleteInternetGateway",
      "ec2:AttachInternetGateway",
      "ec2:DetachInternetGateway",
      "ec2:DescribeInternetGateways",
      "ec2:CreateVpcEndpoint",
      "ec2:DeleteVpcEndpoints",
      "ec2:ModifyVpcEndpoint",
      "ec2:DescribeVpcEndpoints",
      "ec2:DescribeVpcEndpointServices",
      "ec2:DescribePrefixLists",
      "ec2:ReleaseAddress",
      "ec2:DisassociateAddress",
      "ec2:DescribeAddresses",
      "ec2:DescribeAddressesAttribute",
      "ec2:CreateRouteTable",
      "ec2:DeleteRouteTable",
      "ec2:DescribeRouteTables",
      "ec2:CreateRoute",
      "ec2:DeleteRoute",
      "ec2:ReplaceRoute",
      "ec2:AssociateRouteTable",
      "ec2:DisassociateRouteTable",
      "ec2:CreateSecurityGroup",
      "ec2:DeleteSecurityGroup",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSecurityGroupRules",
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupEgress",
      "ec2:CreateFlowLogs",
      "ec2:DeleteFlowLogs",
      "ec2:DescribeFlowLogs",
      "ec2:CreateTags",
      "ec2:DeleteTags",
      "ec2:DescribeTags",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeAvailabilityZones",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "IAMRoles"
    effect = "Allow"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:UpdateRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:PutRolePolicy",
      "iam:GetRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PassRole",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${each.value.naming_prefix}-*",
    ]
  }

  # The role's own permissions are managed by the bootstrap stack with
  # admin credentials. Deny self-modification of this role's trust
  # policy and inline policies so a compromised CI run cannot widen
  # the policies it authenticated with. Other roles in the
  # naming-prefix scope remain mutable via the IAMRoles Allow above
  # so the env apply can manage api-runtime / ci-deploy.
  statement {
    sid    = "DenySelfModify"
    effect = "Deny"
    actions = [
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:DeleteRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${each.value.naming_prefix}-ci-terraform",
    ]
  }

  statement {
    sid    = "IAMReadOIDC"
    effect = "Allow"
    actions = [
      "iam:GetOpenIDConnectProvider",
      "iam:ListOpenIDConnectProviders",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "KMSKeys"
    effect = "Allow"
    actions = [
      "kms:CreateKey",
      "kms:DescribeKey",
      "kms:GetKeyPolicy",
      "kms:GetKeyRotationStatus",
      "kms:ListResourceTags",
      "kms:PutKeyPolicy",
      "kms:EnableKeyRotation",
      "kms:DisableKeyRotation",
      "kms:TagResource",
      "kms:UntagResource",
      "kms:ScheduleKeyDeletion",
      "kms:CreateAlias",
      "kms:DeleteAlias",
      "kms:ListAliases",
      "kms:UpdateAlias",
      "kms:Decrypt",
      "kms:GenerateDataKey",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:PutRetentionPolicy",
      "logs:DeleteRetentionPolicy",
      "logs:TagLogGroup",
      "logs:UntagLogGroup",
      "logs:ListTagsLogGroup",
      "logs:ListTagsForResource",
      "logs:TagResource",
      "logs:UntagResource",
      "logs:AssociateKmsKey",
      "logs:DisassociateKmsKey",
    ]
    resources = [
      "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/${each.value.naming_prefix}/*",
      "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/${each.value.naming_prefix}/*:*",
    ]
  }

  statement {
    sid       = "CloudWatchLogsList"
    effect    = "Allow"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["*"]
  }

  # SES v1 APIs do not support resource-level permissions; wildcard required.
  statement {
    sid    = "SESManage"
    effect = "Allow"
    actions = [
      "ses:VerifyDomainIdentity",
      "ses:VerifyDomainDkim",
      "ses:GetIdentityVerificationAttributes",
      "ses:GetIdentityDkimAttributes",
      "ses:DeleteIdentity",
      "ses:CreateConfigurationSet",
      "ses:DescribeConfigurationSet",
      "ses:DeleteConfigurationSet",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "Route53Zones"
    effect = "Allow"
    actions = [
      "route53:CreateHostedZone",
      "route53:DeleteHostedZone",
      "route53:GetHostedZone",
      "route53:ListResourceRecordSets",
      "route53:ChangeResourceRecordSets",
      "route53:ChangeTagsForResource",
      "route53:ListTagsForResource",
    ]
    resources = ["arn:aws:route53:::hostedzone/*"]
  }

  statement {
    sid    = "Route53Global"
    effect = "Allow"
    actions = [
      "route53:ListHostedZones",
      "route53:GetChange",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "STSIdentity"
    effect = "Allow"
    actions = [
      "sts:GetCallerIdentity",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "LambdaManage"
    effect = "Allow"
    actions = [
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:ListFunctions",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:GetPolicy",
      "lambda:TagResource",
      "lambda:UntagResource",
      "lambda:ListTags",
      "lambda:CreateFunctionUrlConfig",
      "lambda:GetFunctionUrlConfig",
      "lambda:UpdateFunctionUrlConfig",
      "lambda:DeleteFunctionUrlConfig",
      "lambda:ListVersionsByFunction",
      "lambda:GetFunctionCodeSigningConfig",
    ]
    resources = [
      "arn:aws:lambda:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:function:${each.value.naming_prefix}-*",
    ]
  }

  statement {
    sid    = "SecretsManager"
    effect = "Allow"
    actions = [
      "secretsmanager:CreateSecret",
      "secretsmanager:DeleteSecret",
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue",
      "secretsmanager:PutSecretValue",
      "secretsmanager:UpdateSecret",
      "secretsmanager:TagResource",
      "secretsmanager:UntagResource",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:PutResourcePolicy",
      "secretsmanager:DeleteResourcePolicy",
    ]
    resources = [
      "arn:aws:secretsmanager:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:secret:${each.value.naming_prefix}-*",
    ]
  }

  statement {
    sid       = "SecretsManagerList"
    effect    = "Allow"
    actions   = ["secretsmanager:ListSecrets"]
    resources = ["*"]
  }

  statement {
    sid    = "SNSManage"
    effect = "Allow"
    actions = [
      "sns:CreateTopic",
      "sns:DeleteTopic",
      "sns:GetTopicAttributes",
      "sns:SetTopicAttributes",
      "sns:TagResource",
      "sns:UntagResource",
      "sns:ListTagsForResource",
      "sns:Subscribe",
      "sns:Unsubscribe",
      "sns:GetSubscriptionAttributes",
    ]
    resources = [
      "arn:aws:sns:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:${each.value.naming_prefix}-*",
    ]
  }

  statement {
    sid    = "CloudWatchAlarms"
    effect = "Allow"
    actions = [
      "cloudwatch:PutMetricAlarm",
      "cloudwatch:DeleteAlarms",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:ListTagsForResource",
      "cloudwatch:TagResource",
      "cloudwatch:UntagResource",
      "cloudwatch:PutDashboard",
      "cloudwatch:DeleteDashboards",
      "cloudwatch:GetDashboard",
      "cloudwatch:ListDashboards",
    ]
    resources = [
      "arn:aws:cloudwatch:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:alarm:${each.value.naming_prefix}-*",
      "arn:aws:cloudwatch::${data.aws_caller_identity.current.account_id}:dashboard/${each.value.naming_prefix}-*",
    ]
  }

  statement {
    sid    = "RDSRead"
    effect = "Allow"
    actions = [
      "rds:DescribeDBInstances",
      "rds:DescribeDBSubnetGroups",
      "rds:DescribeDBParameterGroups",
      "rds:DescribeDBParameters",
      "rds:DescribeDBSnapshots",
      "rds:ListTagsForResource",
      "rds:DescribeDBEngineVersions",
      "rds:DescribeOrderableDBInstanceOptions",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "RDSManage"
    effect = "Allow"
    actions = [
      "rds:CreateDBInstance",
      "rds:DeleteDBInstance",
      "rds:ModifyDBInstance",
      "rds:RebootDBInstance",
      "rds:CreateDBSnapshot",
      "rds:DeleteDBSnapshot",
      "rds:AddTagsToResource",
      "rds:RemoveTagsFromResource",
    ]
    resources = [
      "arn:aws:rds:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:db:${each.value.naming_prefix}-*",
      "arn:aws:rds:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:snapshot:${each.value.naming_prefix}-*",
    ]
  }

  statement {
    sid    = "RDSSubnetGroups"
    effect = "Allow"
    actions = [
      "rds:CreateDBSubnetGroup",
      "rds:DeleteDBSubnetGroup",
      "rds:ModifyDBSubnetGroup",
      "rds:AddTagsToResource",
      "rds:RemoveTagsFromResource",
    ]
    resources = [
      "arn:aws:rds:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:subgrp:${each.value.naming_prefix}-*",
    ]
  }

  statement {
    sid    = "RDSParameterGroups"
    effect = "Allow"
    actions = [
      "rds:CreateDBParameterGroup",
      "rds:DeleteDBParameterGroup",
      "rds:ModifyDBParameterGroup",
      "rds:ResetDBParameterGroup",
      "rds:AddTagsToResource",
      "rds:RemoveTagsFromResource",
    ]
    resources = [
      "arn:aws:rds:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:pg:${each.value.naming_prefix}-*",
    ]
  }

  statement {
    sid    = "EventBridgeManage"
    effect = "Allow"
    actions = [
      "events:PutRule",
      "events:DeleteRule",
      "events:DescribeRule",
      "events:ListTagsForResource",
      "events:TagResource",
      "events:UntagResource",
      "events:PutTargets",
      "events:RemoveTargets",
      "events:ListTargetsByRule",
    ]
    resources = [
      "arn:aws:events:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:rule/${each.value.naming_prefix}-*",
    ]
  }

  statement {
    sid    = "AmplifyManage"
    effect = "Allow"
    actions = [
      "amplify:CreateApp",
      "amplify:DeleteApp",
      "amplify:GetApp",
      "amplify:UpdateApp",
      "amplify:ListApps",
      "amplify:TagResource",
      "amplify:UntagResource",
      "amplify:ListTagsForResource",
      "amplify:CreateBranch",
      "amplify:DeleteBranch",
      "amplify:GetBranch",
      "amplify:UpdateBranch",
      "amplify:ListBranches",
      "amplify:CreateDomainAssociation",
      "amplify:DeleteDomainAssociation",
      "amplify:GetDomainAssociation",
      "amplify:UpdateDomainAssociation",
      "amplify:ListDomainAssociations",
    ]
    resources = [
      "arn:aws:amplify:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:apps/*",
    ]
  }
}

resource "aws_iam_role_policy" "ci_terraform_resources" {
  for_each = var.ci_terraform_environments

  name   = "terraform-resources"
  role   = aws_iam_role.ci_terraform[each.key].id
  policy = data.aws_iam_policy_document.ci_terraform_resources[each.key].json
}
