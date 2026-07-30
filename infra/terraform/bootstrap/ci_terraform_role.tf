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
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
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

  # The only network resource this stack owns is the API Lambda's egress-only
  # security group in the shared VPC (modules/loppemarked_stack/networking.tf).
  # The shared VPC's own network objects — subnets, gateways, route tables, flow
  # logs — belong to un17-infra-shared, so nothing here manages them.
  #
  # ci_terraform_role.tftest.hcl asserts this list against an allowlist.
  statement {
    sid    = "SharedVpcSecurityGroup"
    effect = "Allow"
    actions = [
      "ec2:CreateSecurityGroup",
      "ec2:DeleteSecurityGroup",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSecurityGroupRules",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupEgress",
      # ModifySecurityGroupRules is how the provider edits an existing
      # aws_vpc_security_group_egress_rule in place: its description, CIDR, and
      # protocol are all in-place updates rather than replacements.
      "ec2:ModifySecurityGroupRules",
      # The group is egress-only, so no resource here authorizes ingress. The
      # pair is held until a CloudTrail lookup confirms that the calls this role
      # made in the last 90 days all belong to security groups that no longer
      # exist.
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
      # Destroying a security group takes these two, under this role's
      # credentials rather than the Lambda service's: the provider's security
      # group delete sweeps up ENIs the Lambda service has not released yet
      # (deleteLingeringENIs), detaching and deleting each one. The group is
      # create_before_destroy, so any replacement of it — a shared_vpc_id
      # republished by un17-infra-shared, a description edit — destroys the old
      # group while the Lambda's ENIs are still attached, which is exactly that
      # path. Without these, such an apply fails midway with the new group
      # created and the old one orphaned.
      "ec2:DetachNetworkInterface",
      "ec2:DeleteNetworkInterface",
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

  # Read-only. This stack owns no database — the API runtime reaches the shared
  # RDS instance through var.db_secret_id, and un17-infra-shared owns the
  # instance, its subnet group, and its parameter group. Nothing in the
  # configuration is known to call these; they are kept because a read-only
  # grant is cheap and dropping them belongs with the CloudTrail sweep that
  # settles the ingress pair above.
  #
  # ci_terraform_role.tftest.hcl asserts this list against an allowlist.
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

  # ACM certificates for the stable API domain are requested in us-east-1
  # (CloudFront requirement), so the ARN region is hardcoded rather than
  # derived from the role's own region.
  statement {
    sid    = "ACMCertificates"
    effect = "Allow"
    actions = [
      "acm:RequestCertificate",
      "acm:DeleteCertificate",
      "acm:DescribeCertificate",
      "acm:GetCertificate",
      "acm:AddTagsToCertificate",
      "acm:RemoveTagsFromCertificate",
      "acm:ListTagsForCertificate",
    ]
    resources = [
      "arn:aws:acm:us-east-1:${data.aws_caller_identity.current.account_id}:certificate/*",
    ]
  }

  statement {
    sid       = "ACMList"
    effect    = "Allow"
    actions   = ["acm:ListCertificates"]
    resources = ["*"]
  }

  # CloudFront actions do not support resource-level permissions, so the
  # wildcard resource is required for the stable API domain distribution.
  statement {
    sid    = "CloudFrontManage"
    effect = "Allow"
    actions = [
      "cloudfront:CreateDistribution",
      "cloudfront:DeleteDistribution",
      "cloudfront:GetDistribution",
      "cloudfront:GetDistributionConfig",
      "cloudfront:UpdateDistribution",
      "cloudfront:ListDistributions",
      "cloudfront:TagResource",
      "cloudfront:UntagResource",
      "cloudfront:ListTagsForResource",
      "cloudfront:GetCachePolicy",
      "cloudfront:ListCachePolicies",
      "cloudfront:GetOriginRequestPolicy",
      "cloudfront:ListOriginRequestPolicies",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ci_terraform_resources" {
  for_each = var.ci_terraform_environments

  name   = "terraform-resources"
  role   = aws_iam_role.ci_terraform[each.key].id
  policy = data.aws_iam_policy_document.ci_terraform_resources[each.key].json
}

# ---------- Shared-network SSM read (attached managed policy) ----------
#
# The environment stacks read the shared default-VPC network identifiers
# (/shared/network/vpc-id, /shared/network/private-subnet-ids) published by
# un17-infra-shared to attach the API Lambda to the shared subnets. This lives in
# its own attached managed policy rather than the terraform-resources inline
# policy: managed policies do not count against IAM's 10,240-byte aggregate
# limit for a role's inline policies, so keeping it out preserves headroom
# there.

data "aws_iam_policy_document" "ci_terraform_shared_network" {
  statement {
    sid    = "SharedNetworkParameters"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
    ]
    resources = [
      "arn:aws:ssm:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:parameter/shared/network/*",
    ]
  }
}

resource "aws_iam_policy" "ci_terraform_shared_network" {
  for_each = var.ci_terraform_environments

  name        = "${each.value.naming_prefix}-ci-terraform-shared-network"
  description = "Read the shared default-VPC network identifiers from SSM for Terraform plan/apply."
  policy      = data.aws_iam_policy_document.ci_terraform_shared_network.json

  tags = {
    Name = "${each.value.naming_prefix}-ci-terraform-shared-network"
  }
}

resource "aws_iam_role_policy_attachment" "ci_terraform_shared_network" {
  for_each = var.ci_terraform_environments

  role       = aws_iam_role.ci_terraform[each.key].name
  policy_arn = aws_iam_policy.ci_terraform_shared_network[each.key].arn
}
