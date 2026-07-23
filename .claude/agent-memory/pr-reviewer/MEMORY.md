# PR Reviewer Memory — loppemarked

## Infra / Terraform (infra/terraform/)

### Shared, cross-repo AWS resources
- The account-global **GitHub OIDC provider** (`token.actions.githubusercontent.com`)
  is owned/managed by the separate **un17hub** bootstrap repo. loppemarked
  consumes it read-only via `data "aws_iam_openid_connect_provider" "github"`
  (by `url`) in `bootstrap/main.tf` and the environment stacks — never as a
  managed `resource`. Managing it fights un17hub over tags/thumbprint.
- **Route 53 records** for `un17hub.com` are owned by the un17hub DNS repo.
  The loppemarked module (`modules/loppemarked_stack/dns.tf`) owns NO records;
  it exposes outputs (`ses_verification_token`, `ses_dkim_tokens`,
  `api_acm_validation`, `api_cloudfront_domain`/`_hosted_zone_id`) for that repo
  to publish. Exception: `aws_amplify_domain_association` self-provisions its
  own cert + records.

### Bootstrap drift-detect role
- `bootstrap/bootstrap_drift_detect_role.tf` is read-only; must carry IAM read
  perms for every data source read during `terraform plan -refresh-only`.
  OIDC data-source lookup by URL needs `iam:ListOpenIDConnectProviders` +
  `iam:GetOpenIDConnectProvider` + `iam:ListOpenIDConnectProviderTags` (present
  as the `OIDCProviderRead` statement).

### Recurring risk to watch for
- **Converting a managed `resource` to a `data` source** for a resource that is
  currently in state: removing the resource block makes the next `terraform
  apply` plan a DESTROY of the still-in-state object (and drops any
  `prevent_destroy`). For shared/account-global resources this is an
  account-wide outage. Prefer a Terraform 1.7+ `removed { ... lifecycle { destroy = false } }`
  block (needs `required_version >= 1.7.0`; repo is currently `>= 1.5.0`) over a
  documented manual `terraform state rm`.

### Testing
- IAM policies validated by `modules/loppemarked_stack/iam.tftest.hcl`
  (`terraform test`) — asserts no wildcard resources. New provider aliases must
  be declared in the test file too (`aws.us_east_1`).

## Shared-DB migration (#221 cutover, #223 umbrella, #267 VPC centralization)

- `scripts/db-migrate-parity.sh` gates the prod cutover: compares SOURCE vs TARGET
  conninfo on (1) public table-name set, (2) per-table row counts via a UNION ALL
  count query, (3) `kysely_migration` rows, (4) sample reads
  (`system_settings.opening_datetime`, `admins.email`). Exits 1 on mismatch, 2 on
  usage. Runbook: `docs/runbooks/shared-db-migration.md`.
- App auto-migrates on first boot (`migrateToLatestInline`,
  `apps/api/src/db/migration-registry.ts`); `kysely_migration` +
  `kysely_migration_lock` are carried by `pg_dump -Fc`, so the check exists to
  prove first-boot migration is a no-op. `kysely_migration_lock` is a single fixed
  row — safe to count, never diffs.
- Reviewer gotcha for this script family: source (dedicated prod RDS) and target
  (shared-db RDS) are different instances with **different passwords** — a single
  `PGPASSWORD` cannot auth both from one process; `~/.pgpass` (two entries by port)
  is the only viable path. Watch runbook examples that imply a single PGPASSWORD.
