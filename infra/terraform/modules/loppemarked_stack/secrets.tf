# ---------- Application Secrets ----------
#
# Application-scoped runtime secrets. This outlived the dedicated RDS instance
# (retired in #222) and is the only per-stack secret this module still owns; the
# DB connection now comes entirely from the shared-db credentials secret owned by
# infra-shared-db (var.db_secret_id).
#
# Encrypted with the AWS-managed `aws/secretsmanager` key. The per-stack data CMK
# that previously encrypted this secret (and the retired dedicated RDS + DB
# credentials secret) is scheduled for deletion in #222 — no per-stack CMK is
# needed for a single application secret. Changing a secret's KMS key does not
# re-encrypt existing versions, so the live version must be re-put under the
# AWS-managed key (see docs/runbooks/backup-restore.md) before the data CMK is
# deleted.

resource "aws_secretsmanager_secret" "app" {
  name        = "${local.naming_prefix}-app-secrets"
  description = "Application secrets for ${local.naming_prefix}"

  tags = {
    Name = "${local.naming_prefix}-app-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  secret_string = jsonencode({
    placeholder = "replace-with-real-values"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
