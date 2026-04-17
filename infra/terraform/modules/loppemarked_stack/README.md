# loppemarked_stack module

Composable Terraform module for all UN17 Village Rooftop Gardens AWS resources. Used by both
the staging and production environment stacks.

## Resources provisioned

| File             | Resources                                                  |
|------------------|------------------------------------------------------------|
| `networking.tf`  | VPC, public/private subnets, internet gateway, NAT gateway |
| `iam.tf`         | API runtime role, CI deploy role, CI Terraform role        |
| `database.tf`    | RDS PostgreSQL instance, subnet group, Secrets Manager     |
| `ses.tf`         | SES domain identity, DKIM, configuration set               |
| `dns.tf`         | SES verification/DKIM DNS records (zone owned by `dns/`)   |
| `monitoring.tf`  | CloudWatch log groups, KMS encryption key                  |

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

Hosted zones are owned by the `infra/terraform/dns/` stack, not this module.
Env stacks read `root_zone_id` / `staging_zone_id` from the DNS stack's
remote state and pass one in as `route53_zone_id`; this module only writes
SES verification and DKIM CNAME records into that zone.

After the DNS stack's first apply:

1. **Point your registrar's nameservers** to the apex zone's nameservers
   (DNS stack output: `root_nameservers`). The staging subdomain is already
   delegated in-zone by `aws_route53_record.staging_ns` in the DNS stack.
2. SES will verify the domain and enable DKIM signing automatically once DNS
   propagates.

## Key variables

| Variable                      | Description                                          |
|-------------------------------|------------------------------------------------------|
| `environment`                 | Deployment environment name (staging, prod)          |
| `vpc_cidr`                    | CIDR block for the VPC                               |
| `ses_sender_domain`           | Domain for SES identity and Amplify custom domain    |
| `route53_zone_id`             | Hosted zone ID for `ses_sender_domain` (from `dns/`) |
| `ses_reply_to_email`          | Default Reply-To (defaults to `elise7284@gmail.com`) |
| `db_instance_class`           | RDS instance class                                   |

See `variables.tf` for the full list with descriptions and defaults.

## Testing

```bash
terraform test  # Runs iam.tftest.hcl (least-privilege validation)
```
