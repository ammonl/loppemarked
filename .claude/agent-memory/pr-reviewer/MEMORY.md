# PR Reviewer Memory — loppemarked

## Web app (apps/web, Next.js 15 / React 19 App Router)

### `@un17/logo` web component (#278 logo migration)
- App consumes the shared `<un17-logo>` custom element via a `"use client"`
  wrapper `Un17Logo.tsx` that defers `import("@un17/logo")` into a `useEffect`
  — the package bundle runs browser-only code (`class extends HTMLElement`,
  `customElements.define`), so a top-level/static import would `ReferenceError`
  during SSR. The effect-deferred import is the correct SSR-safe pattern.
- Consequence/tradeoff to flag on any change here: `<un17-logo>` is EMPTY in the
  SSR HTML and until the dynamic chunk resolves post-hydration → logo is absent
  on first paint, then pops in with no reserved space (FOUC/CLS). The old inline
  BrandLogo rendered its SVG server-side. No width/height reserves box space.
- Package internals (`node_modules/@un17/logo/un17-logo.js`, v1.0.3):
  `connectedCallback` sets `role="img"` + `aria-label="UN17 Village"` UNLESS the
  host already has them; guards define with `if (!customElements.get(...))`
  (double-mount safe). Header uses `#8DA88D` (=theme `fleaSage`), footer
  `#C6705D` (=`fleaTerracotta`) — colors match theme tokens. Requires the host
  page to load "Amatic SC" + "Caveat" fonts (loaded in `app/layout.tsx` Google
  Fonts link; document-level @font-face is visible inside the shadow root).
- Accessibility: header passes `aria-hidden` (parent button self-labels via
  `aria-label={t("common.appName")}`) — aria-hidden prunes the subtree so the
  component's own role/aria-label are harmlessly overridden. Footer passes
  nothing → relies on the component's default role=img/aria-label (parity with
  old BrandLogo). JSX typing uses `declare module "react" { namespace JSX {
  interface IntrinsicElements }}` — correct React 19 form (global `JSX` ns
  deprecated); a `declare module "@un17/logo";` stub covers the untyped package.
- Removed booking-success event bus (`utils/brandEvents.ts`,
  `emitBookingSuccess`/`onBookingSuccess`): its ONLY consumer was BrandLogo's
  wiggle-on-booking effect. Migration dropped both cleanly (no dangling
  consumers). `onBookingSuccess` prop in `TableMapPage.tsx` is UNRELATED (a
  local success callback), not the deleted event bus — don't confuse them.

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
- **Trust policy is OIDC-only**: `sts:AssumeRoleWithWebIdentity` from the GitHub
  federated provider with `sub` StringEquals `repo:<repo>:ref:refs/heads/main`.
  No operator/admin principal → a human at a terminal CANNOT assume it. Flag any
  doc/comment that calls it a role "for manual drift checks" (#288/PR #289 did).
- Since #288 the role is assumed by NO workflow — drift-detection.yml's matrix is
  staging + prod only. Kept in config deliberately; see prevent_destroy note below.

### `prevent_destroy` does NOT survive removal from configuration
- Verified empirically (tf 1.15.8, `terraform_data` + `prevent_destroy = true`,
  applied then deleted the block): plan is `0 to add, 0 to change, 1 to destroy`
  with **no error**. The orphan destroy node has no config attached, so the
  prevent_destroy check is skipped entirely. Matches upstream docs.
- So "we kept the dead resource because removing the block would error out on
  prevent_destroy" is a WRONG rationale — removing the block silently destroys.
  Correct mechanism, already used in this repo: a `removed { from = ...
  lifecycle { destroy = false } }` block (`bootstrap/main.tf`).
- `infra/terraform/bootstrap/main.tf` has `required_version = ">= 1.7.0"`, so
  `removed` blocks are available there (env stacks may still be lower — check).

### count-gating an existing single resource (retirement PRs, e.g. #222)
- **`replace_triggered_by = [aws_resource.x]` (whole resource) to a count-gated
  resource is a TRAP when x can reach count=0.** Verified empirically (tf
  v1.15.8): once x has zero instances AND is absent from state, every subsequent
  `terraform plan` errors `no change found for aws_resource.x in the root module`.
  `[aws_resource.x[0]]` fails the same way at count=0. The transition apply
  (present→count=0) succeeds; it's steady-state plans (daily drift detection,
  next PR) that wedge. Only bites when the resource CARRYING the lifecycle block
  is itself un-gated (always present). If the carrier is also count-gated to 0,
  its lifecycle isn't evaluated so no error. Fix: route the trigger through a
  `terraform_data`/null_resource whose input is `one(aws_resource.x[*].id)`
  (null-safe at count 0), or drop the trigger for retired envs.
- **Adding `count` to a previously count-less resource does NOT need a `moved`
  block for the no-key→[0] no-op** — tf auto-detects the move (`has moved to
  ...[0]`, 0 changed). So missing `moved` blocks are not a prod-destroy bug; the
  ones authors add are belt-and-suspenders. `terraform validate` passes
  regardless (it never reads state), so neither issue above shows up in validate.
- `one(resource[*].attr)` returns null at count 0 (safe); a `cond ? one(x[*]) : y`
  local is safe because `one([])`=null doesn't error even on the dead branch.
- Secrets Manager KMS re-key (data key → logs key on a not-gated secret while the
  data key is destroyed): the existing AWSCURRENT version was written under the
  old key. Terraform has NO dependency edge from the key-destroy to the secret
  update once the secret stops referencing the key, so re-encryption ordering vs.
  ScheduleKeyDeletion (PendingDeletion disables the key) is not guaranteed — flag
  as an ordering risk to verify / pre-rotate.

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

### Shared-tenancy cutover mechanics (env `main.tf`: shared_vpc_id/db_secret_id)
- The env-level cutover is minimal and safe: uncomment the two
  `/shared/network/*` SSM data sources, set `shared_vpc_id` +
  `shared_private_subnet_ids` + `db_secret_id`, and DROP `shared_db_vpc_id` /
  `shared_db_vpc_cidr`. Dropping the peering vars is safe because
  `create_peering = shared_db_vpc_id != null && !shared_tenancy` — setting
  `shared_vpc_id` forces peering off regardless. Peering vars default null, so
  omitting them is not a missing-required-var error.
- Expected plan footprint (matches staging PR #277): in-place Lambda
  `vpc_config` update (NOT a replacement — `replace_triggered_by` is the
  dedicated `aws_vpc.main.id`, unchanged); destroy peering conn/options/route;
  destroy the `[0]` VPC interface endpoints (SES, Secrets Manager) + their SG;
  create `lambda_shared` egress-only SG in the shared VPC. `database.tf`
  untouched — dedicated RDS stays dormant (retired in #222).
- **Monitoring blind spot (prod-relevant):** the RDS alarms
  (`rds_cpu`/`rds_freeable_memory`/`rds_connections`) and dashboard RDS widgets
  in `monitoring.tf` are dimensioned on `aws_db_instance.main.identifier` — the
  DEDICATED instance. After cutover, real DB load is on shared-db (not in this
  stack), so these alarms watch an idle instance and go silently green. Staging
  masked this (`enable_observability_alerts=false`); PROD has alerts ON, so the
  cutover silently drops DB-tier alerting. Confirm un17-infra-shared owns
  equivalent alarms or file a follow-up.
- Parity nit: the staging cutover added an `api_lambda_security_group_id`
  output; the prod cutover omitted it. Cosmetic (operator convenience), not
  functional.
