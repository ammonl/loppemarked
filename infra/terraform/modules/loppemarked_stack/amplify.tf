# ---------- Amplify App ----------

resource "aws_amplify_app" "web" {
  name     = "${local.naming_prefix}-web"
  platform = "WEB_COMPUTE"

  # Managed here so prod and staging cannot silently drift onto different repos
  # (both previously sat in ignore_changes, and prod diverged to a stale repo
  # owner). The GitHub connection token stays out of Terraform (see
  # access_token/oauth_token in ignore_changes below); this only asserts the URL.
  #
  # iam_service_role_arn is intentionally left in ignore_changes: the pinned AWS
  # provider (6.34.0) treats a change to it as force-new, so managing it here
  # would destroy and recreate the whole app (new app id + domain association).
  # The build role is kept consistent out-of-band instead.
  repository = var.amplify_repository

  build_spec = <<-YAML
version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - nvm install 22
            - nvm use 22
            - cd ../.. && npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - "**/*"
      cache:
        paths:
          - node_modules/**/*
          - ../../node_modules/**/*
          - .next/cache/**/*
  YAML

  environment_variables = {
    AMPLIFY_MONOREPO_APP_ROOT = "apps/web"
    # Point at the stable CloudFront domain (api_domain.tf) so a Lambda
    # replacement no longer changes the URL baked into the web build. Falls
    # back to the raw Function URL when the stable domain is disabled.
    API_URL = var.enable_api_custom_domain ? "https://${local.api_domain_name}" : aws_lambda_function_url.api.function_url
  }

  enable_auto_branch_creation = var.amplify_enable_preview_branches
  enable_branch_auto_deletion = var.amplify_enable_preview_branches

  auto_branch_creation_patterns = var.amplify_enable_preview_branches ? var.amplify_preview_branch_patterns : []

  dynamic "auto_branch_creation_config" {
    for_each = var.amplify_enable_preview_branches ? [1] : []
    content {
      enable_auto_build             = true
      enable_pull_request_preview   = true
      pull_request_environment_name = "pr"
      stage                         = "DEVELOPMENT"
      framework                     = "Next.js - SSR"
      environment_variables = {
        NEXT_PUBLIC_ENV = "preview"
      }
    }
  }

  lifecycle {
    # access_token / oauth_token are write-only (never returned), so the GitHub
    # connection stays established out-of-band. iam_service_role_arn is a
    # force-new change under the pinned provider, so it stays unmanaged too.
    ignore_changes = [
      access_token,
      oauth_token,
      iam_service_role_arn,
    ]
  }

  tags = {
    Name = "${local.naming_prefix}-web"
  }
}

# ---------- Amplify Branch ----------

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.web.id
  branch_name = var.amplify_branch_name

  enable_auto_build           = var.amplify_enable_auto_build
  enable_pull_request_preview = var.amplify_enable_preview_branches

  framework = "Next.js - SSR"
  stage     = "PRODUCTION"

  environment_variables = {
    NEXT_PUBLIC_ENV = var.environment
  }

  tags = {
    Name = "${local.naming_prefix}-web-${var.amplify_branch_name}"
  }
}

# ---------- Amplify Domain Association ----------

resource "aws_amplify_domain_association" "main" {
  count = var.amplify_enable_custom_domain ? 1 : 0

  app_id      = aws_amplify_app.web.id
  domain_name = var.ses_sender_domain

  wait_for_verification  = false
  enable_auto_sub_domain = true

  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = var.amplify_domain_prefix
  }
}
