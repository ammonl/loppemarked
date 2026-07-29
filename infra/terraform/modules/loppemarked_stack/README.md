# loppemarked_stack module

Composable Terraform module for all UN17 Village Loppemarked AWS resources. Used by both
the staging and production environment stacks.

## Resources provisioned

| File             | Resources                                                  |
|------------------|------------------------------------------------------------|
| `networking.tf`  | Egress-only Lambda security group in the shared default VPC |
| `iam.tf`         | API runtime role, CI deploy role, CI Terraform role        |
| `secrets.tf`     | Application secrets (Secrets Manager, AWS-managed key)      |
| `ses.tf`         | SES domain identity, DKIM, configuration set               |
| `dns.tf`         | None — documents that all Route 53 records are owned by the un17hub DNS repo (see outputs) |
| `monitoring.tf`  | CloudWatch log groups, optional dashboard / alarms / SNS topic |
| `api_runtime.tf` | API Lambda function, function URL, EventBridge schedules   |
| `api_domain.tf`  | Stable API domain: us-east-1 ACM cert + CloudFront distribution fronting the Function URL (no DNS records) |
| `amplify.tf`     | Amplify app (managed repository URL), branch, and custom domain association |

> The dedicated per-environment VPC (subnets, gateways, SES + Secrets Manager
> interface endpoints, flow logs), the dedicated RDS PostgreSQL instance (subnet
> group, parameter group, DB credentials secret, monitoring role), the
> shared-db VPC peering, and the per-stack data KMS key were retired in #222.
> Both environments now run entirely on the shared default VPC and shared-db.

## Provider configuration

