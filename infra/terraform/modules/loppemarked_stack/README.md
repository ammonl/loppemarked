# loppemarked_stack module

Composable Terraform module for all UN17 Village Loppemarked AWS resources. Used by both
the staging and production environment stacks.

## Resources provisioned

| File             | Resources                                                  |
|------------------|------------------------------------------------------------|
| `networking.tf`  | VPC, public/private subnets, internet gateway, NAT gateway |
| `iam.tf`         | API runtime role, CI deploy role, CI Terraform role        |
| `database.tf`    | RDS PostgreSQL instance, subnet group, Secrets Manager     |
| `ses.tf`         | SES domain identity, DKIM, configuration set               |
| `dns.tf`         | Route 53 hosted zone, SES verification/DKIM DNS records    |
| `monitoring.tf`  | CloudWatch log groups, KMS encryption key                  |
| `api_runtime.tf` | API Lambda function, function URL, EventBridge schedules   |
| `amplify.tf`     | Amplify app, branch, and custom domain association         |

## Least-privilege IAM

SES send permissions are scoped to the SES domain identity provisioned by the
module (`aws_ses_domain_identity`). Wildcard (`*`) resources are not accepted
where resource-level scoping is possible.

## SES email configuration

Each environment provisions its own SES domain identity, DKIM signing, and
configuration set. Sender addresses default to `loppemarked@<ses_sender_domain>`
and can be overridden via `ses_sender_email`. Reply-To defaults to
`elise7284@gmail.com` (spec default) and can be overridden via
`ses_reply_to_email`.

| Environment | Domain                 | Sender address                        | Reply-To                |
|-------------|------------------------|---------------------------------------|-------------------------|
| staging     | `staging.un17hub.com`  | `loppemarked@staging.un17hub.com`      | `elise7284@gmail.com`   |
| prod        | `un17hub.com`          | `loppemarked@un17hub.com`              | `elise7284@gmail.com`   |

### DNS verification

Route 53 hosted zones and DNS records for SES domain verification and DKIM
are managed by Terraform. After the first `terraform apply`:

1. **Point your registrar's nameservers** to the Route 53 zone nameservers
   (output: `route53_nameservers`).
2. **Delegate the staging subdomain** by adding an NS record in the prod
   Route 53 zone for `staging.un17hub.com` pointing to the staging zone's
   nameservers.
3. SES will verify the domain and enable DKIM signing automatically once DNS
   propagates.

## API Lambda runtime configuration

The API Lambda receives database, email, and public-URL configuration through
its `environment.variables` block:

| Variable         | Source                                                                 |
|------------------|------------------------------------------------------------------------|
| `ENVIRONMENT`    | `var.environment` (e.g. `staging`, `prod`)                             |
| `EMAIL_FROM`     | `var.ses_sender_email` or `loppemarked@<ses_sender_domain>`            |
| `EMAIL_REPLY_TO` | `var.ses_reply_to_email`                                               |
| `PUBLIC_WEB_URL` | `https://<amplify_domain_prefix>.<ses_sender_domain>`                  |

`PUBLIC_WEB_URL` anchors outbound email links such as the resident
self-cancellation magic link. With the current variable defaults this resolves
to `https://loppemarked.staging.un17hub.com` for staging and
`https://loppemarked.un17hub.com` for production.

## Key variables

| Variable                      | Description                                          |
|-------------------------------|------------------------------------------------------|
| `environment`                 | Deployment environment name (staging, prod)          |
| `vpc_cidr`                    | CIDR block for the VPC                               |
| `ses_sender_domain`           | Domain for SES identity and Route 53 zone            |
| `ses_reply_to_email`          | Default Reply-To (defaults to `elise7284@gmail.com`) |
| `db_instance_class`           | RDS instance class                                   |

See `variables.tf` for the full list with descriptions and defaults.

## Testing

```bash
terraform test  # Runs iam.tftest.hcl (least-privilege validation)
```
