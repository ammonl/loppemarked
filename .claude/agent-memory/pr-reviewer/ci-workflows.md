# CI workflows (.github/workflows) — verified facts

## `terraform.yml` deploy pipeline shape

`detect-staging` + `detect-prod` (parallel, `-detailed-exitcode` → `has_changes`)
→ `apply-staging` (`if: needs.detect-staging.outputs.has_changes == 'true'`)
→ `verify-staging` (added #313) → `apply-prod`.

Only `environments/{staging,prod}` are ever applied by CI — `bootstrap/` is
**never** applied by any workflow. Consequence for review: any workflow step that
depends on a *newly granted* IAM permission in `bootstrap/ci_terraform_role.tf`
is live only if an operator has applied bootstrap since. Verify before merging
anything that would otherwise fail every run.

### The `apply-prod` gate, and how the three sibling repos differ

`apply-prod`'s `if:` must stay true when upstream jobs are *skipped* (the
"staging had no changes of its own" promotion path), which is why it can't use
the default `success()`. Two forms exist across the repos:

- greenspace + loppemarked: `always() && ... && (needs.apply-staging.result ==
  'skipped' || (apply-staging == 'success' && verify-staging == 'success'))`
- un17-resources: `!cancelled() && ... && (needs.detect-staging.outputs.has_changes
  != 'true' || (apply-staging == 'success' && verify-staging == 'success'))`

un17-resources' form is the corrected one, for two documented reasons:

1. **`always()` runs the job even when the workflow run is cancelled** — so an
   operator who cancels a bad deploy can still get a prod apply. `!cancelled()`
   still returns true for skipped upstreams (the only thing `always()` was
   needed for) and false on cancellation. Always flag `always()` on a job that
   applies to production.
2. **`result == 'skipped'` is a two-meaning signal** — "nothing to apply" and
   "never started". `detect-staging.outputs.has_changes != 'true'` distinguishes
   them. In loppemarked's current graph the two forms happen to be equivalent
   because `needs.detect-staging.result == 'success'` already excludes the
   second reading, but the output form survives future edits to
   `apply-staging`'s `if:`.

Non-cancellation truth table (verified by reading the graph): verify failure,
verify cancellation, apply-staging failure and detect-staging failure all block
prod correctly. The gate does gate — cancellation is the only hole.

### `verify-staging` job facts

- `environment: staging` is **required**, not cosmetic: `API_FUNCTION_NAME` is an
  environment-level variable (README documents it as such, e.g.
  `loppemarked-staging-2026-api`). Without the `environment:` key it resolves
  empty and the job fails every run.
- Deliberately has **no** `concurrency` group (un17-resources records why: it
  takes no Terraform lock, and the `terraform-staging` group holds only one
  pending entrant, so an unrelated PR opening mid-deploy would evict a queued
  verify and block the promotion for nothing).
- Uses `vars.TF_ROLE_ARN_STAGING` (the CI **terraform** role), not
  `DEPLOY_ROLE_ARN_STAGING` (the API **deploy** role that `deploy.yml` uses).
  Different roles, different policies — don't assume a permission one has the
  other does. `lambda:GetFunctionUrlConfig` is in ci-terraform's `LambdaManage`
  statement, resource-scoped to `function:<naming_prefix>-*`, which covers
  `<naming_prefix>-api`.
- OIDC trust policy (`ci_terraform_assume`) allows `ref:refs/heads/main`,
  `pull_request`, and `environment:<github_environment>` — an `environment:`-
  scoped job on main satisfies it two ways.

### Flakiness budget — the main risk of any pre-prod gate

A false failure here blocks production, so review retry budgets adversarially.

- greenspace/loppemarked: 6 attempts, 10s sleeps ≈ **50s** of wall clock if the
  requests fail fast. un17-resources deliberately uses 10 attempts + `--max-time
  20` + `timeout-minutes: 10` and records why.
- The dangerous window is right after an apply that touches `vpc_config` or the
  Lambda security group: the function re-provisions ENIs and returns **fast**
  502s meanwhile, so a fast-failing loop burns its whole budget in under a
  minute while the stack is merely still converging.