The module requires two AWS provider configurations: the default (the
environment's primary region, `eu-north-1`) and `aws.us_east_1`. CloudFront
ACM certificates must live in `us-east-1`, so the stable API domain
(`api_domain.tf`) requests its certificate through the aliased provider. Each
environment stack declares both and passes them via the module `providers`
map.

## Log & alarm-topic encryption

The API log group is encrypted at rest with CloudWatch Logs' default AWS-owned
key. Each environment used to run a per-stack customer-managed key
(`aws_kms_key.logs`) instead, which cost about $1/month and bought nothing this
project needs — logs are encrypted either way. It was removed along with its
alias, key policy, and the `logs_kms_key_arn` output (#298).

Log events written *before* that removal stay encrypted under the CMK, and
scheduling a KMS key for deletion makes it unusable immediately — so that history
is **unreadable** from the moment the removal applies. Accepting that loss rather
than waiting out the retention window was a deliberate call by the account owner.
If you are chasing an incident from before the retirement, those logs are gone,
not broken.

It is recoverable for exactly one window: the key sits in `PendingDeletion` for
30 days (the provider default), and `aws kms cancel-key-deletion` followed by
`aws kms enable-key` within that window makes the old events readable again.
After the 30 days the key material is destroyed and there is no way back.

The alarm SNS topic has **no** server-side encryption. SNS has no AWS-owned
fallback — SSE is opt-in — and an AWS service event source can publish to an
encrypted topic only through a customer-managed key whose policy names that
service principal. `alias/aws/sns` cannot be given such a policy, so encrypting
the topic with it would silently block the CloudWatch alarms that are its only
publisher. The topic carries alarm name, metric, and state, and no personal data.
No compensating topic policy is needed: the default one (`AWS:SourceOwner` equal
to the account) already lets CloudWatch alarms publish.

That is not hypothetical. While the topic was encrypted, the key policy granted
only `logs.<region>.amazonaws.com` and never `cloudwatch.amazonaws.com`, so prod
alarm notifications were being rejected at the KMS step for as long as SSE was
on — dropping it repairs that. Re-verify delivery end to end after any change
here, and check the email subscription is `Confirmed` rather than
`PendingConfirmation` while you are in there.

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

### DNS records (owned by the un17hub DNS repo)

This module owns **no** Route 53 records. The `un17hub.com` hosted zone and
every record in it are managed by the separate un17hub DNS repo. This module
exposes the values that repo needs, and it publishes the records:

| Record | Output(s) to consume |
|--------|----------------------|
| `_amazonses.<domain>` TXT (SES verification) | `ses_verification_token` |
| `<token>._domainkey.<domain>` CNAME ×3 (DKIM) | `ses_dkim_tokens` |
| API cert DNS-validation CNAME | `api_acm_validation` (name/type/value) |
| `loppemarked-api.<domain>` A/AAAA alias → CloudFront | `api_cloudfront_domain`, `api_cloudfront_hosted_zone_id` |

SES verifies the domain and enables DKIM signing once those records exist. The
API ACM certificate uses DNS validation, and CloudFront can only attach an
**issued** cert — so the un17hub repo must publish `api_acm_validation` (and the
cert must validate) before this stack's CloudFront distribution can be created.
For a net-new environment that means: apply this stack (creates the pending
cert; the CloudFront step fails until the cert is issued), publish the
validation record in un17hub from the `api_acm_validation` output, then re-apply.

The Amplify custom-domain records are the one exception: the
`aws_amplify_domain_association` (`amplify.tf`) is a managed Amplify mechanism
that provisions its own ACM certificate and Route 53 records automatically.

## Amplify app configuration

The Amplify app's `repository` (`amplify_repository`, default the
`ammonl/loppemarked` GitHub URL) is managed by Terraform, so prod and staging
can't silently drift onto different repos. The GitHub connection token stays
out of Terraform — `access_token`/`oauth_token` are write-only (never returned
by the API), so they remain in `ignore_changes` and the repo connection is
authorized once out-of-band.

`iam_service_role_arn` also stays in `ignore_changes`: the pinned AWS provider
(6.34.0) treats a change to it as force-new, so managing it in Terraform would
destroy and recreate the entire app (new app id + domain association). The
build service role is kept consistent out-of-band instead.

## API Lambda runtime configuration

The API Lambda receives database, email, and public-URL configuration through
its `environment.variables` block:

| Variable         | Source                                                                 |
|------------------|------------------------------------------------------------------------|
| `ENVIRONMENT`    | `var.environment` (e.g. `staging`, `prod`)                             |
| `EMAIL_FROM`     | `var.ses_sender_email` or `loppemarked@<ses_sender_domain>`            |
| `EMAIL_REPLY_TO` | `var.ses_reply_to_email`                                               |
| `PUBLIC_WEB_URL` | `https://<amplify_domain_prefix>.<ses_sender_domain>`                  |
| `DB_SECRET_ID`   | `var.db_secret_id`                                                     |
| `DB_SSL`         | `"true"`                                                               |

The runtime builds its entire database connection from the shared-db secret
named by `var.db_secret_id` (`host`, `port`, `database`, `username`,
`password`). The dedicated-RDS wiring (`DB_HOST` / `DB_PORT` / `DB_NAME` /
`DB_USER` / `DB_SECRET_ARN`) was removed when the dedicated instances were
retired (#222).

`PUBLIC_WEB_URL` anchors outbound email links such as the resident
self-cancellation magic link. With the current variable defaults this resolves
to `https://loppemarked.staging.un17hub.com` for staging and
`https://loppemarked.un17hub.com` for production.

## Shared-VPC tenancy

The API Lambda runs in the shared default VPC owned by un17-infra-shared. Set
`shared_vpc_id` (and `shared_private_subnet_ids`) to attach it to the published
private egress subnets with its own egress-only `lambda_shared` security group;
it reaches shared-db (VPC-local), Secrets Manager, and SES over the shared NAT
gateway. Both inputs are required — the dedicated per-environment VPC and RDS
instance were retired in #222, so this is the only network the Lambda runs in.

Consume the shared network identifiers from SSM at plan time rather than
hardcoding them (`/shared/network/vpc-id`, `/shared/network/private-subnet-ids`):

```hcl
data "aws_ssm_parameter" "shared_vpc_id" {
  name = "/shared/network/vpc-id"
}

data "aws_ssm_parameter" "shared_private_subnet_ids" {
  name = "/shared/network/private-subnet-ids"
}

module "loppemarked_stack" {
  # ...
  shared_vpc_id             = data.aws_ssm_parameter.shared_vpc_id.value
  shared_private_subnet_ids = split(",", data.aws_ssm_parameter.shared_private_subnet_ids.value)
}
```

## Stable API domain

The web frontend reaches the API through Next.js `rewrites()`, whose
destination is baked into the Amplify build **at build time** from the
`API_URL` environment variable. Pointing `API_URL` at the raw Lambda Function
URL was fragile: the Function URL subdomain is regenerated whenever the
function is replaced. After such a replacement the deployed build kept
proxying to the now-deleted URL and every API-proxied path returned
`HTTP 403 AccessDeniedException` until someone manually rebuilt the Amplify
app.

`api_domain.tf` fronts the Function URL with a stable CloudFront domain
(`<api_domain_prefix>.<ses_sender_domain>`, e.g. `loppemarked-api.staging.un17hub.com` /
`loppemarked-api.un17hub.com`) and sets Amplify's `API_URL` to that host. The
prefix is deliberately not `api`, because `api.<domain>` is already owned by
the un17hub DNS repo's own API Gateway backend. The CloudFront
origin tracks the current Function URL, so a function replacement updates the
origin on the next `terraform apply` while the hostname the web build depends
on never changes — no web rebuild required. The distribution uses the managed
`Managed-CachingDisabled` and `Managed-AllViewerExceptHostHeader` policies so
it behaves as a transparent API proxy (no caching; forwards cookies, headers,
and query strings; sends the origin's own Host).

The `loppemarked-api.<domain>` alias and the certificate's DNS-validation record are **not**
created here — the un17hub DNS repo publishes them from the `api_cloudfront_domain`
/ `api_cloudfront_hosted_zone_id` and `api_acm_validation` outputs (see
[DNS records](#dns-records-owned-by-the-un17hub-dns-repo)).

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
| `ses_sender_domain`           | Domain for the SES identity and the environment's DNS record names |
| `ses_reply_to_email`          | Default Reply-To (defaults to `ammonl@hotmail.com`)  |
| `enable_observability_alerts` | Provision the dashboard, metric alarms, and alerting SNS topic. Defaults to `true`; staging sets it to `false`. |
| `enable_api_custom_domain`    | Front the Function URL with a stable CloudFront domain and point `API_URL` at it. Defaults to `true`. |
| `api_domain_prefix`           | Subdomain label for the stable API domain (`loppemarked-api` → `loppemarked-api.<ses_sender_domain>`; kept distinct from un17hub's `api.<domain>`). |
| `shared_vpc_id`               | Shared default VPC id to run the API Lambda in (from `/shared/network/vpc-id`). Required. |
| `shared_private_subnet_ids`   | Shared-VPC private egress subnet ids for the Lambda (from `/shared/network/private-subnet-ids`). Required. |
| `db_secret_id`                | Shared-db credentials secret id/name. The runtime reads its DB connection from this secret. Required. |

See `variables.tf` for the full list with descriptions and defaults.

## Testing

```bash
terraform test  # Runs iam.tftest.hcl (least-privilege validation)
```
