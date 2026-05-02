# UN17 Village Loppemarked

UN17 Village Loppemarked is the UN17 flea-market table booking platform for the 2026 season, hosted in Fælledhuset.

Primary product specification:
- [UN17 Village Loppemarked Spec](docs/specs/loppemarked-2026-spec.md)
- [Architecture Overview](docs/architecture.md)

## Repository Layout

- [`apps/web`](apps/web/) - Next.js 15 frontend for public and admin UI.
- [`apps/api`](apps/api/) - API services (registration, admin operations, email workflows).
- [`packages/shared`](packages/shared/) - Shared types, validation schemas, and i18n/domain constants.
- [`infra/`](infra/) - AWS infrastructure as code.
  - [`infra/terraform`](infra/terraform/) - Terraform modules and environment stacks.
  - [`infra/terraform/modules/loppemarked_stack`](infra/terraform/modules/loppemarked_stack/) - Shared AWS resource module.
- [`docs/`](docs/) - Product specs, architecture, ADRs, API contracts, and data model docs. See [`docs/README.md`](docs/README.md) for the docs index.
  - [`docs/architecture.md`](docs/architecture.md) - System architecture with diagrams.
  - [`docs/api/openapi.yaml`](docs/api/openapi.yaml) - OpenAPI 3.1 contract.
  - [`docs/data/schema.md`](docs/data/schema.md) - Data contract and invariants.
  - [`docs/specs/design-tokens.md`](docs/specs/design-tokens.md) - Web design tokens (TS + CSS).
  - [`docs/adr/`](docs/adr/) - Architecture Decision Records.
  - [`docs/runbooks/`](docs/runbooks/) - Operational runbooks.
    - [`incident-triage.md`](docs/runbooks/incident-triage.md) - Alarm investigation and incident response.
    - [`backup-restore.md`](docs/runbooks/backup-restore.md) - RDS backup and point-in-time restore.
    - [`launch-checklist.md`](docs/runbooks/launch-checklist.md) - Pre-launch verification, production cutover, and go/no-go decision.
- `.github` - CI workflows and contribution templates.
  - [`.github/pull_request_template.md`](.github/pull_request_template.md) - Pull request body template.
  - [`.github/ISSUE_TEMPLATE/feature-slice.md`](.github/ISSUE_TEMPLATE/feature-slice.md) - Feature slice issue template.
  - [`.github/ISSUE_TEMPLATE/guardrail-task.md`](.github/ISSUE_TEMPLATE/guardrail-task.md) - Guardrail / platform task issue template.

## Local Development

### Prerequisites

- Node.js >= 24
- PostgreSQL 16 (via Docker or a local install)

### 1. Start PostgreSQL

**Docker:**

```bash
docker run -d --name loppemarked-db \
  -e POSTGRES_DB=loppemarked \
  -e POSTGRES_USER=loppemarked \
  -e POSTGRES_PASSWORD=localdev \
  -p 5433:5432 \
  postgres:16
```

**Homebrew (macOS):**

```bash
brew install postgresql@16
brew services start postgresql@16
createuser loppemarked
createdb -O loppemarked loppemarked
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run database migrations and seed data

```bash
DB_PASSWORD=localdev npm run db:setup --workspace=@loppemarked/api
```

This runs the Kysely baseline migration and seeds the flea-market tables, system settings, and an initial admin account. The default admin password is `changeme123` (override with `SEED_ADMIN_PASSWORD`).

### 4. Start the API dev server

```bash
DB_PASSWORD=localdev npm run dev --workspace=@loppemarked/api
```

The API starts on `http://localhost:3001` by default (override with `API_PORT`).

### 5. Start the frontend

```bash
npm run dev --workspace=@loppemarked/web
```

The Next.js dev server starts on `http://localhost:3000` and proxies API routes (`/public/*`, `/admin/*`, `/health`) to the API dev server.

### Environment variables (API)

