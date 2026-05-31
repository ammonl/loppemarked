# ---------- Lambda Function ----------

resource "aws_lambda_function" "api" {
  function_name = "${local.naming_prefix}-api"
  role          = aws_iam_role.api_runtime.arn
  runtime       = "nodejs24.x"
  handler       = "index.handler"
  filename      = "${path.module}/files/api-placeholder.zip"

  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.api.id]
  }

  environment {
    # DB_SECRET_ID is injected only when an environment opts into the shared-db
    # secret. While absent, the runtime uses the dedicated DB env vars below.
    variables = merge(
      {
        DB_HOST        = aws_db_instance.main.address
        DB_PORT        = tostring(aws_db_instance.main.port)
        DB_NAME        = var.db_name
        DB_USER        = var.db_master_username
        DB_SECRET_ARN  = aws_secretsmanager_secret.db_credentials.arn
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
    # A VPC re-IP replaces the private subnets this function attaches to. Its
    # hyperplane ENIs must leave the old subnets before they can be deleted, so
    # recreate the function on a VPC id change rather than deadlocking the
    # subnet delete on still-attached Lambda ENIs.
    replace_triggered_by = [aws_vpc.main.id]
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
