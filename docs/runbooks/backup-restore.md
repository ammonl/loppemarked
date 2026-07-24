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
  - **Prerequisite — app-secrets KMS re-key.** The retirement apply both moves
    the `loppemarked-prod-2026-app-secrets` secret to the AWS-managed
    `aws/secretsmanager` key **and** schedules the per-stack data KMS key for
    deletion (which disables the key immediately, before its recovery window).
    Changing a secret's KMS key does **not** re-encrypt existing versions, and
    the apply gives no safe in-flight window for a manual step — so complete the
    re-key **out-of-band before applying**, in this order, so the live version is
    already under the AWS-managed key by the time the data key is deleted:
    ```bash
    SECRET=loppemarked-prod-2026-app-secrets
    # 1. Point the secret at the AWS-managed key (matches what this apply sets).
    aws secretsmanager update-secret \
      --secret-id "$SECRET" --kms-key-id alias/aws/secretsmanager \
      --region eu-north-1
    # 2. Re-put the current value so the LIVE version re-encrypts under that key
    #    (step 1 alone does not re-encrypt existing versions).
    CURRENT=$(aws secretsmanager get-secret-value \
      --secret-id "$SECRET" --query SecretString --output text --region eu-north-1)
    aws secretsmanager put-secret-value \
      --secret-id "$SECRET" --secret-string "$CURRENT" --region eu-north-1
    # 3. Verify the value still decrypts, then apply #222.
    aws secretsmanager get-secret-value --secret-id "$SECRET" --region eu-north-1 >/dev/null && echo OK
    ```
    After steps 1–3 the apply sees the secret already on the AWS-managed key (no
    change) and only schedules the now-unused data key for deletion. KMS deletion
    uses a recoverable window (default 30 days); `aws kms cancel-key-deletion`
    reverses it within that window. Note the secret currently holds only a
    placeholder and has no deployed runtime consumer, so the blast radius of a
    mis-ordered re-key is contained — but follow the order regardless.

## References

- Shared-db backup/restore: `infra-shared-db` repo runbooks
- Port-forward helper: `scripts/db-port-forward.sh`
- Incident triage: `docs/runbooks/incident-triage.md`
