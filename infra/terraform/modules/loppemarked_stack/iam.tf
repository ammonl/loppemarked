# ---------- API Runtime Role (Lambda) ----------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api_runtime" {
  name               = "${local.naming_prefix}-api-runtime"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${local.naming_prefix}-api-runtime"
  }
}

resource "aws_iam_role_policy_attachment" "api_basic_execution" {
  role       = aws_iam_role.api_runtime.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "api_vpc_access" {
  role       = aws_iam_role.api_runtime.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "api_secrets" {
  statement {
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
    ]
    # Dedicated DB credentials + app secret (active until Phase D), plus this
    # project's own shared-db secret when wired. Scoped to specific name
    # prefixes only (the trailing -* matches Secrets Manager's random ARN
    # suffix): never the shared-db master secret, never another project's.
    resources = concat(
      [
        "arn:aws:secretsmanager:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:secret:${local.naming_prefix}-*",
      ],
      var.db_secret_id != null ? [
        "arn:aws:secretsmanager:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:secret:${var.db_secret_id}-*",
      ] : []
    )
  }

  statement {
    effect = "Allow"
    actions = [
      "kms:Decrypt",
    ]
    resources = [
      aws_kms_key.data.arn,
    ]
  }
}

resource "aws_iam_role_policy" "api_secrets" {
  name   = "secrets-read"
  role   = aws_iam_role.api_runtime.id
  policy = data.aws_iam_policy_document.api_secrets.json
}

data "aws_iam_policy_document" "api_ses" {
  statement {
    sid    = "SESSend"
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = [
      aws_ses_domain_identity.main.arn,
      "arn:aws:ses:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:identity/*",
    ]
  }
}

resource "aws_iam_role_policy" "api_ses" {
  name   = "ses-send"
  role   = aws_iam_role.api_runtime.id
  policy = data.aws_iam_policy_document.api_ses.json
}

# ---------- CI Deploy Role (GitHub Actions OIDC) ----------

data "aws_iam_policy_document" "ci_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
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
        "repo:${var.github_repo}:environment:${coalesce(var.github_environment, var.environment)}",
      ]
    }
  }
}

resource "aws_iam_role" "ci_deploy" {
  name               = "${local.naming_prefix}-ci-deploy"
  assume_role_policy = data.aws_iam_policy_document.ci_assume.json

  tags = {
    Name = "${local.naming_prefix}-ci-deploy"
  }
}

data "aws_iam_policy_document" "ci_deploy_permissions" {
  statement {
    sid    = "LambdaDeploy"
    effect = "Allow"
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:GetFunction",
      "lambda:GetFunctionUrlConfig",
      "lambda:ListFunctions",
      "lambda:InvokeFunction",
    ]
    resources = [
      "arn:aws:lambda:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:function:${local.naming_prefix}-*",
    ]
  }

  statement {
    sid    = "S3Assets"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:DeleteObject",
    ]
    resources = [
      "arn:aws:s3:::${local.naming_prefix}-*",
      "arn:aws:s3:::${local.naming_prefix}-*/*",
    ]
  }

  statement {
    sid    = "AmplifyDeploy"
    effect = "Allow"
    actions = [
      "amplify:StartDeployment",
      "amplify:GetApp",
      "amplify:GetBranch",
      "amplify:ListApps",
      "amplify:ListBranches",
      "amplify:StartJob",
      "amplify:StopJob",
      "amplify:GetJob",
      "amplify:ListJobs",
    ]
    resources = [
      aws_amplify_app.web.arn,
      "${aws_amplify_app.web.arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "ci_deploy" {
  name   = "deploy-permissions"
  role   = aws_iam_role.ci_deploy.id
  policy = data.aws_iam_policy_document.ci_deploy_permissions.json
}

# ---------- CI Terraform Role (lookup) ----------
#
# The ci_terraform role and its inline policies are owned by the
# bootstrap stack so the role's permissions are not modified by an
# apply that the role itself executes (see ticket #181). The module
# looks the role up so the per-environment ci_terraform_role_arn
# output continues to work for downstream consumers.

data "aws_iam_role" "ci_terraform" {
  name = "${local.naming_prefix}-ci-terraform"
}
