# Which AWS API calls the provider actually makes

Reference for reviewing IAM least-privilege PRs against
`infra/terraform/bootstrap/ci_terraform_role.tf`. Verified against the pinned
provider **hashicorp/aws v6.34.0** (see `bootstrap/.terraform.lock.hcl`).

## How to verify (the binary is stripped, but pclntab survives)

`go tool objdump` fails with "no symbol section". Recover names from
`.gopclntab` instead:

- Build a tiny Go program using `debug/elf` + `debug/gosym`
  (`gosym.NewLineTable(pclntabData, textSection.Addr)` →
  `gosym.NewTable(nil, lt)`) to list `tab.Funcs` names + entry/end addresses,
  and to map an address back to a function (`tab.PCToFunc`).
- Disassemble one function with
  `objdump -d --start-address=<entry> --stop-address=<end> <provider-binary>`,
  extract `call 0x...` targets, resolve them through the same table.
- Provider binary lives at
  `infra/terraform/bootstrap/.terraform/providers/registry.terraform.io/hashicorp/aws/<ver>/linux_amd64/`.

**Caveat that invalidates naive "is this action dead?" scans:** SDK *list*
operations are usually reached through a paginator
(`(*Describe<Op>Paginator).NextPage`) which invokes the client method through a
stored interface — an **indirect** call. So "zero direct call sites" only proves
deadness for **non-paginated** operations. Check whether a
`(*Describe<Op>Paginator).NextPage` symbol exists before concluding anything.
Also: every `*ec2.Client` method symbol exists whether or not the provider uses
it (the type reaches an interface, so the linker keeps the whole method set) —
symbol presence proves nothing.

## Verified call chains (v6.34.0)

### `aws_security_group` — delete DOES manage ENIs

```
resourceSecurityGroupDelete
  -> deleteLingeringENIs                     (ec2:DescribeNetworkInterfaces, filter group-id)
       -> deleteLingeringLambdaENI           (also Comprehend/DMS/RDS/QuickSight variants)
            -> detachNetworkInterface        -> ec2:DetachNetworkInterface
            -> deleteNetworkInterface        -> ec2:DeleteNetworkInterface
```

So **`ec2:DetachNetworkInterface` + `ec2:DeleteNetworkInterface` are required by
whatever role destroys a security group that a VPC Lambda has used** — they are
NOT covered by the Lambda service's own `AWSLambdaVPCAccessExecutionRole`. The
grant is exercised on `terraform destroy` and on any SG *replacement*
(`name_prefix` / `description` / `vpc_id` change; the module's
`aws_security_group.lambda_shared` is `create_before_destroy`, so the old group
is deleted while Lambda ENIs still linger ~20 min). Do not let a PR prune these
on the rationale that "Lambda owns its ENIs".

### `aws_security_group` — create revokes the default egress rule

```
resourceSecurityGroupCreate -> ec2:CreateSecurityGroup
                            -> ec2:RevokeSecurityGroupEgress
```

AWS attaches an allow-all egress rule to every new SG; the provider revokes it so
Terraform owns egress exclusively. `ec2:RevokeSecurityGroupEgress` is therefore
needed even for a group whose rules are all managed elsewhere.
`resourceSecurityGroupRead` -> `findSecurityGroupByID` (`ec2:DescribeSecurityGroups`).

### `aws_vpc_security_group_egress_rule` / `_ingress_rule`

`(*securityGroupRuleResource).Update` -> **`ec2:ModifySecurityGroupRules`**.
`description`, `cidr_ipv4`, `ip_protocol`, `from_port`, `to_port` are in-place
updates, not replacements. As of PR #308 this action is granted **nowhere** in
`ci_terraform_role.tf` (absent on `main` too) — editing the egress rule's
description or CIDR will fail with AccessDenied. Pre-existing gap; flag it.

### `aws_lambda_function` makes **no** EC2 calls

`resourceFunctionCreate/Read/Update/Delete` contain zero calls into
`aws-sdk-go-v2/service/ec2`. `vpc_config` round-trips through
`GetFunctionConfiguration`. Any comment claiming ec2 `Describe*` grants exist
"for the Lambda's vpc_config" is wrong.

### Non-paginated ops — direct-call-site scan is authoritative

- `ec2:DescribeVpcAttribute` — sole caller `ec2.findVPCAttribute`
  (`aws_vpc` resource / `data.aws_vpc`). Neither exists in this repo → dead.
- `ec2:DescribeNetworkInterfaceAttribute` — **zero call sites provider-wide**.
  The provider reads `SourceDestCheck` off the `DescribeNetworkInterfaces`
  response instead. Unreachable, always safe to drop.
