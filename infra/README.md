# infra

Infrastructure as code for UN17 Village Loppemarked.

All persistent AWS resources must be defined under `infra/terraform`.

Structure:
- `terraform/modules` reusable building blocks
- `terraform/environments/staging` staging stack
- `terraform/environments/prod` production stack

## CI/CD Pipeline

Terraform runs automatically via GitHub Actions:
- `infra/terraform/environments/staging/terraform.yml` - Staging (PRs + main)
- `infra/terraform/environments/prod/terraform.yml` - Production (main only)

### GitHub Variables

Set these in your repository settings:
- `TF_ROLE_ARN_STAGING` - Staging CI Terraform role ARN
- `TF_ROLE_ARN_PROD` - Production CI Terraform role ARN

### GitHub Environments

Create these environments in Settings → Environments:
- `staging` - No protection rules needed
- `production` - Add required reviewers (ammoml)

### Workflow Behavior

- **PRs**: `terraform plan` only (no apply)
- **Main branch**: `terraform plan` followed by `terraform apply`
- **Forks**: `terraform validate` only (no plan/apply)
- **Concurrency**: One plan/apply at a time per environment
- **Artifacts**: Plan output saved for review
