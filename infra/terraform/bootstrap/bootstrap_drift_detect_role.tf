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

    # Drift detection runs on schedule + workflow_dispatch from main only.
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
  }
}

data "aws_iam_policy_document" "bootstrap_drift_detect" {
  statement {
    sid    = "TerraformStateBucketRead"
    effect = "Allow"
    actions = [
      "s3:GetBucketVersioning",
      "s3:GetBucketLocation",
      "s3:GetBucketPolicy",
      "s3:GetBucketAcl",
      "s3:GetBucketTagging",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetEncryptionConfiguration",
      "s3:ListBucket",
      "s3:ListBucketVersions",
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

  # `-lock=false` skips DynamoDB writes; describe + tag-read cover the
  # refresh of the `aws_dynamodb_table.tflock` resource itself.
  statement {
    sid    = "TerraformLockTableRead"
    effect = "Allow"
    actions = [
      "dynamodb:DescribeTable",
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
