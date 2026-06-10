# Prod Shared-DB Migration Host Runbook

## Overview

A temporary, SSM-accessed EC2 host in a **prod private subnet** that can run the
PostgreSQL 16 client tools (`psql`, `pg_dump`, `pg_restore`) against **both**
databases in the prod shared-db migration:

- the **dedicated prod RDS** (lives in the prod VPC), and
- the **shared-db prod database** `rds/shared/loppemarked_prod` (shared-db VPC,
  reachable from the prod VPC over the Phase B peering link).

The host has **no public IP** and **no inbound** security-group rules; it is
reached exclusively through **SSM Session Manager**. It is provisioned by
Terraform, gated off by default, and torn down by flipping the gate back. Defined
in `infra/terraform/modules/loppemarked_stack/migration_host.tf`.

## Prerequisites

- The bootstrap stack has been applied with admin credentials **after** the
  EC2-compute / instance-profile / SSM-parameter permissions were added to the
  CI Terraform role (`infra/terraform/bootstrap/ci_terraform_role.tf`). Bootstrap
  is applied separately so the CI role's new permissions are in effect before the
  prod apply tries to use them (IAM eventual-consistency, see #181).
- Requester-side peering for prod is in place (already applied as part of #221's
  Phase B wiring — `peering.tf`).
- The shared-db Phase C accepter-side ingress is in place: the shared-db prod RDS
  SG must allow the prod VPC CIDR `10.1.0.0/16`. Verify before standing the host
  up:

  ```bash
  aws ec2 describe-security-groups \
    --filters "Name=ip-permission.cidr,Values=10.1.0.0/16" \
    --query "SecurityGroups[].GroupId" --output text --region eu-north-1
  ```

- `aws` CLI with the Session Manager plugin installed locally, authenticated to
  the prod account.

## 1. Stand the host up

In `infra/terraform/environments/prod/main.tf`, set the module input:

```hcl
enable_db_migration_host = true
```

Apply via the normal prod Terraform pipeline (or locally against the prod state).
This creates: the instance, its egress-only SG, an instance profile with
`AmazonSSMManagedInstanceCore` + scoped `secretsmanager:GetSecretValue`, the
`ssm` / `ssmmessages` / `ec2messages` interface endpoints and the S3 gateway
endpoint (so a no-internet private subnet can run Session Manager and
`dnf install postgresql16`), and an ingress rule letting the host reach the
dedicated prod RDS on 5432.

Capture the instance id from the output:

```bash
terraform output -raw db_migration_host_instance_id
```

The PostgreSQL 16 client is installed by the host's user-data on first boot; give
it a minute after the instance reaches `running`.

## 2. Open a session

```bash
aws ssm start-session --target <instance-id> --region eu-north-1
```

Confirm the client tools and version (must be **16**, version-matched to the
engine):

```bash
psql --version      # psql (PostgreSQL) 16.x
pg_dump --version
```

## 3. Retrieve credentials

The instance role can read the dedicated and shared-db secrets. From the session:

```bash
# Dedicated prod RDS
aws secretsmanager get-secret-value \
  --secret-id loppemarked-prod-2026-db-credentials \
  --query SecretString --output text --region eu-north-1

# Shared-db prod
aws secretsmanager get-secret-value \
  --secret-id rds/shared/loppemarked_prod \
  --query SecretString --output text --region eu-north-1
```

Each payload contains `host`, `port`, `dbname`/`database`, `username`, and
`password`. Export them as `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` /
`PGDATABASE` (or pass `psql "postgresql://..."`) rather than putting the password
on the command line.

> If `get-secret-value` on the shared-db secret fails with an
> `AccessDeniedException` referencing KMS, the shared-db secret is encrypted with
> a CMK whose key policy must grant this host's role
> (`loppemarked-prod-2026-migration-host`) `kms:Decrypt`. That key policy is owned
> by `infra-shared-db`; coordinate the grant there.

## 4. Verify connectivity (acceptance criteria)

```bash
# Dedicated prod
PGPASSWORD=... psql -h <dedicated-host> -p 5432 -U <user> -d <dbname> -c "select version();"

# Shared-db prod over the peering link
PGPASSWORD=... psql -h <shared-host> -p 5432 -U <user> -d <dbname> -c "select version();"
```

Both should return the server version without timing out. A timeout against the
shared-db host almost always means the accepter-side SG ingress for `10.1.0.0/16`
(Prerequisites) is missing.

## 5. Run the data move

`pg_dump` from the dedicated prod DB and `pg_restore` into the shared-db prod DB
(or pipe directly) per the migration-rehearsal ticket. Stage dumps under the root
volume (default 50 GB; size via `db_migration_host_volume_size` if a larger dump
is expected).

## 6. Teardown

The host is temporary. When the move (and its verification) is complete:

1. Set `enable_db_migration_host = false` in `prod/main.tf`.
2. Apply. This destroys the instance, instance profile, SG, the SSM/S3 endpoints,
   and the dedicated-DB ingress rule — leaving no standing access path or hourly
   endpoint cost.

Nothing else depends on the host; the runtime data path and the shared-db cutover
wiring are untouched by enabling or disabling it.
