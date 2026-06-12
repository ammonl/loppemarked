## Project Settings

- **Ticket Provider**: GitHub Issues
- **Branch Format**: `<type>/<ticket-number>` (e.g., `feature/123`)
- **Main Branch**: `main`
- **Designated Assignee(s)**: @ammonl

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
