output "root_zone_id" {
  description = "Zone ID for the apex hosted zone. Pass to the prod env stack."
  value       = aws_route53_zone.root.zone_id
}

output "root_zone_name" {
  description = "Name of the apex hosted zone."
  value       = aws_route53_zone.root.name
}

output "root_nameservers" {
  description = "Nameservers for the apex hosted zone. Delegate these from the registrar."
  value       = aws_route53_zone.root.name_servers
}

output "staging_zone_id" {
  description = "Zone ID for the staging hosted zone. Pass to the staging env stack."
  value       = aws_route53_zone.staging.zone_id
}

output "staging_zone_name" {
  description = "Name of the staging hosted zone."
  value       = aws_route53_zone.staging.name
}

output "staging_nameservers" {
  description = "Nameservers for the staging hosted zone. Also written into the apex zone as the staging NS delegation."
  value       = aws_route53_zone.staging.name_servers
}
