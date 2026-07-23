# Shared-DB Migration Runbook — Prod Data Load

## Overview

This runbook covers loading the production Loppemarked data from its **dedicated**
RDS instance into the shared database `rds/shared/loppemarked_prod`, as Phase D of
the shared-db migration ([#223](https://github.com/ammonl/loppemarked/issues/223)).
It is the mechanical procedure invoked during the
[#221](https://github.com/ammonl/loppemarked/issues/221) prod cutover window.

The data load is **non-destructive** to the dedicated prod DB: it survives untouched
until a later phase, so a botched load or a failed parity check is recovered by
retrying the load, not by a restore. The dedicated DB is the source during a short
write-freeze; there is no snapshot→temp-instance restore and no prod re-IP.

The flow is three decoupled steps plus a gate:

```
dump (dedicated prod)  →  transfer (S3, optional)  →  load (shared-db)  →  parity check
```

Under VPC centralization ([#267](https://github.com/ammonl/loppemarked/issues/267))
no single network position reaches both databases (the 10.1 CIDR collision made
peering between them impossible), so the dump and the load run from different
positions and the artifact is carried across.

## Prerequisites

- `aws` CLI v2 with the `session-manager-plugin`, plus `jq` and PostgreSQL 16
  client tools (`pg_dump`, `pg_restore`, `psql`) — the dump/restore version must be
  **≥ the server version** on both databases (both are Postgres 16).
- AWS credentials with access to the dedicated-prod SSM bastion + Secrets Manager,
  and (separately) to the shared-db SSM bastion.
- The shared-db credentials secret `rds/shared/loppemarked_prod` already provisioned
  by infra-shared-db, and the shared-db bastion instance id.

## Migration-tracking note

The app runs `migrateToLatestInline` on first boot
(`apps/api/src/db/migration-registry.ts`). Kysely tracks applied migrations in the
`kysely_migration` table (with a `kysely_migration_lock` companion). Because a
`pg_dump -Fc` of the dedicated prod DB carries `kysely_migration` and its rows,
loading it into shared-db makes the app's first-boot migration a **no-op** — that
parity is checked explicitly in step 4. `seed.ts` is insert-only and therefore a
safe skip on the real load; do **not** run `db:setup` against the loaded target.

## Step 1 — Dump the dedicated prod DB

Freeze writes first (announce the maintenance window, or disable writes) so the dump
is a consistent point-in-time snapshot of a quiet database.

Open an SSM port-forward to the dedicated prod DB in one terminal:

```bash
./scripts/db-port-forward.sh -i <dedicated-prod-bastion-instance-id> -e prod -p 15432
```

In a second terminal, dump via the tunnel. `-Fc` (custom format) is compressed and
restore-order-safe; `--no-owner --no-privileges` drops the dedicated-DB role grants
so the restore doesn't depend on shared-db having the same roles:

```bash
PGPASSWORD='<dedicated-prod-password>' \
  pg_dump -Fc --no-owner --no-privileges \
    "host=127.0.0.1 port=15432 dbname=<dedicated-dbname> user=<dedicated-user> sslmode=require" \
    -f loppemarked_prod.dump
```

Record the dump size (`ls -la loppemarked_prod.dump`) and the elapsed time.

## Step 2 — Transfer (optional)

If the dump and the load run from the **same** operator machine (it can port-forward
to both bastions), skip this — the file is already local.

Otherwise bounce the artifact through an encrypted S3 bucket, and delete it right
after the load:

```bash
aws s3 cp loppemarked_prod.dump \
  s3://<encrypted-transfer-bucket>/loppemarked_prod.dump \
  --sse aws:kms --region eu-north-1

# on the load host:
aws s3 cp s3://<encrypted-transfer-bucket>/loppemarked_prod.dump . --region eu-north-1
```

The dump contains full production PII (names, addresses, emails). Use a bucket with
default KMS encryption and a short lifecycle expiry, and remove the object as soon as
the load + parity check pass:

```bash
aws s3 rm s3://<encrypted-transfer-bucket>/loppemarked_prod.dump --region eu-north-1
```

## Step 3 — Load into shared-db

The target `rds/shared/loppemarked_prod` must be **empty** (fresh logical DB) before
loading. Port-forward to the shared-db bastion:

```bash
./scripts/db-port-forward.sh -i <shared-db-bastion-instance-id> -e prod -p 15433
```

> The port-forward helper resolves credentials from the dedicated-DB secret naming.
> For shared-db, read the endpoint/credentials from the `rds/shared/loppemarked_prod`
> secret instead:
>
> ```bash
> aws secretsmanager get-secret-value --region eu-north-1 \
>   --secret-id rds/shared/loppemarked_prod --query SecretString --output text | jq .
> ```

Restore. `--exit-on-error` fails loudly on the first problem instead of leaving a
half-loaded target; `--no-owner --no-privileges` matches the dump flags:

```bash
PGPASSWORD='<shared-db-password>' \
  pg_restore --no-owner --no-privileges --exit-on-error \
    -d "host=127.0.0.1 port=15433 dbname=loppemarked_prod user=<shared-db-user> sslmode=require" \
    loppemarked_prod.dump
```

Record the restore elapsed time.

## Step 4 — Parity check (gate before the flip)

Run the scripted parity check with **both** tunnels open. It compares the public
table set, per-table row counts, the `kysely_migration` history, and sample app
reads (`system_settings.opening_datetime`, admin emails), and exits non-zero on any
mismatch:

```bash
PGPASSWORD='<passwords-via-pgpass-or-per-call>' \
  ./scripts/db-migrate-parity.sh \
    "host=127.0.0.1 port=15432 dbname=<dedicated-dbname> user=<dedicated-user> sslmode=require" \
    "host=127.0.0.1 port=15433 dbname=loppemarked_prod user=<shared-db-user> sslmode=require"
```

`PARITY OK` (exit 0) is the green light. **Only then** proceed to the single
Terraform apply in [#221](https://github.com/ammonl/loppemarked/issues/221) that
flips `db_secret_id = "rds/shared/loppemarked_prod"` and moves the prod Lambda into
the shared subnets. On `PARITY FAILED`, do not flip: drop and recreate the target
logical DB and re-run the load.

Because the parity check queries both databases live over the tunnels, run it before
the write-freeze is lifted so the source is still quiescent.

## Rollback

The load itself has no rollback because it is non-destructive to the source — a bad
load is retried, not reverted. The overall cutover rollback lives in
[#221](https://github.com/ammonl/loppemarked/issues/221): revert the Terraform apply
(`db_secret_id` back to null, Lambda back to the dedicated VPC). The dedicated prod
DB stays authoritative until a later phase, so rollback is a config revert, not a
restore.

## Rehearsal & timing

The full flow was rehearsed end to end against scratch logical DBs (`src_prod` →
`tgt_shared`) seeded from the app's own migrations (`db:setup`) plus representative
rows, using the exact commands above. Both the happy path (parity OK) and a
perturbed target (an extra row and a stray table) were exercised; the parity script
correctly gated the perturbed case with a non-zero exit.

Measured on the rehearsal dataset (13 tables, ~40 data rows, 27 KB custom-format
dump):

| Step | Elapsed |
|------|---------|
| `pg_dump -Fc` | ~0.15 s |
| `pg_restore` | ~0.25 s |
| parity check (4 comparisons, both DBs) | ~0.4 s |

**Prod window sizing for [#221](https://github.com/ammonl/loppemarked/issues/221):**
production is a small dataset (tens of registrations, tens of emails, a fixed 24-row
`tables`), the same order of magnitude as the rehearsal. Dump + restore + parity is
**seconds to low single-digit minutes** of active work; the write-freeze window is
dominated by human coordination (announcing the freeze, opening both tunnels,
eyeballing the parity output), not by the transfer. Budget a **~15-minute** freeze
window end to end — comfortably minutes, not hours — with almost all of it slack.

## References

- Parity script: `scripts/db-migrate-parity.sh`
- Port-forward helper: `scripts/db-port-forward.sh`
- Cutover ticket (real load happens there): [#221](https://github.com/ammonl/loppemarked/issues/221)
- Migration umbrella: [#223](https://github.com/ammonl/loppemarked/issues/223)
- Backup & restore: `docs/runbooks/backup-restore.md`