| Variable              | Default       | Description                     |
| --------------------- | ------------- | ------------------------------- |
| `DB_HOST`             | `localhost`   | PostgreSQL host                 |
| `DB_PORT`             | `5433`        | PostgreSQL port (host-mapped; container still listens on 5432) |
| `DB_NAME`             | `loppemarked`  | Database name                   |
| `DB_USER`             | `loppemarked`  | Database user                   |
| `DB_PASSWORD`         | (empty)       | Database password               |
| `DB_SSL`              | `false`       | Enable SSL for DB connection    |
| `API_PORT`            | `3001`        | Local dev server port           |
| `SEED_ADMIN_PASSWORD` | `changeme123` | Initial admin password for seed |

## Working Agreement

- Follow [CLAUDE.md](CLAUDE.md) for all task execution.
- Keep work issue-driven and scoped.
- Prefer contract-first changes:
  1. spec/ADR/API/data contract
  2. implementation
  3. tests/validation

## API Deployment

The API runs as an AWS Lambda function with a public Function URL.

- **Build**: `npm run bundle --workspace=@loppemarked/api` produces a single-file ESM bundle via esbuild.
- **Deploy workflow** (`deploy.yml`): Triggers on push to `main` when `apps/api/**` or `packages/shared/**` change. Builds the bundle, deploys to staging Lambda, runs a health check, then promotes to production (gated by the `production` environment protection rule).
- **Lambda Function URL**: Terraform provisions the Lambda function and Function URL. The `api_base_url` output contains the public endpoint for each environment.

### GitHub environment variables (deploy)

Each GitHub environment (`staging`, `production`) needs these variables:

| Variable                  | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `DEPLOY_ROLE_ARN_STAGING` | OIDC role ARN for staging API deployment (repo-level) |
| `DEPLOY_ROLE_ARN_PROD`    | OIDC role ARN for production API deployment (repo-level) |
| `API_FUNCTION_NAME`       | Lambda function name (environment-level, e.g. `loppemarked-staging-2026-api`) |

## CI / Terraform Pipeline

Five workflows handle CI, infrastructure, API and web deployment, and drift detection:

- **CI (`ci.yml`)** - Runs on every PR and push to main. Validates guardrail files, runs app checks (test/lint/build), and performs lightweight `terraform fmt -check` + `terraform validate` with the backend disabled.
- **Terraform (`terraform.yml`)** - Runs when `infra/terraform/**` files change. Authenticates to AWS via GitHub OIDC and operates per environment.
- **Deploy API (`deploy.yml`)** - Runs when `apps/api/**` or `packages/shared/**` change on main. Builds the Lambda bundle, deploys to staging, runs a health smoke test, then deploys to production.
- **Deploy Web (`deploy-web.yml`)** - Runs when `apps/web/**` or `packages/shared/**` change on main. Triggers an Amplify production release job and waits for the build to complete.
- **Drift Detection (`drift-detection.yml`)** - Runs daily on a cron schedule. Runs `terraform plan` for each environment and creates a GitHub issue if drift is detected.

### Pull requests (internal)

A format check and per-environment plan jobs run in parallel. The `Format Check` job runs `terraform fmt -check -recursive` and blocks merge when formatting is invalid. Each environment gets its own plan job with output uploaded as a CI artifact.

### Pull requests (forks)

Fork PRs receive no AWS credentials. The workflow falls back to backend-disabled `terraform fmt` + `validate` only.

### Merge to main

Staging is applied first. Production applies after staging succeeds, gated by the `production` environment protection rule.

Concurrency guards prevent simultaneous applies to the same environment.

### IAM setup

Each environment defines a `ci-terraform` IAM role assumed via GitHub OIDC (`aws-actions/configure-aws-credentials`). Role ARNs are stored in GitHub repository variables:

| Variable              | Purpose                                 |
| --------------------- | --------------------------------------- |
| `TF_ROLE_ARN_STAGING` | OIDC role ARN for staging plan/apply    |
| `TF_ROLE_ARN_PROD`    | OIDC role ARN for production plan/apply |

