# ---------- DNS ----------
# This stack owns no Route 53 records. The un17hub DNS repo owns the
# un17hub.com hosted zone and every record in it, including the ones this
# stack's resources depend on:
#
#   - SES domain verification (TXT) and DKIM (CNAME) — see the
#     ses_verification_token / ses_dkim_tokens outputs.
#   - The API certificate's DNS validation record — see the api_acm_validation
#     output.
#   - The api.<domain> alias to CloudFront — see api_cloudfront_domain /
#     api_cloudfront_hosted_zone_id.
#
# The SES identity/DKIM (ses.tf), ACM certificate and CloudFront distribution
# (api_domain.tf) are managed here; only their DNS records live in un17hub.
#
# The Amplify custom-domain records are the one exception: the
# aws_amplify_domain_association in amplify.tf is a managed Amplify mechanism
# that provisions its own ACM certificate and Route 53 records automatically
# when the hosted zone is in the same account.
