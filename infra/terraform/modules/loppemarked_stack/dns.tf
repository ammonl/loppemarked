# ---------- Route 53 Hosted Zone ----------
# The hosted zone is managed outside this project (the un17hub DNS repo). Each
# environment writes its records into the registrable-apex zone: staging was
# rolled into the un17hub.com zone, so staging.un17hub.com is a set of subdomain
# records there rather than its own delegated zone. route53_zone_name defaults
# to ses_sender_domain (correct for prod, where the sender domain is the apex)
# and is overridden to the apex when records live in a shared parent zone.

locals {
  route53_zone_name = coalesce(var.route53_zone_name, var.ses_sender_domain)

  # Labels of the sender domain below the hosted-zone apex ("staging" when the
  # sender is staging.un17hub.com in the un17hub.com zone; "" when the sender
  # domain is itself the apex). ".<subdomain>" (or "") suffixes record names
  # that would otherwise rely on the zone name being appended, so they resolve
  # correctly in a shared parent zone while staying byte-identical for apex
  # senders (no churn for prod).
  dns_subdomain     = trimsuffix(trimsuffix(var.ses_sender_domain, local.route53_zone_name), ".")
  dns_record_suffix = local.dns_subdomain == "" ? "" : ".${local.dns_subdomain}"
}

data "aws_route53_zone" "main" {
  name         = local.route53_zone_name
  private_zone = false
}

# ---------- SES Domain Verification ----------

resource "aws_route53_record" "ses_verification" {
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = "_amazonses.${var.ses_sender_domain}"
  type            = "TXT"
  ttl             = 600
  records         = [aws_ses_domain_identity.main.verification_token]
  allow_overwrite = true
}

# ---------- SES DKIM Records ----------

resource "aws_route53_record" "ses_dkim" {
  count = 3

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey${local.dns_record_suffix}"
  type            = "CNAME"
  ttl             = 600
  records         = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
  allow_overwrite = true
}

# ---------- Amplify Custom Domain ----------
# Amplify auto-creates DNS verification and routing records in Route 53
# when the hosted zone lives in the same AWS account. The domain
# association resource in amplify.tf manages the lifecycle; Amplify
# provisions the ACM certificate and adds the required CNAME records
# to the zone above.
