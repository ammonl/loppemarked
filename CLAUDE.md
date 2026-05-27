# 🚨 STOP AND READ - MANDATORY INSTRUCTIONS 🚨

⚠️ **DO NOT SKIP THIS FILE.** ⚠️

This file contains **MANDATORY** instructions that **MUST** be followed for **EVERY** task.

**No exceptions. No shortcuts. No "I'll do it later."**

## Precedence

The workflow in this file is authoritative. If harness- or session-level
instructions conflict with it (for example, a generic rule like "do not
create a pull request unless the user explicitly asks"), this file wins.

For implementation tasks, Phase 4 — push, open a PR, get the PR reviewed, add
reviewers, and update the ticket — runs on every task unless the user tells you
to skip a specific step in the current turn, or a step is conditional and its
precondition is not met (see [Conditional vs. Universal Rules](#conditional-vs-universal-rules),
[Task Types](#task-types), and [Tool & Environment Availability](#tool--environment-availability)).
Ticket-only and other non-code tasks do not run the Phase 4 PR steps.

## Conditional vs. Universal Rules

This file mixes two kinds of instructions:

- **Universal rules** apply to every task regardless of provider, tooling, or
  execution mode. They are written as plain imperatives (for example: keep
  changes minimal, use American English, never force-push to `main`).
- **Conditional rules** depend on something about the current context — the
  ticket provider, the available tools, the repo's tooling, or the task type.
  They are marked with phrases like _if applicable_, _if configured_, _if
  supported_, or _if available_.

When a conditional rule's precondition is not met, skip that step instead of
treating it as a blocker or a violation. When a rule is unmarked, treat it as
universal.

## Task Types

Not every task is a code change. Match the workflow to the task:

- **Implementation tasks** (code, docs, or config changes that land in the
  repo) run the full Phase 1–4 workflow.
- **Ticket-only / non-code tasks** (for example: "file a ticket", "triage this
  issue", "answer a question", "investigate and report back") do **not** require
  a branch, validation run, PR, or reviewer assignment. Do the requested work
  and skip the implementation-only phases that do not apply. Still read the
  relevant ticket and communicate the result.

If a task is ambiguous about whether it expects code changes, use
AskUserQuestion before assuming.

## Tool & Environment Availability

Some steps depend on an integration that may not exist in the current
environment — a ticket MCP tool, the `gh` CLI, a `pr-reviewer` agent, the
Playwright MCP server, a specific npm script, etc. If a required tool or
integration is unavailable:

- Skip the step when it is optional or provider/tool-specific.
- If the step matters but is blocked, note that it was skipped and why (in the
  PR description or your response) and continue with the rest of the workflow
  rather than stopping.
- Never fabricate the result of a step you could not actually run.

## Provider-Specific Workflow Steps

Some ticket/issue workflow steps in this file assume capabilities that not
every ticket provider supports. If a workflow step that deals with a ticket
or issue is not applicable to the current ticket provider, ignore that
specific instruction rather than treating it as a required step.

For example, GitHub Issues do not support an `In Progress` status the way
other providers (such as Linear) do, so instructions to move a ticket to
`In Progress` or `in review` simply do not apply when GitHub Issues is the
provider — skip them. The same goes for any other provider-specific
capability (custom statuses, certain label conventions, assignment
semantics, etc.) that the active provider lacks.

This exception applies **only** to ticket/issue workflow steps that the
current provider genuinely cannot support. It does not exempt you from the
rest of the workflow: every other phase and step still runs as written, and
steps that the provider _does_ support (for example, reading the ticket,
adding labels that exist, and commenting) must still be completed.

# 📋 MANDATORY WORKFLOW FOR EVERY TASK

Every task follows this exact pattern. **No skipping phases.**

## 🟡 PHASE 1: PRE-WORK (Before Writing Code)

### 1.1 Load Context

Always start by reading the issue via the project's ticket provider using the MCP tool or local client. Add the labels "agent active" and "claude" to the ticket you are working on, and move it to "In Progress" status. (If the current provider does not support one of these steps — for example, GitHub Issues has no `In Progress` status, and labels must already exist — skip the unsupported step per [Provider-Specific Workflow Steps](#provider-specific-workflow-steps).) These labels apply to the ticket you are actively working; tickets you _file_ follow the separate rules in [Filing Tickets](#filing-tickets).

**Confirm:**

- [ ] Ticket read and understood
- [ ] Labels added (if supported)
- [ ] Status updated (if supported)
- [ ] Requirements clear (if not, use AskUserQuestion)

### 1.2 Create Planning Document

Create `.agent/ticket-<number>-plan.md` with:

- **Analysis**: Current state, target state, approach
- **Task Checklist**: All steps needed
- **Implementation Summary**: Files to modify, estimated impact

**Confirm:**

- [ ] Plan document created (do not commit plan files)
- [ ] Approach is sound (if uncertain, get user approval)

### 1.3 Setup Branch

```bash
# Ensure on latest main
git checkout main
git pull
```

Create a feature branch using the project format. Follow the branch naming
rules whenever possible — this is the preferred path.

**Note on Claude Code remote:** Claude Code remote generally creates a branch
_before_ it reads `CLAUDE.md`, so the steps above cannot always be followed
literally. If work is already happening in a branch that was created outside
this workflow before `CLAUDE.md` was read, that is acceptable — continue on
that branch rather than treating it as a violation. Only create a new branch
when you are not already on a suitable working branch.

**CHECKPOINT: Phase 1 complete?**

- ✅ Ticket read; labels added and status updated (if supported)
- ✅ Plan created
- ✅ On a working branch (created from latest main when possible, or the
  pre-existing branch provided by the remote workflow)

**If NO to any item, STOP and complete it NOW.**

---

## 🟢 PHASE 2: EXECUTION (Write Code)

### Code Guidelines

**Critical Rules:**

1. **Minimal changes** - Address task requirements ONLY
2. **DRY/KISS/YAGNI** - Keep it simple, avoid over-engineering
3. **Root causes** - Fix underlying issues, not symptoms
4. **No scope creep** - Don't refactor unrelated code
5. **Concise communication** - Remove filler, use bullets

**Safety:**

- DO NOT modify logic/variables unrelated to the task
- Use `trash` for deletions, never `rm -rf`
- Never skip pre-commit hooks without explicit permission
- Never force push to main/master

**Best Practices:**

- Follow existing code patterns in the codebase
- Maintain consistent formatting and style
- Add validation for user input
- Provide user-facing error messages (not just console.error)
- Consider edge cases and error states
- Ensure that any relevant changes are reflected in README.md
- If any new environment variables are added, add them into the appropriate environment `.example` file in the same change (not as a separate cleanup step)

**Workflow Customizations**
Follow all Task Execution Workflow Customizations steps or instructions included in this file.

---

## 🔵 PHASE 3: VALIDATION (Before Creating/Updating PR)

Complete every **applicable** check before creating a PR. The commands below are
examples — use the project's actual equivalents, and skip any check the project
does not configure. (For example, this repo has no test/lint/build step; its
validation is `npm run format:check` via Prettier.)

### 3.1 Run Tests

```bash
npm test  # or the project's test command
```

Run the project's test suite if it has one.

- [ ] All tests pass (if a test suite exists)
- [ ] Coverage meets the project's threshold, if the project tracks coverage (add tests if needed)

**If no test script exists:** note "N/A" in the plan or PR.

### 3.2 Run Linter

```bash
npm run lint  # or the project's lint/format command
```

- [ ] No new linting/formatting errors introduced (if the project configures a linter or formatter)

### 3.3 Build Verification

```bash
npm run build  # or the project's build command
```

- [ ] Build completes successfully (if the project has a build step)
- [ ] No errors or critical warnings

### 3.4 Pre-commit Checks

- [ ] Pre-commit hooks pass (if configured)
- [ ] No debugging code left (console.log, debugger, etc.)

### 3.5 Visual Verification

When a change affects user-facing UI **and** the Playwright MCP server is available, use it to:

- [ ] Start the dev server (or relevant preview).
- [ ] Navigate to the affected route.
- [ ] Capture screenshots at the relevant viewports (e.g., 375px, 768px, 1440px).
- [ ] For modified surfaces, also check out main, capture the "before" at the same viewports, then return to the feature branch.
- [ ] Attach screenshots to the PR description with clear before/after labels.

Save screenshots under .agent/screenshots/ticket-<number>/ so they're traceable. Do not commit them — upload to the PR directly via gh pr comment --body-file referencing the image, or use gh to attach via a GitHub-hosted upload. If the change has no user-facing UI, or the Playwright MCP server is unavailable, skip this step (note the skip in the PR when relevant).

**CHECKPOINT: All validation items complete?**

**If NO, fix issues before proceeding.**

---

## ⚪ PHASE 4: SUBMISSION

### 4.1 Push and Create PR

```bash
git push -u origin <branch-name>
```

Create PR with:

- **Title**: Conventional commit format (feat:, fix:, etc.)
- **Body**: Include ticket number, summary, test plan
- **Link**: Reference ticket (#<number>)
- **Screenshots (visual changes)**: If the change affects any user-facing UI, include screenshots in the PR description. Include before and after when modifying an existing surface. For new UI where no "before" exists, include after screenshots only and note it's a new surface. Capture the same viewport and state in both images so the diff is obvious.

```bash
gh pr create --title "feat: <description>" --body "..."
```

### 4.2 PR Review (MANDATORY)

Every PR must be reviewed before requesting human review. The reviewing is
mandatory; the specific tool is not. If a `pr-reviewer` agent is available, use it:

```
Review PR #<number> comprehensively and post findings as PR review comment
```

If no review agent is available, perform a self-review of the diff instead and
note that in the PR.

The reviewer must **always** leave a distinct PR review comment, even when the
review finds nothing actionable (in that case the comment should say so
explicitly). This review comment is one of two required comments on every PR —
it must never be merged with the responder follow-up comment from 4.3.

- [ ] PR reviewed (by the review agent if available, otherwise a self-review)
- [ ] Review findings posted as a PR comment (e.g. via `gh pr review`, or the available tooling)
- [ ] This reviewer comment is separate from the responder follow-up comment (4.3)

### 4.3 Address Feedback

**For EVERY piece of feedback:**

- Either fix the issue and update PR
- Or explain why it shouldn't be addressed
- For any issues that are judged to be valuable but out of scope, create a new ticket via the project's ticket provider using the MCP tool.

After responding to the review, the responder must **always** leave a separate
follow-up PR comment — every PR, every time. This is the second of the two
required comments and must be **distinct** from the reviewer comment in 4.2; the
two must never be combined into a single comment. If the review had no actionable
feedback, the responder must still leave a follow-up comment such as
`Thanks for the review.`

Post response using:

```bash
gh pr comment <number> --body "Addressed: ... / Not addressed: ..."
```

- [ ] All feedback addressed or justified, or a ticket has been created for the out of scope feedback.
- [ ] Separate responder follow-up comment posted to the PR (even when there is no actionable feedback, e.g. `Thanks for the review.`)
- [ ] Responder follow-up is a distinct comment, not merged with the reviewer comment (4.2)

### 4.4 Remove label

Remove the "agent active" label from the ticket.

### 4.5 Final Steps

Add ammonl as a reviewer, if the platform and tooling support adding reviewers.

```bash
# Add reviewer
gh pr edit <number> --add-reviewer ammonl
```

Leave a comment on the ticket referencing the PR, with a summary of the implementation.

- [ ] Reviewer added (ammonl), if supported
- [ ] Ticket commented with PR link + implementation summary
- [ ] Move the ticket to "in review" status (skip if the current provider has no such status — see [Provider-Specific Workflow Steps](#provider-specific-workflow-steps)).
- [ ] Ready for final review

---

## Language & Spelling

Always use **American English** spelling and terminology in all written output — code comments, docstrings, log messages, commit messages, PR descriptions, documentation, and user-facing strings.

- Use `-ize` / `-ization`, not `-ise` / `-isation` (e.g., `initialize`, `organization`).
- Use `-or`, not `-our` (e.g., `color`, `behavior`, `favor`).
- Use `-er`, not `-re` (e.g., `center`, `meter`).
- Use single `l` in past tense where American English does (e.g., `canceled`, `traveled`, `modeled`).
- Prefer American vocabulary (e.g., `gray` not `grey`, `catalog` not `catalogue`).

This applies even when editing files that already contain British spellings — normalize to American English unless the surrounding identifier is a fixed external API name (e.g., a third-party library's `Colour` class) that cannot be changed.

## Command Style

Never chain commands with `&&`. Use separate commands instead.

Bad:

```bash
cd foo && npm install && npm test
```

Good:

```bash
cd foo
npm install
npm test
```

**Never use heredocs in Bash commands.** Heredocs embed newlines into the command string, which breaks permission pattern matching.

For multi-line `gh` command bodies, write to a temp file instead:

```bash
printf '%s' "body content here" > /tmp/pr-body.txt
gh pr create --title "..." --body-file /tmp/pr-body.txt
```

Or use a single-quoted string with explicit \n escaping if the body is short enough to fit on one line.

The key flags that accept files:

```
- `gh pr create --body-file <file>`
- `gh pr comment --body-file <file>`
- `gh pr review --body-file <file>`
- `gh issue comment --body-file <file>`
```

# Filing Tickets

These rules apply to tickets you **file** (e.g. to fix a bug you discovered or as a followup), which is distinct from the ticket you are actively working (see [1.1 Load Context](#11-load-context)).

If you need to create a ticket, use the MCP tool or local client. Do not add the label "claude" to a ticket you file. Put the ticket in TODO status and assign it to Ammon Larson, if the provider supports statuses and assignment (skip the unsupported part per [Provider-Specific Workflow Steps](#provider-specific-workflow-steps)).

# Python Guidelines

Always use uv to manage python environments and run python commands. Check at the root folder for existing environments before creating a new one.
When working in the Python coding language, follow “The Hitchhiker’s Guide to Python” conventions for project structure, packaging, tooling, and general best practices:
Core principles

- Prefer readability and explicitness over cleverness.
- Keep modules small and cohesive; avoid deep inheritance and over-abstraction.
- Prefer the standard library where practical; add dependencies only when justified.
  Project layout and structure
- Default to a `src/` layout for packages (e.g., `src/<package_name>/...`) and keep import paths clean.
- Keep configuration, documentation, and tooling files at the repo root.
- Put tests in `tests/` and write tests that are fast, deterministic, and isolated.
- Organize code by feature/domain rather than by “layers” unless the project clearly benefits.
  Environment and dependencies
- Always assume an isolated virtual environment.
- Prefer pinned, reproducible dependencies (lockfile or pinned requirements).
- Do not instruct to modify global Python installations.
  Code style
- Follow PEP 8 naming and formatting conventions.
- Prefer f-strings, pathlib, context managers, and type hints where they improve clarity.
- Write docstrings for public modules/classes/functions; keep them concise and useful.
- Use exceptions intentionally; never blanket-catch without re-raising or logging.
  Tooling (assume these unless the user specifies otherwise)
- Formatting/linting: use Ruff (and Black only if requested or already present).
- Type checking: use mypy or pyright if the project uses typing seriously.
- Testing: use pytest; use fixtures; avoid network in unit tests.
- Logging: use the standard `logging` module; no print statements in library code.
  Async and concurrency
- Use asyncio only for I/O concurrency; avoid making everything async.
- Do not block the event loop; if forced to call blocking code from async code, use `asyncio.to_thread()`.
- Do not add numbering to comments.
- Do not mention specific tickets, issues, or bug numbers in comments.
- If a change is a reaction to a bug in existing code and would not have been commented if the code had been written that way initially, do not add that comment.

---

# 🎯 QUICK REFERENCE

Implementation tasks run all four phases below. Ticket-only / non-code tasks
skip the branch, validation, and PR steps — see [Task Types](#task-types).

```
Phase 1: Pre-Work
├─ Read ticket/issue, add labels + update status (if supported)
├─ Create .agent/ticket-X-plan.md
└─ Use the project branch format (or the pre-existing remote branch)

Phase 2: Execution
├─ Write minimal code
├─ Follow project patterns
├─ Add new env vars to the matching .example file
└─ Add validation + error handling

Phase 3: Validation (run each check the project configures)
├─ Tests (if a suite exists)
├─ Lint / format (if configured)
├─ Build (if a build step exists)
└─ Pre-commit checks

Phase 4: Submission
├─ git push + create PR
├─ PR review (agent if available, else self-review) + post a distinct reviewer comment
├─ Address all feedback + post a separate responder follow-up comment (e.g. "Thanks for the review.")
├─ Remove "agent active" label (if supported)
├─ Add reviewer (ammonl, if supported)
├─ Comment on ticket
└─ Update ticket status (if supported)

Note: skip any ticket/issue step above that the current provider does not
support, and any tool-specific step whose tool is unavailable — see
[Provider-Specific Workflow Steps](#provider-specific-workflow-steps),
[Conditional vs. Universal Rules](#conditional-vs-universal-rules), and
[Tool & Environment Availability](#tool--environment-availability).
```

## Critical Reminders

**DON'T:**

- ❌ Forget ticket labels (when the provider supports them)
- ❌ Skip planning document
- ❌ Modify unrelated code
- ❌ Skip PR review (use a self-review if no review agent is available)
- ❌ Skip the reviewer comment or the responder follow-up comment — both are required on every PR
- ❌ Merge the reviewer comment and the responder follow-up into a single comment
- ❌ Ignore review feedback
- ❌ Force push to main
- ❌ Treat a conditional step as a blocker when its precondition is not met

**DO:**

- ✅ Follow the phase workflow
- ✅ Validate required fields
- ✅ Provide user-facing errors
- ✅ Test before pushing
- ✅ Address all PR feedback
- ✅ Leave two distinct PR comments every time: a reviewer comment and a separate responder follow-up
- ✅ Keep changes minimal

---

# ⚠️ WHY THIS MATTERS

**Skipping workflow phases leads to:**

- Missing labels → Lost tracking
- No planning → Wasted rework
- No validation → Broken builds
- No review → Critical bugs shipped

**Following this file ensures:**

- ✅ Consistent, high-quality code
- ✅ Proper tracking and documentation
- ✅ Caught bugs before merge
- ✅ Efficient workflow
- ✅ User trust maintained

---

**Remember: This file is not a suggestion. It is a requirement.**

**When in doubt, re-read this file. When finishing a task, verify all phases complete.**

# PROJECT-SPECIFIC INFORMATION

---

## IMPORTANT! Keep the '# PROJECT-SPECIFIC INFORMATION' header here -- everything above is automatically copied from the Claude configuration repo, and updated whenever the global instructions change. Everything below is project-specific, and should be edited as needed.

## Project Settings

- **Ticket Provider**: GitHub Issues
- **Branch Format**: `<type>/<ticket-number>` (e.g., `feature/123`)
- **Main Branch**: `main`

## Project Overview
UN17 Village Loppemarked — bilingual (Danish/English) flea-market table booking platform for Fælledhuset, 2026 season. Public users register without auth; admins use email/password. Registration opening is **server-authoritative** (see README "Time Source & Registration Gate").

## Workspace Layout

npm workspaces monorepo (Node ≥ 24):

- `apps/api` (`@loppemarked/api`) — TypeScript API. Runs locally as an HTTP dev server (`src/dev-server.ts`); deploys as a single AWS Lambda behind a Function URL (`src/lambda.ts`). Both entry points share the same `Router` (`src/router.ts`) and route modules under `src/routes/{public,admin,health}`.
- `apps/web` (`@loppemarked/web`) — Next.js 15 / React 19 App Router frontend. State-driven view switching (PreOpen → Landing → TableMap), not URL routing. Custom React-context i18n (`src/i18n`).
- `packages/shared` (`@loppemarked/shared`) — Source-only package (no build step required for consumers; `main`/`types` point at `src/index.ts`). Holds types, Zod-free validators, enums, i18n, and DAWA address helpers shared between api and web.
- `infra/terraform/modules/loppemarked_stack` — Single shared AWS module (VPC, RDS Postgres 16, Lambda, SES, Secrets Manager, CloudWatch, EventBridge session-cleanup). Observability alarms gated by `enable_observability_alerts` (prod only).

## Common Commands

Run from the repo root unless noted. All workspace scripts use `--workspaces --if-present`, so root-level `npm test` / `npm run lint` / `npm run build` / `npm run typecheck` fan out to each package.

```bash
# Single workspace
npm run dev       --workspace=@loppemarked/web                # Next dev on :3000 (proxies /public, /admin, /health to API)
DB_PASSWORD=localdev npm run dev    --workspace=@loppemarked/api  # tsx watch dev server on :3001
DB_PASSWORD=localdev npm run db:setup --workspace=@loppemarked/api # migrate + seed
npm run bundle    --workspace=@loppemarked/api                # esbuild Lambda bundle to dist/lambda/index.mjs

# Tests (vitest in api/web/shared)
npm test --workspace=@loppemarked/api
npx vitest run path/to/file.test.ts --workspace=@loppemarked/api   # single file
npx vitest run -t "pattern" --workspace=@loppemarked/api           # by test name
```

Local Postgres expected on `localhost:5433` (host-mapped from container port 5432). See README for the docker run command and env vars.

## Architecture Notes

- **API request flow** — `lambda.ts` (Lambda Function URL) and `dev-server.ts` (local Node HTTP) both adapt their input into a `RequestContext` and dispatch through one `Router` instance built in `router.ts`. Add new endpoints by registering them on that router, not by branching per environment.
- **DB access** — Kysely on `pg`. Migrations live in `apps/api/src/db/migrations` and are tracked via `migration-registry.ts`; `db:setup` runs migrations + `seed.ts` (admin user, tables, system settings). Schema-shape types are in `db/types.ts`.
- **Auth & sessions** — Admin sessions have an 8-hour TTL; an EventBridge schedule invokes the Lambda hourly to bulk-delete expired sessions. Auth middleware lives in `src/middleware/auth.ts`.
- **Email** — SES via `lib/email-service.ts` with separate template modules (`email-templates.ts`, `admin-email-templates.ts`, `waitlist-emails.ts`, `admin-ops-notifications.ts`). The "keep newest active registration" rule (commit b741c21) matters when touching English recipients.
- **Registration gate** — `GET /public/status` and `POST /public/register` independently re-check `opening_datetime` (timestamptz) against `Date.now()`. Never trust client time. Frontend defaults to pre-open when API is unreachable and polls `/public/status` every 30s.
- **Timezone** — Opening time is stored UTC; display uses `Europe/Copenhagen` via the `OPENING_TIMEZONE` constant in `packages/shared`.
- **DAWA** — Danish address autocomplete helpers in `packages/shared/src/dawa.ts`; consumed by the web registration form.

## Deployment Topology

- **API** (`deploy.yml`) triggers on changes to `apps/api/**` or `packages/shared/**`. Bundles → deploys to staging Lambda → health check → promotes to production (gated by GitHub `production` environment).
- **Web** (`deploy-web.yml`) triggers on `apps/web/**` or `packages/shared/**`. Kicks off an AWS Amplify production release.
- **Terraform** (`terraform.yml`) per-environment plan/apply via GitHub OIDC; staging applies before prod. Drift detection runs daily and opens an issue on drift.
- The shared module has one source of truth — do not introduce per-environment Terraform forks.

## Conventions

- ESM throughout (`"type": "module"`). Import paths inside the API include the `.js` extension even for `.ts` source (TypeScript NodeNext resolution).
- `packages/shared` is consumed directly from source — no build step required when iterating, but keep `src/index.ts` exports stable.
- American English spelling everywhere (see global instructions). Server-authoritative checks must stay on the server; never gate UI-only.
- Admin "ops" notifications and audit log entries live alongside the action that triggers them (see `lib/audit.ts`, `lib/admin-ops-notifications.ts`) — keep them paired when adding new admin mutations.

## Docs

Architecture diagrams and deeper context: `docs/architecture.md`, `docs/api/openapi.yaml`, `docs/data/schema.md`, `docs/specs/`, `docs/adr/`, `docs/runbooks/`.
