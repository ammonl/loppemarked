# ---------- Route 53 Hosted Zone ----------
# The hosted zone is managed outside this project. Look it up by name so
# SES + Amplify records land in the live, NS-delegated zone.

data "aws_route53_zone" "main" {
  name         = var.ses_sender_domain
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
  name            = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey"
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
