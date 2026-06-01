# loppemarked_stack module

Composable Terraform module for all UN17 Village Loppemarked AWS resources. Used by both
the staging and production environment stacks.

## Resources provisioned

| File             | Resources                                                  |
|------------------|------------------------------------------------------------|
| `networking.tf`  | VPC, public/private subnets, internet gateway, SES + Secrets Manager VPC interface endpoints |
| `iam.tf`         | API runtime role, CI deploy role, CI Terraform role        |
| `database.tf`    | RDS PostgreSQL instance, subnet group, Secrets Manager     |
| `ses.tf`         | SES domain identity, DKIM, configuration set               |
| `dns.tf`         | Route 53 hosted zone, SES verification/DKIM DNS records    |
| `monitoring.tf`  | CloudWatch log groups, KMS encryption key, optional dashboard / alarms / SNS topic |
| `api_runtime.tf` | API Lambda function, function URL, EventBridge schedules   |
| `api_domain.tf`  | Stable API domain: us-east-1 ACM cert, CloudFront distribution fronting the Function URL, Route 53 alias records |
| `peering.tf`     | Requester-side VPC peering into the shared-db VPC + private route |
| `amplify.tf`     | Amplify app, branch, and custom domain association         |

## Provider configuration

The module requires two AWS provider configurations: the default (the
environment's primary region, `eu-north-1`) and `aws.us_east_1`. CloudFront
ACM certificates must live in `us-east-1`, so the stable API domain
(`api_domain.tf`) requests its certificate through the aliased provider. Each
environment stack declares both and passes them via the module `providers`
map.

## Least-privilege IAM

SES send permissions are scoped to the SES domain identity provisioned by the
module (`aws_ses_domain_identity`). Wildcard (`*`) resources are not accepted
where resource-level scoping is possible.

## SES email configuration

Each environment provisions its own SES domain identity, DKIM signing, and
configuration set. Sender addresses default to `loppemarked@<ses_sender_domain>`
and can be overridden via `ses_sender_email`. Reply-To defaults to
`ammonl@hotmail.com` (spec default) and can be overridden via
`ses_reply_to_email`.

| Environment | Domain                 | Sender address                        | Reply-To                |
|-------------|------------------------|---------------------------------------|-------------------------|
| staging     | `staging.un17hub.com`  | `loppemarked@staging.un17hub.com`      | `ammonl@hotmail.com`    |
| prod        | `un17hub.com`          | `loppemarked@un17hub.com`              | `ammonl@hotmail.com`    |

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
| `DB_SECRET_ID`   | `var.db_secret_id` (injected only when set)                            |

Database connection wiring has two modes. By default the runtime uses the
dedicated RDS instance via `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` and
fetches only the password from `DB_SECRET_ARN`. When `var.db_secret_id` is set,
`DB_SECRET_ID` is injected and the runtime instead builds the entire connection
from that shared-db secret payload (`host`, `port`, `database`, `username`,
`password`). The shared-db path stays dormant until an environment opts in, so
this module ships peering and IAM wiring without cutting traffic over.

`PUBLIC_WEB_URL` anchors outbound email links such as the resident
self-cancellation magic link. With the current variable defaults this resolves
to `https://loppemarked.staging.un17hub.com` for staging and
`https://loppemarked.un17hub.com` for production.

## Stable API domain

The web frontend reaches the API through Next.js `rewrites()`, whose
destination is baked into the Amplify build **at build time** from the
`API_URL` environment variable. Pointing `API_URL` at the raw Lambda Function
URL was fragile: the Function URL subdomain is regenerated whenever the
function is replaced (for example a VPC re-IP, via the `replace_triggered_by`
in `api_runtime.tf`). After such a replacement the deployed build kept
proxying to the now-deleted URL and every API-proxied path returned
`HTTP 403 AccessDeniedException` until someone manually rebuilt the Amplify
app.

`api_domain.tf` fronts the Function URL with a stable CloudFront domain
(`api.<ses_sender_domain>`, e.g. `api.staging.un17hub.com` /
`api.un17hub.com`) and sets Amplify's `API_URL` to that host. The CloudFront
origin tracks the current Function URL, so a function replacement updates the
origin on the next `terraform apply` while the hostname the web build depends
on never changes — no web rebuild required. The distribution uses the managed
`Managed-CachingDisabled` and `Managed-AllViewerExceptHostHeader` policies so
it behaves as a transparent API proxy (no caching; forwards cookies, headers,
and query strings; sends the origin's own Host).

Set `enable_api_custom_domain = false` to fall back to the raw Function URL
(and skip the CloudFront/ACM resources); `api_domain_prefix` overrides the
`api` subdomain label.

> **Note:** Changing `API_URL` only takes effect after the Amplify app
> rebuilds — a `terraform apply` updates the env var but does not trigger a
> build. Trigger a release (`aws amplify start-job --job-type RELEASE`) after
> first enabling the domain. Once enabled, later Lambda replacements no longer
> require this step.

## Key variables

| Variable                      | Description                                          |
|-------------------------------|------------------------------------------------------|
| `environment`                 | Deployment environment name (staging, prod)          |
| `vpc_cidr`                    | CIDR block for the VPC                               |
| `ses_sender_domain`           | Domain for SES identity and Route 53 zone            |
| `ses_reply_to_email`          | Default Reply-To (defaults to `ammonl@hotmail.com`)  |
| `db_instance_class`           | RDS instance class                                   |
| `enable_observability_alerts` | Provision the dashboard, metric alarms, and alerting SNS topic. Defaults to `true`; staging sets it to `false`. |
| `enable_api_custom_domain`    | Front the Function URL with a stable CloudFront domain and point `API_URL` at it. Defaults to `true`. |
| `api_domain_prefix`           | Subdomain label for the stable API domain (`api` → `api.<ses_sender_domain>`). |
| `shared_db_vpc_id`            | Shared-db VPC id to peer with (Phase A output). Null disables peering. |
| `shared_db_vpc_cidr`          | Shared-db VPC CIDR for the peering route. Required when `shared_db_vpc_id` is set. |
| `db_secret_id`                | Shared-db credentials secret id/name. When set, the runtime reads its DB connection from this secret. Null keeps the dedicated DB active. |

See `variables.tf` for the full list with descriptions and defaults.

## Testing

```bash
terraform test  # Runs iam.tftest.hcl (least-privilege validation)
```
