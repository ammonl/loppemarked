# PR Reviewer Memory — loppemarked

## Web app (apps/web, Next.js 15 / React 19 App Router)

See [web-app.md](web-app.md) — the `@un17/logo` web component migration (#278):
why the `"use client"` + `useEffect`-deferred `import("@un17/logo")` wrapper is
the SSR-safe pattern, the FOUC/CLS tradeoff it introduced, the package's
`connectedCallback` role/aria defaults and font requirements, the React 19 JSX
typing form, and the booking-success event bus it removed (don't confuse the
surviving `onBookingSuccess` prop in `TableMapPage.tsx` with it).

## CI workflows (.github/workflows)

See [ci-workflows.md](ci-workflows.md) — the `terraform.yml` deploy graph and its
`apply-prod` gate (including why un17-resources' `!cancelled()` +
`detect-staging.outputs.has_changes` form is the corrected one and greenspace's
`always()` + `result == 'skipped'` form is not), the `verify-staging` job's
requirements (`environment: staging` is load-bearing for the env-level
`API_FUNCTION_NAME`; `TF_ROLE_ARN_*` ≠ `DEPLOY_ROLE_ARN_*`), retry-budget
review guidance for pre-prod gates, `/public/status` vs `/health`, the Function
URL's trailing slash and `NONE` auth, `bash -e` behavior in `run:` blocks, and
the README/AGENTS.md sections that go stale when the promotion rule changes.
It also carries the exhaustive promote/block truth table for the current gate
(including the `has_changes`-unset fail-open) and the verified capabilities and
gaps of `scripts/check-promotion-gate.mjs` / `promotion-gate-rehearsal.yml`
(#313, PR #321) — read that before re-deriving GitHub expression semantics.

- **loppemarked's `terraform.yml` now matches un17-resources**, not greenspace:
  #316 (7bb7f75) brought over `!cancelled()`, the `has_changes` promote branch,
  and the 10-attempt/`--max-time 20`/`timeout-minutes: 10` verify budget. Older
  notes describing loppemarked's gate as the `always()` form are wrong.
- **Cross-repo review note:** loppemarked, greenspace and un17-resources run
  near-identical `terraform.yml`s. A PR that copies one sibling verbatim should
  be checked against the *other* one too — un17-resources' version generally
  carries later corrections, and its inline comments explain them.

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

### Bootstrap drift-detect role (removed — historical)
- `bootstrap/bootstrap_drift_detect_role.tf` no longer exists: #289 deleted the
  role + inline policy from configuration and dropped bootstrap from the
  `drift-detection.yml` matrix (staging + prod only since). Do not treat
  references to that file or to `bootstrap_drift_detect_role_arn` as live config.
- Deleting it from config could not delete it from AWS: CI never applies
  bootstrap (`terraform.yml` covers environments/{staging,prod} only), so the
  role sat orphaned in bootstrap state as 2 permanent pending destroys in every
  bootstrap plan until an operator apply (#305). Review lesson: a resource
  removal under `bootstrap/` is only half-done at merge — completion needs a
  manual operator `terraform apply`, and no automation detects the gap.

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
- `bootstrap/ci_terraform_role.tftest.hcl` (added #299/PR #308) allowlists the
  role's `ec2:`/`rds:` actions and asserts inline-policy size. CI (`infra-checks`,
  terraform **1.7.5**) runs `init -backend=false` + `validate` + `test` on
  bootstrap. Verified: `override_data`/`override_resource` work on 1.7.5 and the
  suite needs no AWS credentials.
- **Known holes in that guard** (verified empirically, still open unless fixed):
  a bare `Action: "*"` passes everything (`startswith(action, "ec2:")` filters it
  out); `"EC2:CreateVpc"` evades on case (IAM matches action prefixes
  case-insensitively). `"ec2:*"`/`"rds:*"` ARE caught. An `Allow` statement using
  `not_actions` fails closed but with an opaque "object does not have an
  attribute named Action" error and *skips* the remaining runs — don't "fix" that
  with `try()`/`lookup()`, which converts it to a silent pass.
  The guard reads only `ci_terraform_resources`, not `ci_terraform_state` nor the
  attached `ci_terraform_shared_network` managed policy.

### ci-terraform inline policy size
- IAM limit is **10,240 bytes aggregate per role, whitespace excluded**; one role
  per env (`aws_iam_role.ci_terraform` `for_each`) with exactly two inline
  policies (`terraform-state`, `terraform-resources`) + one attached managed
  policy (shared-network SSM, doesn't count).
- Measured (whitespace-stripped, prod): **main = 10183** (99.4% — genuinely at the
  limit), **after PR #308 = 7989**. Raw/pretty-printed the resources doc is 10155
  bytes, so never compare the un-stripped length against 10240.

### Provider API-call behavior when reviewing IAM pruning
- See [aws-provider-api-calls.md](aws-provider-api-calls.md) — verified call
  chains for `aws_security_group` (its **delete detaches+deletes lingering Lambda
  ENIs**, so `ec2:Detach/DeleteNetworkInterface` are required), SG create's
  default-egress revoke, `ModifySecurityGroupRules` for the rule resources, and
  proof that `aws_lambda_function` makes no EC2 calls at all. Includes the
  pclntab/objdump technique for checking this against the stripped provider binary.

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
  create `lambda_shared` egress-only SG in the shared VPC.
- **OUTDATED as of #299/PR #308 — do not re-flag:** `database.tf` and the RDS
  alarms/dashboard widgets in `monitoring.tf` are **gone**. As of that PR the
  module contains **no `aws_db_*`/`aws_rds_*` resource or data source at all**
  (`grep -rE '^(resource|data) "aws_(db|rds)' infra/` → nothing), and the env
  stacks' only data sources are SSM + the OIDC provider. Consequence: nothing in
  the configuration can emit an `rds:` call, so the surviving `RDSRead` statement
  in `ci_terraform_role.tf` is dead.
- **Monitoring blind spot still open (prod-relevant):** DB-tier alerting now
  lives nowhere in this repo. Confirm un17-infra-shared owns equivalent alarms
  for the shared instance, or file a follow-up.
- Parity nit: the staging cutover added an `api_lambda_security_group_id`
  output; the prod cutover omitted it. Cosmetic (operator convenience), not
  functional.