- `lambda_timeout` default is **30s** at **256 MB** (module `variables.tf`), and
  staging does not override either. A cold VPC start + Secrets Manager fetch +
  pg TLS connect at 256 MB is not instant; budget for several cold attempts.
- Missing `timeout-minutes` on a verify job means the 360-minute job default
  applies, and missing `--max-time` on curl means a single hung request can hold
  the promotion open. Flag both.

## Smoke-test endpoint characteristics (apps/api)

- `GET /public/status` → `handlePublicStatus` (`routes/public.ts`), registered at
  `index.ts:63`, **no** `requireAdmin`. Reads `system_settings.opening_datetime`
  and counts `tables`, returns `{isOpen, openingDatetime, hasAvailableTables,
  serverTime}`. A DB failure throws → `Router.handle`'s catch → 500. Fails
  closed, so it is a valid Lambda → VPC → RDS probe.
- `GET /health` → `routes/health.ts` is a **static** `{status:"ok"}` with no DB
  access at all. It cannot detect a networking/IAM regression. `deploy.yml`'s
  health check uses it, which is fine for a code deploy but not for infra.

## Lambda Function URL and URL joining

- `aws_lambda_function_url.api` has `authorization_type = "NONE"` — plain
  unauthenticated `curl` works; no SigV4 needed.
- `aws lambda get-function-url-config --query FunctionUrl --output text` returns
  the URL **with a trailing slash**. `deploy.yml` relies on this
  (`"${api_url}health"`), and it is green in production, so the bare
  concatenation works. It is still implicit — prefer `"${API_URL%/}/health"`.

## Shell patterns in `run:` blocks

- Actions runs `run:` with `bash -e {0}`, so `set -e` is active. `VAR=$(cmd)`
  aborts the step when `cmd` fails — `VAR=$(cmd || true)` (or `|| VAR=000`) is
  required, not decorative.
- `curl -s -w '%{http_code}'` prints `000` and exits non-zero on a connection
  failure, so `${STATUS:-000}` after a `|| true` is dead code (harmless).
- `jq -e '.key'` fails closed: exit 1 on a missing key (`null`), exit 2 on
  non-JSON. `jq` is preinstalled on `ubuntu-latest`.
- `"${{ vars.X }}"` / `"${{ steps.y.outputs.z }}"` interpolated straight into a
  `run:` script is template substitution *before* the shell sees it — a value
  containing `"` or `$(...)` executes. Prefer routing through `env:` and
  referencing `"$X"`. `deploy.yml` uses the direct form throughout (pre-existing).

## Docs that go stale with pipeline changes

- `README.md` → "CI / Terraform Pipeline" → **"Merge to main"** states the
  promotion rule verbatim, naming `apply-prod`'s `needs:` list. Any change to
  that gate must update it (CLAUDE.md Phase 2). `README.md` "Operational
  safeguards" repeats the gate in one line and goes stale with it.
- `AGENTS.md` "Deployment Topology" carries a one-line version per path, plus a
  bullet on what the `production` environment does and does not do.
- `infra/README.md` describes the same ordering twice — under "GitHub
  Environments" and "Workflow Behavior".
- `docs/architecture.md` has the CI/CD mermaid graph and a matching bullet list;
  the graph edges encode the job ordering, so they go stale with `needs:` too.
- The `API_FUNCTION_NAME` / `*_ROLE_ARN_*` variable table sits just above that
  README section and records repo-level vs environment-level scope.

**Promotion is automatic — never review as if an approval gate existed.** No
environment here has required reviewers, and none is wanted; `environment:` only
scopes variables and records deployment history. The human checkpoint is the
approving review branch protection requires on `main`. The three paths differ,
so check the one the diff touches rather than generalizing: `deploy.yml`'s
`deploy-prod` needs `deploy-staging` (ends in a `/health` check);
`terraform.yml`'s `apply-prod` needs `apply-staging` **and** `verify-staging`
(`GET /public/status`, a database-backed read); `deploy-web.yml` is a single
`deploy-web-prod` job with no `needs:` and no staging job, so nothing precedes
prod there (#314). Docs that flatten these into one rule were the bug in #312.
