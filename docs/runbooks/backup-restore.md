# Backup & Restore Runbook

## Overview

This runbook covers RDS automated backup management and point-in-time restore procedures for the UN17 Village Loppemarked PostgreSQL database.

> **Scope: prod dedicated RDS only.** Staging's dedicated RDS instance has been
> retired (#222); staging now runs on **shared-db** (`rds/shared/loppemarked_staging`),
> whose backups and restores are owned by the `infra-shared-db` repo — use its
> runbooks for staging. The procedures below apply to the **prod** dedicated RDS
> instance until it too is retired, after which prod also moves to shared-db.

## Backup Configuration

| Setting | Production (dedicated RDS) |
|---------|----------------------------|
| Backup retention | 35 days |
| Backup window | 03:00–04:00 UTC |
| Multi-AZ | Yes |
| Final snapshot on delete | Yes |
| Encryption | KMS (data key) |

Staging backups are managed by `infra-shared-db` (shared-db). Prod backups are
configured via Terraform in `infra/terraform/modules/loppemarked_stack/database.tf`.

## Listing Available Backups

```bash
aws rds describe-db-snapshots \
  --db-instance-identifier loppemarked-<environment>-2026-postgres \
  --query "DBSnapshots[*].{ID:DBSnapshotIdentifier,Created:SnapshotCreateTime,Status:Status}" \
  --output table \
  --region eu-north-1
```

## Point-in-Time Restore

RDS supports restoring to any point within the backup retention window.

### 1. Identify the target restore time

Determine the exact UTC timestamp to restore to. This is typically just before the data loss or corruption event.

### 2. Restore to a new instance

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier loppemarked-<environment>-2026-postgres \
  --target-db-instance-identifier loppemarked-<environment>-2026-postgres-restored \
  --restore-time "2026-03-01T12:00:00Z" \
  --db-instance-class db.t4g.small \
  --db-subnet-group-name loppemarked-<environment>-2026-db \
  --vpc-security-group-ids <db-security-group-id> \
  --no-multi-az \
  --region eu-north-1
```

**Important:** Always restore to a **new** instance. Never restore in-place on the production instance.

**Note:** The example uses `--no-multi-az` for faster initial restore. For production promotion, add `--multi-az` to match the production configuration.

### 3. Wait for the restored instance to become available

```bash
aws rds wait db-instance-available \
  --db-instance-identifier loppemarked-<environment>-2026-postgres-restored \
  --region eu-north-1
```

### 4. Verify restored data

Connect to the restored instance and verify:

```bash
psql -h <restored-endpoint> -U loppemarked -d loppemarked -c "
  SELECT COUNT(*) FROM registrations;
  SELECT COUNT(*) FROM emails;
  SELECT MAX(created_at) FROM audit_events;
"
```

Compare row counts and latest timestamps against expected values.

### 5. Promote restored instance (if applicable)

If the restored data is correct and you need to replace the primary:

1. Update the application to point to the restored instance endpoint.
2. Update Terraform state to adopt the restored instance (or rename it).
3. Delete the original (corrupted) instance once the restored one is confirmed working.

**For production restores, always get explicit approval before proceeding.**

### 6. Clean up

If the restore was a drill or the restored instance is no longer needed:

```bash
aws rds delete-db-instance \
  --db-instance-identifier loppemarked-<environment>-2026-postgres-restored \
  --skip-final-snapshot \
  --region eu-north-1
```

## Snapshot Restore

To restore from a specific snapshot instead of point-in-time:

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier loppemarked-<environment>-2026-postgres-restored \
  --db-snapshot-identifier <snapshot-identifier> \
  --db-instance-class db.t4g.small \
  --db-subnet-group-name loppemarked-<environment>-2026-db \
  --vpc-security-group-ids <db-security-group-id> \
  --region eu-north-1
```

## Restore Drill Schedule

Run a restore drill quarterly to verify backup integrity:

1. Restore the prod dedicated RDS to a new, throwaway instance (never in-place).
2. Verify data integrity (row counts, recent records).
3. Document results in a GitHub issue.
4. Delete the test instance.

Staging is on shared-db; its restore drills are covered by the `infra-shared-db` runbooks.

## References

- [RDS Point-in-Time Recovery](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)
- Database Terraform config: `infra/terraform/modules/loppemarked_stack/database.tf`
- Incident triage: `docs/runbooks/incident-triage.md`
