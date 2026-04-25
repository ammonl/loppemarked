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

Create these environments in Settings → Environments:
- `staging` - No protection rules needed
- `production` - Add required reviewers (`ammonl`)

### Workflow Behavior

- **PRs**: `terraform fmt` + per-environment `terraform plan` (no apply); fork PRs run `validate` only.
- **Main branch**: `terraform plan -detailed-exitcode` per environment, then `terraform apply` for staging followed by production.
- **Concurrency**: Guards prevent parallel applies to the same environment.
- **Artifacts**: Plan output is saved for review.
