# infra

Infrastructure as code for UN17 Village Loppemarked.

All persistent AWS resources must be defined under `infra/terraform`.

Structure:
- `terraform/bootstrap` - One-time state backend and OIDC provider
- `terraform/modules` - Reusable building blocks (`loppemarked_stack`)
- `terraform/environments/staging` - Staging stack
- `terraform/environments/prod` - Production stack

See [terraform/README.md](terraform/README.md) for the full Terraform layout, bootstrap flow, and environment workflow, and [terraform/modules/loppemarked_stack/README.md](terraform/modules/loppemarked_stack/README.md) for the shared module.

## CI/CD Pipeline

A single Terraform workflow handles both environments:
- [`.github/workflows/terraform.yml`](../.github/workflows/terraform.yml) — runs on PRs and pushes to `main` when `infra/terraform/**` changes.

### GitHub Variables

Set these in your repository settings:
- `TF_ROLE_ARN_STAGING` - Staging CI Terraform role ARN
- `TF_ROLE_ARN_PROD` - Production CI Terraform role ARN

### GitHub Environments

Create these environments in Settings → Environments. Both exist to scope
environment-level variables (such as `API_FUNCTION_NAME`) and to record
deployment history — the workflows' `environment:` keys are load-bearing for
that, so do not remove them.

- `staging` - No protection rules needed
- `production` - No protection rules either. Prod promotion is deliberately
  unattended, and the human checkpoint is the approving review branch protection
  requires on `main`. If an approval step in front of prod is ever wanted,
  required reviewers here is where it goes — and every deploy-flow description
  needs updating with it, since they all currently state the opposite:
  `README.md`, `AGENTS.md`, `docs/architecture.md`,
  `infra/terraform/README.md`, `docs/runbooks/launch-checklist.md`, and the
  "Workflow Behavior" section below.

### Workflow Behavior

- **PRs**: `terraform fmt` + per-environment `terraform plan` (no apply); fork PRs run `validate` only.
- **Main branch**: `terraform plan -detailed-exitcode` per environment, then `terraform apply` for staging, `verify-staging`, and finally `terraform apply` for production. Production applies on its own once the staging apply and its verification have both succeeded — nothing waits for a human.
- **Concurrency**: Guards prevent parallel applies to the same environment.
- **Artifacts**: Plan output is saved for review.
