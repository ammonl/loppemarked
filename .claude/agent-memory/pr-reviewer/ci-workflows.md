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

- greenspace: `always() && ... && (needs.apply-staging.result ==
  'skipped' || (apply-staging == 'success' && verify-staging == 'success'))`
- un17-resources **and loppemarked (adopted in #316, commit 7bb7f75)**: `!cancelled() && ... &&
  (needs.detect-staging.outputs.has_changes != 'true' || (apply-staging ==
  'success' && verify-staging == 'success'))`

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

**Exhaustive truth table for the current (`!cancelled()` + `has_changes`) form**
— brute-forced over cancelled × 4 results × 3 has_changes values per detect job
× 4 results per apply/verify job. The gate promotes in exactly two shapes:

1. `detect-staging` success + `has_changes == 'false'` (nothing applied to
   staging, nothing to verify — the intended promote-without-staging path), or
2. `detect-staging` success + `has_changes == 'true'` **and** apply-staging
   success **and** verify-staging success.

plus one fail-open: `detect-staging` success with `has_changes` **unset (`''`)**
promotes regardless of apply/verify, because the branch is written
`has_changes != 'true'` rather than `== 'false'`. Not reachable at runtime (the
plan step always writes one of the two), but reachable by an edit that breaks
the `outputs:` wiring — rename the `id: plan` step and the job still succeeds
publishing nothing, staging is never applied, and prod applies anyway. `==
'false'` fails closed there and changes no other row. Worth flagging on any PR
that touches detect-staging's `outputs:` or step ids.

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

- greenspace: 6 attempts, 10s sleeps ≈ **50s** of wall clock if the requests
  fail fast. un17-resources **and loppemarked (#316)** use 10 attempts +
  `--max-time 20` + `timeout-minutes: 10` and record why.
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

## `scripts/check-promotion-gate.mjs` (#313 / PR #321)

CI job `promotion-gate` (in `ci.yml`, `needs: guardrails`, no path filter so it
runs on every PR — deliberate, since `terraform.yml` only triggers on
`infra/terraform/**`). Reads `apply-prod`'s `if:`/`needs:` out of
`terraform.yml` with a hand-rolled reader, evaluates the expression over a
15-row scenario table, and pins `verify-staging`'s shape (`needs: apply-staging`
and no `if:` — its default `success()` is what skips it after a failed apply).

Verified about the evaluator (all correct, don't re-litigate):
`!` > `==`/`!=` > `&&` > `||` matches GitHub's documented precedence table;
`&&`/`||` return an operand rather than a boolean; string truthiness is
`'' → false` and everything else true (so `'false'`/`'0'` are truthy); absent
`needs.x.outputs.y` modeled as `''`, behaviorally identical to GitHub's null
under `==`/`!=` against a string literal and under truthiness; the `''`
string-escape loop is correct (traced `''`, `'it''s'`, `'a'''`, and unterminated
`'a''` → throws).

Known gaps in the *checker*, verified by mutating both workflows and re-running:

- Deleting `needs.detect-prod.result == 'success'` from the gate leaves the
  check **green** — the "detect-prod failed" row gives detect-prod no
  `has_changes`, so `'' == 'true'` blocks first and the result clause never
  decides anything. detect-staging has the mirror row; detect-prod does not.
- Dropping a job from `needs:` while still reading `needs.<job>.*` in the `if:`
  leaves the check **green**. GitHub's `needs` context holds only *direct*
  dependencies, so those reads become null. Fails closed for the current
  expression (every job is also read via a positive `== 'success'`), but the
  script only checks the converse (needs entry never read).
- ~~`parseNeeds` mis-reads a YAML block-sequence `needs:`~~ **OUTDATED — do not
  re-flag.** Re-verified directly against the current implementation: it strips
  leading `-` and quotes and splits on `[,\s]+`, so scalar, flow-sequence
  (`[a, b]`), block-sequence (`- a`/`- b`) and quoted entries all parse
  correctly. `jobKey`'s folded branch collects the `      - x` lines too.
- `equals` is strict + case-sensitive; GitHub's `==` is loose and **ignores case
  when comparing strings**. No constructible green-yet-promotes case today
  (every block-expected row is paired with a promote-expected row), but it is a
  real divergence.
- The implicit `success()` GitHub adds to a job `if:` with no status-check
  function is not modeled. Not reachable while the cancellation rows force
  `!cancelled()`/`always()` to stay present.
- `jobBlock` treats any 2-space-indented **comment** as the end of a job.
  Throws (unhandled, stack trace) for required keys. `jobBlock` no longer ends a
  job at a comment at job indentation, which previously caused that.
- A folded `>-` continuation re-indented deeper than 6 spaces silently truncates
  the expression; the run still fails, but the message blames the gate's logic.

`promotion-gate-rehearsal.yml` was **removed** in the PR that added the
ci-terraform permissions check. It had been a `workflow_dispatch`-only stub
graph carrying the gate verbatim; it ran once on `main` across all four
scenarios, and those runs are linked from #313 — the surviving record that
GitHub's own evaluator agreed with `check-promotion-gate.mjs`.

Keep in mind when reviewing gate changes: the evaluator is now the only thing
checking the gate, and it is a reimplementation of GitHub's semantics, not
GitHub. Its mutation tests all run through that same evaluator, so they cannot
catch a misreading they share with it.

**Coverage lost when the rehearsal parity block went (verified by mutation on
both sides of the commit):** the old parity list carried non-optional
`apply-staging.if` / `apply-staging.needs` entries, so deleting
`if: needs.detect-staging.outputs.has_changes == 'true'` from `apply-staging`
failed the check (`job "apply-staging" has no "if:"`). The replacement block only
inspects `verify-staging`, so that mutation is now **green**. It matters because
the gate's `has_changes == 'false'` branch promotes without reading
`apply-staging.result` — sound only while apply-staging is skipped in that case.
The new `verify-staging` checks are otherwise strictly stronger than the parity
entries they replaced (semantic, not copy-equality; a *new* `if:` on
verify-staging now fails instead of passing when both copies gained it).

## `scripts/check-ci-role-permissions.mjs` (PR #322) — verified gaps

Static half (`checkWorkflowCoverage`), regex
`/\baws\s+([a-z0-9-]+)\s+([a-z0-9-]+)(?:\s+([a-z0-9-]+))?/` per non-comment line.
Probed directly — **misses** (silently unchecked permission): a second call on
the same line (`exec` has no `/g`, so `aws lambda invoke && aws iam delete-role`
records only the first), and a backslash-continued `aws \` with the service on
the next line. **Misfires** (spurious CI failure): `aws --region x lambda invoke`
captures `--region eu-north-1` as the call because `-` is inside `[a-z0-9-]`;
`echo hi # aws s3 cp …` (only *full-line* comments are skipped); the words in
`echo "run aws logs tail"`. Correctly ignores `aws2`, `aws-cdk`, uppercase `AWS`,
and `arn:aws:sts::…`. Only `.github/workflows/*.y?ml` is scanned — nothing in
`scripts/`.

Live half (`checkLivePolicy`) — verified by feeding it mutated policy JSON:
- `NotAction` / `NotResource` are **silently ignored** (`asList(undefined)` →
  `[]` → `.some()` false). A `Deny`/`NotAction:[sts:GetCallerIdentity]`/
  `Resource:"*"` statement that locks the role out of everything still prints
  "Every AWS call the workflows make is mapped, declared, and granted."
- `Condition` is **silently ignored** both ways: a conditional Deny reports a
  healthy role as broken (files the issue); a conditional Allow reports a broken
  role as healthy.
- `globMatches` handles `*` only. IAM also supports `?`; `escape` escapes it, so
  `?` in an Allow resource is a false alarm and `?` in a Deny action is a missed
  deny.
- The `i` flag is applied to resources as well as actions. Right for actions
  (IAM action names are case-insensitive), not generally right for ARNs.
- Allow/Deny are otherwise modeled correctly: action **and** resource must match
  within the same statement, and any Deny beats any Allow.
- Malformed policy JSON → unhandled `JSON.parse` throw, exit 1; the workflow maps
  any non-zero exit to `has_gap=true`, so a stack trace ships inside an issue
  titled "CI role permissions lag bootstrap".
- The static "declared in bootstrap" test is `declared.includes('"action"')` over
  the whole `.tf` file — it also matches actions in `terraform-state`, in the
  shared-network managed policy, and inside the `DenySelfModify` Deny, while the
  live half only ever fetches the `terraform-resources` inline policy.

**Structural gotcha:** the manifest is keyed on the call string with a single
`role` field, so one call made by two roles cannot be represented.
`aws lambda get-function-url-config` runs in `deploy.yml` (ci-**deploy**,
`DEPLOY_ROLE_ARN_*`) and `terraform.yml` (ci-**terraform**, `TF_ROLE_ARN_*`);
the manifest labels it `ci-terraform` and the table prints deploy.yml in that
column. The code comment right above claims the opposite property.

## `aws lambda wait function-updated-v2` needs `lambda:GetFunction`

Not `lambda:GetFunctionConfiguration`. The `*-v2` waiters exist precisely
because they poll `GetFunction` (`Configuration.LastUpdateStatus`) rather than
`GetFunctionConfiguration`. Corroborated in-repo: `ci_deploy_permissions`
(`modules/loppemarked_stack/iam.tf`) grants `lambda:GetFunction` and **not**
`GetFunctionConfiguration`, and `deploy.yml` is green in production.

## Drift-job pattern: a hard-failing step files no issue

Both `detect-drift` and `ci-role-permissions` gate issue creation on
`if: steps.<x>.outputs.has_* == 'true'`. That contains no status-check function,
so the step is skipped once any earlier step in the job has failed. Any
`exit 1` before it (OIDC assume fails, `aws iam get-role-policy` denied) yields a
red scheduled run and **no issue** — the least visible outcome for the most
severe condition. Neither job dedupes, either: the same issue is opened every day
at 06:00 UTC until a human fixes it.
