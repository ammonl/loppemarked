# ---------- KMS Key for data encryption (RDS + Secrets Manager) ----------
#
# Part of the dedicated stack: it encrypts the dedicated RDS instance and the
# dedicated DB credentials secret (and, while the dedicated stack exists, the
# app-secrets secret). Retired together with the dedicated DB — destroying the
# key schedules it for deletion via KMS's pending-window.

resource "aws_kms_key" "data" {
  count = local.dedicated_count

  description         = "Encryption key for ${local.naming_prefix} data (RDS, Secrets Manager)"
  enable_key_rotation = true

  tags = {
    Name = "${local.naming_prefix}-data-key"
  }
}

resource "aws_kms_alias" "data" {
  count = local.dedicated_count

  name          = "alias/${local.naming_prefix}-data"
  target_key_id = aws_kms_key.data[0].key_id
}

# ---------- DB Subnet Group ----------

resource "aws_db_subnet_group" "main" {
  count = local.dedicated_count

  name       = "${local.naming_prefix}-db"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.naming_prefix}-db-subnet-group"
  }

  # A DB subnet group's VPC is immutable: when a re-IP moves the private subnets
  # into a new VPC, AWS rejects an in-place ModifyDBSubnetGroup ("new Subnets are
  # not in the same Vpc"). Force a replace on a VPC id change so the group is
  # recreated in the new VPC instead. The RDS instance (which also replaces on
  # the VPC id) is torn down first, so the old group is free to be destroyed.
  lifecycle {
    replace_triggered_by = [aws_vpc.main]
  }
}

# ---------- RDS Parameter Group ----------

resource "aws_db_parameter_group" "postgres" {
  count = local.dedicated_count

  name   = "${local.naming_prefix}-postgres"
  family = "postgres16"

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = {
    Name = "${local.naming_prefix}-postgres-params"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ---------- DB Credentials Secret ----------

resource "random_password" "db_master" {
  count = local.dedicated_count

  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_credentials" {
  count = local.dedicated_count

  name        = "${local.naming_prefix}-db-credentials"
  description = "RDS PostgreSQL master credentials for ${local.naming_prefix}"
  kms_key_id  = aws_kms_key.data[0].arn

  tags = {
    Name = "${local.naming_prefix}-db-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  count = local.dedicated_count

  secret_id = aws_secretsmanager_secret.db_credentials[0].id

  secret_string = jsonencode({
    username = var.db_master_username
    password = random_password.db_master[0].result
    engine   = "postgres"
    host     = aws_db_instance.main[0].address
    port     = aws_db_instance.main[0].port
    dbname   = var.db_name
  })
}

# ---------- Application Secrets ----------
#
# Application-scoped (not DB-scoped), so it outlives the dedicated DB. Its
# encryption key follows local.app_secret_kms_key_arn: the data KMS key while the
# dedicated stack exists, the logs KMS key once the data key is retired.

resource "aws_secretsmanager_secret" "app" {
  name        = "${local.naming_prefix}-app-secrets"
  description = "Application secrets for ${local.naming_prefix}"
  kms_key_id  = local.app_secret_kms_key_arn

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

# ---------- RDS PostgreSQL Instance ----------

resource "aws_db_instance" "main" {
  count = local.dedicated_count

  identifier = "${local.naming_prefix}-postgres"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.data[0].arn

  db_name  = var.db_name
  username = var.db_master_username
  password = random_password.db_master[0].result

  multi_az               = var.db_multi_az
  db_subnet_group_name   = aws_db_subnet_group.main[0].name
  vpc_security_group_ids = [aws_security_group.db[0].id]
  parameter_group_name   = aws_db_parameter_group.postgres[0].name

  backup_retention_period   = var.db_backup_retention_days
  backup_window             = "03:00-04:00"
  maintenance_window        = "mon:04:30-mon:05:30"
  copy_tags_to_snapshot     = true
  delete_automated_backups  = var.environment != "prod"
  deletion_protection       = var.db_deletion_protection != null ? var.db_deletion_protection : var.environment == "prod"
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${local.naming_prefix}-final" : null

  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.data[0].arn
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_monitoring[0].arn

  apply_immediately = var.environment != "prod"

  tags = {
    Name = "${local.naming_prefix}-postgres"
  }

  # A VPC re-IP replaces the VPC and its private subnets. The instance cannot
  # stay in subnets that are being destroyed, so it is torn down and recreated
  # (empty) in the new subnets. Tying replacement to the VPC id makes Terraform
  # destroy the instance before the old subnets, instead of deadlocking on the
  # subnet delete while the RDS ENI is still attached. staging skips the
  # automatic final snapshot, so take a manual snapshot before a re-IP apply
  # (the static identifier path would otherwise collide on a re-run).
  lifecycle {
    replace_triggered_by = [aws_vpc.main]
  }
}

# ---------- RDS Enhanced Monitoring Role ----------

data "aws_iam_policy_document" "rds_monitoring_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_monitoring" {
  count = local.dedicated_count

  name               = "${local.naming_prefix}-rds-monitoring"
  assume_role_policy = data.aws_iam_policy_document.rds_monitoring_assume.json

  tags = {
    Name = "${local.naming_prefix}-rds-monitoring"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count = local.dedicated_count

  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
