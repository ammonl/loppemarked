# ---------- Bootstrap Drift Detection Role ----------
#
# Read-only OIDC role assumed by the daily drift-detection workflow to
# refresh state for the bootstrap stack and surface unmanaged changes
# to bootstrap-owned resources (state bucket, lock table, OIDC provider,
# ci_terraform roles). Plan/apply for bootstrap remains an operator
# action with admin credentials; this role intentionally cannot mutate
# anything.

data "aws_iam_policy_document" "bootstrap_drift_detect_assume" {
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

    # Drift detection runs only on schedule (which always uses the
    # default branch) and workflow_dispatch from main. StringEquals
    # (rather than StringLike used by ci_terraform) is intentional —
    # this role has no PR or per-environment use-case, so the trust
    # surface stays as narrow as possible.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:ref:refs/heads/main",
      ]
    }
  }
}

resource "aws_iam_role" "bootstrap_drift_detect" {
  name               = "loppemarked-bootstrap-drift-detect"
  assume_role_policy = data.aws_iam_policy_document.bootstrap_drift_detect_assume.json

  tags = {
    Name    = "loppemarked-bootstrap-drift-detect"
    purpose = "bootstrap-drift-detection"
  }

  lifecycle {
    prevent_destroy = true
    # The aws_iam_role.inline_policy attribute and the standalone
    # aws_iam_role_policy resource both manage inline policies on the
    # role; refresh of the role pulls in the policy created by the
    # standalone resource and reports it as "added outside Terraform".
    # The policy itself is still managed by aws_iam_role_policy below,
    # so silence the cosmetic refresh noise.
    ignore_changes = [inline_policy]
  }
}

data "aws_iam_policy_document" "bootstrap_drift_detect" {
  statement {
    sid    = "TerraformStateBucketRead"
    effect = "Allow"
    # `terraform plan -refresh-only` against `aws_s3_bucket` calls a
    # broad set of GetBucket* APIs (CORS, lifecycle, replication,
    # logging, website, etc.) that the AWS provider reads regardless of
    # whether the feature is configured. Granting Get*/List* on this
    # one specific bucket keeps the refresh forward-compatible with
    # provider updates without widening blast radius.
    actions = [
      "s3:Get*",
      "s3:List*",
    ]
    resources = [
      "arn:aws:s3:::${var.state_bucket_name}",
    ]
  }

  statement {
    sid    = "TerraformStateObjectRead"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
    ]
    resources = [
      "arn:aws:s3:::${var.state_bucket_name}/bootstrap/*",
    ]
  }

  # `-lock=false` skips DynamoDB writes; the describe/read trio matches
  # the AWS provider's refresh path for `aws_dynamodb_table` (the
  # backend itself is unused thanks to `-lock=false`).
  statement {
    sid    = "TerraformLockTableRead"
    effect = "Allow"
    actions = [
      "dynamodb:DescribeTable",
      "dynamodb:DescribeContinuousBackups",
      "dynamodb:DescribeTimeToLive",
      "dynamodb:ListTagsOfResource",
    ]
    resources = [
      "arn:aws:dynamodb:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:table/${var.lock_table_name}",
    ]
  }

  statement {
    sid    = "OIDCProviderRead"
    effect = "Allow"
    actions = [
      "iam:GetOpenIDConnectProvider",
      "iam:ListOpenIDConnectProviderTags",
      "iam:ListOpenIDConnectProviders",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "BootstrapRolesRead"
    effect = "Allow"
    actions = [
      "iam:GetRole",
      "iam:ListRolePolicies",
      "iam:GetRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListRoleTags",
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/loppemarked-*-ci-terraform",
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/loppemarked-bootstrap-drift-detect",
    ]
  }
}

resource "aws_iam_role_policy" "bootstrap_drift_detect" {
  name   = "bootstrap-drift-detect"
  role   = aws_iam_role.bootstrap_drift_detect.id
  policy = data.aws_iam_policy_document.bootstrap_drift_detect.json
}
