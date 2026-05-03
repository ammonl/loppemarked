output "state_bucket_name" {
  description = "S3 bucket holding Terraform remote state."
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_arn" {
  description = "ARN of the state bucket."
  value       = aws_s3_bucket.tfstate.arn
}

output "lock_table_name" {
  description = "DynamoDB table used for state locking."
  value       = aws_dynamodb_table.tflock.name
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC identity provider."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "ci_terraform_role_arns" {
  description = "Map of environment name → CI Terraform role ARN. Populate the GitHub repository variables (TF_ROLE_ARN_STAGING / TF_ROLE_ARN_PROD) from these values."
  value       = { for env, role in aws_iam_role.ci_terraform : env => role.arn }
}