The roles grant least-privilege access to the S3 state backend, DynamoDB lock table, and the specific AWS resources managed by Terraform (VPC, IAM, KMS, CloudWatch Logs, Lambda, RDS, Secrets Manager).

### Required PR status checks

These checks should be required in the `main` branch protection rule:

| Workflow  | Job name          | Purpose                                         |
| --------- | ----------------- | ----------------------------------------------- |
| CI        | `app-checks`      | Lint, test, build for application code          |
| CI        | `infra-checks`    | `terraform fmt` + `validate` (backend-disabled) |
| Terraform | `Format Check`    | `terraform fmt -check -recursive` on infra changes |

The Terraform `Format Check` only triggers on `infra/terraform/**` changes. Configure it in branch protection with "Do not require this check to have run" so non-infra PRs are not blocked.

### Operational safeguards

- Fork PRs never receive privileged credentials.
- `concurrency` groups prevent parallel applies per environment.
- Prod apply is gated behind staging success and the `production` environment protection rule.
- Plan output is saved as an artifact for audit.

## Monitoring & Alerting

Dashboards, alarms, and the alerting SNS topic are provisioned **only when
the `enable_observability_alerts` module variable is `true`**. Production
keeps the default (`true`); staging sets it to `false`, so the resources
described below exist in production only.

In production, CloudWatch alarms cover the major failure modes:

| Alarm | Metric | Threshold |
|-------|--------|-----------|
| Lambda errors | Errors > 0 | 2 consecutive 5-min periods |
| Lambda throttles | Throttles > 0 | 1 period |
| RDS CPU | CPUUtilization > 80% | 3 consecutive 5-min periods |
| RDS memory | FreeableMemory < 128 MB | 2 consecutive periods |
| RDS connections | DatabaseConnections > 80 | 2 consecutive periods |
| SES bounces | Bounce > 5/hr | 1 period |
| SES complaints | Complaint > 1/hr | 1 period |

Alarm notifications are delivered via SNS email subscription (configured per environment via `alarm_email`).

A CloudWatch dashboard aggregates Lambda, RDS, and SES metrics.

**Drift detection** runs daily via `.github/workflows/drift-detection.yml`. If Terraform detects infrastructure drift, a GitHub issue is created automatically.

**Session cleanup** runs hourly via an EventBridge scheduled rule that invokes the API Lambda. Expired sessions (8-hour TTL) are bulk-deleted to prevent unbounded table growth.

See [docs/runbooks/](docs/runbooks/) for incident triage and backup restore procedures.

## Time Source & Registration Gate

Registration opening is **server-authoritative**. The server (`Date.now()`) is the sole source of truth for whether registration is open.

- **`GET /public/status`** returns `isOpen` (boolean) and `serverTime` (ISO 8601 UTC). The `isOpen` flag is computed by comparing the configured `opening_datetime` (stored as `timestamptz` in PostgreSQL) against the server's current time.
- **`POST /public/register`** independently re-checks the same server-side gate before accepting any submission. A client cannot bypass this by manipulating request data.
- **Frontend behavior**: The UI relies on the server's `isOpen` flag from `/public/status`. When the API is unreachable, the frontend defaults to the pre-open state (denying early access). While in pre-open, the frontend polls `/public/status` every 30 seconds to auto-transition when the server reports the opening.
- **Timezone**: The opening datetime is stored as an absolute UTC timestamp. Display formatting uses `Europe/Copenhagen` (via `OPENING_TIMEZONE` constant and `Intl.DateTimeFormat`). The admin UI labels the input as Copenhagen time.
- **Client clock**: The client's system clock is never used for gate decisions. Changing the browser/device clock cannot reveal the registration UI early or submit registrations before the server-determined opening time.

## Guardrails

- No manual AWS infrastructure drift: persistent resources are Terraform-managed.
- Small PRs with explicit acceptance criteria mapping.
- CI checks are required before merge.
