# ---------- Stable API Domain (CloudFront) ----------
# The Lambda Function URL subdomain is regenerated whenever the function is
# replaced (e.g. a VPC re-IP via the replace_triggered_by in api_runtime.tf).
# Next.js bakes API_URL into the Amplify build at build time, so a raw Function
# URL leaves the deployed frontend proxying to a now-deleted URL (HTTP 403
# AccessDeniedException) until a manual rebuild. Fronting the function with a
# stable CloudFront domain (api.<ses_sender_domain>) decouples the web build
# from function replacements: CloudFront's origin follows the new Function URL
# on the next apply, while the hostname the build depends on never changes.

locals {
  api_domain_name = var.enable_api_custom_domain ? "${var.api_domain_prefix}.${var.ses_sender_domain}" : null

  # CloudFront custom origins take a bare host, not a URL. The Function URL is
  # "https://<id>.lambda-url.<region>.on.aws/" with a trailing slash.
  api_function_url_host = trimsuffix(trimprefix(aws_lambda_function_url.api.function_url, "https://"), "/")
}

# ---------- ACM Certificate (us-east-1, required by CloudFront) ----------
# DNS validation records are created in the un17hub DNS repo, not here — this
# stack owns no Route 53 records. The cert's validation name/value are exposed
# via the api_acm_validation output for that repo to publish. CloudFront can
# only attach an issued certificate, so the validation record must exist (cert
# validated) before the distribution below is created.

resource "aws_acm_certificate" "api" {
  count    = var.enable_api_custom_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name       = local.api_domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.naming_prefix}-api"
  }
}

# ---------- CloudFront Distribution ----------
# Managed policies turn the distribution into a transparent API proxy: caching
# disabled, and all viewer headers (except Host), cookies, and query strings
# forwarded to the origin. CloudFront sends the origin's own host as the Host
# header, which the Function URL requires.

data "aws_cloudfront_cache_policy" "caching_disabled" {
  count = var.enable_api_custom_domain ? 1 : 0
  name  = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  count = var.enable_api_custom_domain ? 1 : 0
  name  = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "api" {
  count = var.enable_api_custom_domain ? 1 : 0

  enabled         = true
  comment         = "${local.naming_prefix}-api stable domain"
  aliases         = [local.api_domain_name]
  is_ipv6_enabled = true
  price_class     = "PriceClass_100"

  origin {
    origin_id   = "lambda-function-url"
    domain_name = local.api_function_url_host

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "lambda-function-url"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled[0].id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host[0].id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.api[0].arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${local.naming_prefix}-api"
  }
}

# The loppemarked-api.<domain> alias records that point at this distribution are created in
# the un17hub DNS repo. api_cloudfront_domain / api_cloudfront_hosted_zone_id
# expose the alias target.
