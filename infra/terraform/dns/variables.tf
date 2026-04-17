variable "root_domain" {
  description = "Apex domain for the project. Registrar nameservers must point at this zone's DelegationSet."
  type        = string
  default     = "un17hub.com"

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", var.root_domain))
    error_message = "root_domain must be a valid domain name (e.g. example.com)."
  }
}

variable "staging_domain" {
  description = "Subdomain used by the staging environment. Must be a child of root_domain."
  type        = string
  default     = "staging.un17hub.com"

  validation {
    condition     = can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", var.staging_domain))
    error_message = "staging_domain must be a valid domain name (e.g. staging.example.com)."
  }
}

variable "staging_ns_ttl" {
  description = "TTL (seconds) for the staging NS delegation record in the apex zone."
  type        = number
  default     = 300

  validation {
    condition     = var.staging_ns_ttl >= 60 && var.staging_ns_ttl <= 86400
    error_message = "staging_ns_ttl must be between 60 and 86400 seconds."
  }
}
