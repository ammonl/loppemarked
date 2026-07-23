# ---------- Lambda Function ----------

resource "aws_lambda_function" "api" {
  function_name = "${local.naming_prefix}-api"
  role          = aws_iam_role.api_runtime.arn
  runtime       = "nodejs24.x"
  handler       = "index.handler"
  filename      = "${path.module}/files/api-placeholder.zip"

  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout

  # In shared-tenancy mode the function attaches to the shared default VPC's
  # published private subnets with its own egress-only group; otherwise it uses
  # this stack's dedicated private subnets and API security group.
  vpc_config {
    subnet_ids         = local.shared_tenancy ? var.shared_private_subnet_ids : aws_subnet.private[*].id
    security_group_ids = local.shared_tenancy ? aws_security_group.lambda_shared[*].id : aws_security_group.api[*].id
  }

  environment {
    # The dedicated DB env vars exist only while the dedicated RDS instance does;
    # once retired the runtime is entirely on the shared-db secret. DB_SECRET_ID
    # is injected whenever an environment opts into the shared-db secret and, when
    # present, is the only DB source the runtime reads. DB_SSL applies to both
    # paths, so it stays set regardless.
    variables = merge(
      local.dedicated_active ? {
        DB_HOST       = aws_db_instance.main[0].address
        DB_PORT       = tostring(aws_db_instance.main[0].port)
        DB_NAME       = var.db_name
        DB_USER       = var.db_master_username
        DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials[0].arn
      } : {},
      {
        DB_SSL         = "true"
        ENVIRONMENT    = var.environment
        EMAIL_FROM     = coalesce(var.ses_sender_email, "loppemarked@${var.ses_sender_domain}")
        EMAIL_REPLY_TO = var.ses_reply_to_email
        PUBLIC_WEB_URL = "https://${var.amplify_domain_prefix}.${var.ses_sender_domain}"
      },
      var.db_secret_id != null ? { DB_SECRET_ID = var.db_secret_id } : {}
    )
  }

  reserved_concurrent_executions = var.lambda_reserved_concurrency

  logging_config {
    log_group  = aws_cloudwatch_log_group.api.name
    log_format = "JSON"
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
    # A dedicated-VPC re-IP replaces the private subnets this function attaches
    # to. Its hyperplane ENIs must leave the old subnets before they can be
    # deleted, so recreate the function on a VPC change rather than deadlocking
    # the subnet delete on still-attached Lambda ENIs. This function is always
    # created, so it cannot reference the count-gated aws_vpc.main directly (once
    # the VPC is retired every later plan would error "no change found for
    # aws_vpc.main"). terraform_data.vpc_identity is the always-present indirection:
    # it carries the VPC id (null when retired), so this still fires on a re-IP and
    # resolves cleanly with no dedicated VPC.
    replace_triggered_by = [terraform_data.vpc_identity]

    precondition {
      condition     = !local.shared_tenancy || length(var.shared_private_subnet_ids) > 0
      error_message = "shared_private_subnet_ids must be non-empty when shared_vpc_id is set (shared-tenancy mode)."
    }

    precondition {
      condition     = !var.retire_dedicated_db_and_vpc || (local.shared_tenancy && var.db_secret_id != null)
      error_message = "retire_dedicated_db_and_vpc requires shared_vpc_id (Lambda in the shared VPC) and db_secret_id (runtime on shared-db) to be set first."
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.api_basic_execution,
    aws_iam_role_policy_attachment.api_vpc_access,
  ]

  tags = {
    Name = "${local.naming_prefix}-api"
  }
}

# ---------- Lambda Function URL ----------

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}

# ---------- Session Cleanup Schedule ----------

resource "aws_cloudwatch_event_rule" "session_cleanup" {
  name                = "${local.naming_prefix}-session-cleanup"
  description         = "Trigger expired session cleanup every hour"
  schedule_expression = "rate(1 hour)"

  tags = {
    Name = "${local.naming_prefix}-session-cleanup"
  }
}

resource "aws_cloudwatch_event_target" "session_cleanup" {
  rule = aws_cloudwatch_event_rule.session_cleanup.name
  arn  = aws_lambda_function.api.arn

  retry_policy {
    maximum_retry_attempts       = 2
    maximum_event_age_in_seconds = 3600
  }
}

resource "aws_lambda_permission" "session_cleanup" {
  statement_id  = "AllowEventBridgeSessionCleanup"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.session_cleanup.arn
}
