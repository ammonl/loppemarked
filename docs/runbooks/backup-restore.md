# Backup & Restore Runbook

## Overview

Both environments now run on **shared-db** — a shared RDS PostgreSQL instance
owned by the `infra-shared-db` repo:

| Environment | Shared-db credentials secret        |
|-------------|-------------------------------------|
| staging     | `rds/shared/loppemarked_staging`    |
| prod        | `rds/shared/loppemarked_prod`       |

Backups, automated-backup retention, and point-in-time restore for shared-db
are owned by `infra-shared-db` — **use its runbooks** for any backup or restore
operation. This repo no longer provisions a dedicated RDS instance for either
environment.

> The per-environment dedicated RDS instances were retired in #222 (staging in
> #282, prod after the #221 cutover). The point-in-time / snapshot restore
> procedures that lived here operated on those dedicated instances and no longer
> apply.

## Connecting to shared-db

Use `scripts/db-port-forward.sh` with the environment's shared-db secret (it
resolves `rds/shared/loppemarked_<env>` automatically):

```bash
./scripts/db-port-forward.sh -i <bastion-instance-id> -e prod
```

## Dedicated RDS retirement (#222) — reference

Recorded here for audit; no ongoing action.

- **Staging** (#282): retention was an explicit skip — the dedicated staging DB
  had been dormant since the 2026-06-01 shared-db cutover, held only non-prod
  data, and staging RDS skipped final snapshots. No snapshot or dump retained.
- **Prod** (#222): retention is satisfied by the #236 pre-cutover `pg_dump`. The
  retirement apply also takes the automatic final snapshot
  `loppemarked-prod-2026-final`.
  - **Prerequisite — deletion protection.** Prod RDS had
    `deletion_protection` enabled. Terraform cannot destroy a protected
    instance, so protection must be disabled on the instance before the
    retirement apply:
    ```bash
    aws rds modify-db-instance \
      --db-instance-identifier loppemarked-prod-2026-postgres \
      --no-deletion-protection --apply-immediately \
      --region eu-north-1
    ```
  - **Prerequisite — app-secrets KMS re-key.** The per-stack data KMS key is
    scheduled for deletion in the same change; the `loppemarked-prod-2026-app-secrets`
    secret moves to the AWS-managed `aws/secretsmanager` key. Changing a
    secret's KMS key does **not** re-encrypt existing versions, so re-put the
    live value first so the current version is encrypted under the new key
    before the data key is scheduled for deletion:
    ```bash
    # Re-put the current value so it re-encrypts under the new (AWS-managed) key.
    CURRENT=$(aws secretsmanager get-secret-value \
      --secret-id loppemarked-prod-2026-app-secrets \
      --query SecretString --output text --region eu-north-1)
    aws secretsmanager put-secret-value \
      --secret-id loppemarked-prod-2026-app-secrets \
      --secret-string "$CURRENT" --region eu-north-1
    ```
    KMS key deletion uses a recoverable window (default 30 days); use
    `aws kms cancel-key-deletion` if a rollback is needed within it.

## References

- Shared-db backup/restore: `infra-shared-db` repo runbooks
- Port-forward helper: `scripts/db-port-forward.sh`
- Incident triage: `docs/runbooks/incident-triage.md`
