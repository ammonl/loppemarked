# ---------- Shared-DB VPC Peering (requester side) ----------
#
# Provides a private network path from the API Lambda (in this VPC's private
# subnets) to the shared RDS instance owned by `infra-shared-db`. We create a
# peering connection per environment so staging and prod fail independently and
# each carries a distinct Name tag.
#
# Gated on `local.create_peering` (`var.shared_db_vpc_id` set AND not in
# shared-tenancy mode): when the Lambda moves into the shared VPC, shared-db is
# VPC-local and this requester-side peering is torn down. When `shared_db_vpc_id`
# is null (the default) no peering resources are created. The accepter-side route,
# RDS SG ingress, and
# `accepter.allow_remote_vpc_dns_resolution` are owned by the shared-db repo,
# whose `data.aws_vpc_peering_connection` lookup cannot resolve until this
# requester apply exists. `auto_accept = true` works because both VPCs live in
# the same AWS account and region. DB traffic does not move onto this peering
# until DB_SECRET_ID is wired in Phase D; the connection is preparatory.

resource "aws_vpc_peering_connection" "shared_db" {
  count = local.create_peering ? 1 : 0

  vpc_id      = aws_vpc.main[0].id
  peer_vpc_id = var.shared_db_vpc_id
  auto_accept = true

  # The accepter side (infra-shared-db) discovers this connection by an exact
  # `tag:Name` match, so the rendered string must be byte-for-byte:
  # loppemarked-staging-2026-shared-db-peering / loppemarked-prod-2026-shared-db-peering.
  tags = {
    Name = "${local.naming_prefix}-shared-db-peering"
  }

  lifecycle {
    precondition {
      condition     = var.shared_db_vpc_cidr != null
      error_message = "shared_db_vpc_cidr must be provided when shared_db_vpc_id is set; the private route table needs a destination CIDR for the peering route."
    }
  }
}

resource "aws_vpc_peering_connection_options" "shared_db" {
  count = local.create_peering ? 1 : 0

  vpc_peering_connection_id = aws_vpc_peering_connection.shared_db[0].id

  requester {
    allow_remote_vpc_dns_resolution = true
  }
}

resource "aws_route" "private_to_shared_db" {
  count = local.create_peering ? 1 : 0

  route_table_id            = aws_route_table.private[0].id
  destination_cidr_block    = var.shared_db_vpc_cidr
  vpc_peering_connection_id = aws_vpc_peering_connection.shared_db[0].id
}
