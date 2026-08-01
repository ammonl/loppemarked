#!/usr/bin/env node
//
// Checks that the AWS calls the workflows make are permissions the ci-terraform
// role actually has.
//
// Why this role and no other: `ci_terraform` is declared in
// infra/terraform/bootstrap, and CI only ever applies environments/{staging,prod}.
// So the live role is whatever an operator last applied by hand, and nothing
// reconciles it. `ci_deploy` and `api_runtime` live in the stack module, which
// the environment applies cover, so drift there is already caught by
// drift-detection's terraform plan. Bootstrap cannot be added to that plan —
// the CI role has no permission to read the bootstrap stack (#289) — but it can
// read its own inline policies, which is enough to catch the case that bites.
//
// The case that bites: a workflow calls an AWS API the live policy does not
// grant. It surfaces mid-deploy as an AccessDenied, and for verify-staging that
// means every production apply is blocked until someone applies bootstrap.
//
// Two modes:
//   (no args)          static. Every `aws` call in a workflow must be mapped
//                      below, and every ci-terraform action must be declared in
//                      bootstrap. Needs no credentials; runs on every PR.
//   --policy <file>    live. The actions above must be granted by the policy
//                      document the role actually carries.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_DIR = ".github/workflows";
const BOOTSTRAP_POLICY = "infra/terraform/bootstrap/ci_terraform_role.tf";

// Every `aws <service> <command>` a workflow runs, and the IAM action it needs.
//
// `role` records which role is assumed for that step. Only `ci-terraform` is
// live-checked; the rest are here so the coverage check below can prove no AWS
// call has been added without someone deciding which permission it needs.
//
// `resource` is the ARN the call targets, checked against the statement's own
// resources so that an action granted on the wrong scope is not read as a pass.
// It must be a concrete ARN: wildcards expand on the policy side only, so a `*`
// left here is a literal that matches nothing and reports a healthy role as
// broken. `<prefix>` and `<account>` are substituted from the assumed identity.
const AWS_CALLS = [
  {
    call: "lambda get-function-url-config",
    action: "lambda:GetFunctionUrlConfig",
    role: "ci-terraform",
    resource: "arn:aws:lambda:eu-north-1:<account>:function:<prefix>-api",
    note: "terraform.yml verify-staging, resolving the URL to smoke-test",
  },
  {
    call: "iam get-role-policy",
    action: "iam:GetRolePolicy",
    role: "ci-terraform",
    resource: "arn:aws:iam::<account>:role/<prefix>-ci-terraform",
    note: "this check reading the live policy — if it is missing the job fails at the call",
  },
  {
    // Every authenticated principal may call this; there is no policy to check.
    call: "sts get-caller-identity",
    action: null,
    role: "ci-terraform",
  },
  // ci-deploy is applied by the environment stacks, so these self-heal. Mapped
  // rather than live-checked.
  { call: "lambda update-function-code", action: "lambda:UpdateFunctionCode", role: "ci-deploy" },
  { call: "lambda wait function-updated-v2", action: "lambda:GetFunctionConfiguration", role: "ci-deploy" },
  { call: "lambda invoke", action: "lambda:InvokeFunction", role: "ci-deploy" },
  { call: "amplify start-job", action: "amplify:StartJob", role: "ci-deploy" },
  { call: "amplify get-job", action: "amplify:GetJob", role: "ci-deploy" },
];

const failures = [];
const fail = (message) => failures.push(message);
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

// --------------------------------------------------------------------------
// Matching
// --------------------------------------------------------------------------

const escape = (value) => value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

// IAM wildcards are `*` (any run of characters) and are case-insensitive.
const globMatches = (pattern, value) =>
  new RegExp(`^${pattern.split("*").map(escape).join(".*")}$`, "i").test(value);

const asList = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

// --------------------------------------------------------------------------
// Static: no AWS call may go unmapped, and no ci-terraform action undeclared
// --------------------------------------------------------------------------

function checkWorkflowCoverage() {
  const mapped = new Set(AWS_CALLS.map((entry) => entry.call));
  const found = new Map();

  for (const file of readdirSync(path.join(repoRoot, WORKFLOW_DIR)).filter((f) => /\.ya?ml$/.test(f))) {
    const source = read(path.join(WORKFLOW_DIR, file));
    for (const line of source.split("\n")) {
      // Comments describe calls as often as they make them.
      if (/^\s*#/.test(line)) continue;
      const match = /\baws\s+([a-z0-9-]+)\s+([a-z0-9-]+)(?:\s+([a-z0-9-]+))?/.exec(line);
      if (!match) continue;
      const [, service, command, argument] = match;
      // `aws lambda wait function-updated-v2` — the waiter, not `wait`, is what
      // determines the permission.
      const call = command === "wait" ? `${service} ${command} ${argument}` : `${service} ${command}`;
      // Every caller, not just the first: the same call made from two workflows
      // runs under two different roles, and hiding one of them behind the other
      // is how a permission gets checked for the wrong role.
      if (!found.has(call)) found.set(call, new Set());
      found.get(call).add(file);
    }
  }

  for (const [call, files] of found) {
    if (!mapped.has(call)) {
      fail(
        `${[...files].map((f) => `${WORKFLOW_DIR}/${f}`).join(", ")} runs \`aws ${call}\` but it is not mapped to an IAM action in ${path.basename(fileURLToPath(import.meta.url))}, so nothing checks the role can do it.`,
      );
    }
  }

  console.log(`AWS calls in ${WORKFLOW_DIR}: ${found.size}\n`);
  for (const [call, files] of found) {
    const entry = AWS_CALLS.find((candidate) => candidate.call === call);
    // A mapped call that needs no permission is not the same as an unmapped one.
    const action = entry ? (entry.action ?? "(no permission required)") : "(UNMAPPED)";
    console.log(`  aws ${call.padEnd(32)} ${action.padEnd(32)} ${(entry?.role ?? "?").padEnd(13)} ${[...files].join(", ")}`);
  }

  // A call we depend on but never declared would pass the live check only
  // because the live role is broader than the config.
  const declared = read(BOOTSTRAP_POLICY);
  for (const entry of AWS_CALLS.filter((candidate) => candidate.role === "ci-terraform" && candidate.action)) {
    if (!declared.includes(`"${entry.action}"`)) {
      fail(`${BOOTSTRAP_POLICY} does not declare "${entry.action}", which the workflows call with the ci-terraform role.`);
    }
  }
}

// --------------------------------------------------------------------------
// Live: what the role actually carries
// --------------------------------------------------------------------------

function checkLivePolicy(policyPath, roleName, accountId) {
  const raw = JSON.parse(readFileSync(policyPath, "utf8"));
  // `aws iam get-role-policy` wraps the document; accept a bare document too.
  const document = raw.PolicyDocument ?? raw;
  const statements = asList(document.Statement);
  if (statements.length === 0) {
    fail(`${policyPath} has no Statement array — the live policy could not be read, so nothing was verified.`);
    return;
  }

  // loppemarked-staging-2026-ci-terraform -> loppemarked-staging-2026
  const prefix = roleName.replace(/-ci-terraform$/, "");
  if (prefix === roleName) {
    fail(`Could not derive a naming prefix from role "${roleName}"; expected it to end in -ci-terraform.`);
    return;
  }

  console.log(`\nLive policy for ${roleName} — ${statements.length} statements\n`);

  for (const entry of AWS_CALLS.filter((candidate) => candidate.role === "ci-terraform" && candidate.action)) {
    const resource = entry.resource.replace("<prefix>", prefix).replace("<account>", accountId);
    // An unsubstituted placeholder would silently match nothing and report a
    // healthy role as broken, which is worse than not checking at all.
    if (/[<*]/.test(resource)) {
      fail(`Resource pattern for "${entry.action}" did not fully resolve: ${resource}. It must be a concrete ARN.`);
      continue;
    }

    const allowed = statements.some(
      (statement) =>
        statement.Effect === "Allow" &&
        asList(statement.Action).some((action) => globMatches(action, entry.action)) &&
        asList(statement.Resource).some((pattern) => globMatches(pattern, resource)),
    );
    // An explicit Deny beats any Allow, so a granted action can still be unusable.
    const denied = statements.some(
      (statement) =>
        statement.Effect === "Deny" &&
        asList(statement.Action).some((action) => globMatches(action, entry.action)) &&
        asList(statement.Resource).some((pattern) => globMatches(pattern, resource)),
    );

    const ok = allowed && !denied;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${entry.action.padEnd(30)} on ${resource}`);
    if (entry.note) console.log(`        ${entry.note}`);

    if (!allowed) {
      fail(
        `The live ${roleName} policy does not grant "${entry.action}" on ${resource}. ` +
          `It is declared in ${BOOTSTRAP_POLICY}, so the live role lags the configuration — apply infra/terraform/bootstrap with operator credentials.`,
      );
    } else if (denied) {
      fail(`The live ${roleName} policy explicitly denies "${entry.action}" on ${resource}, which overrides the Allow.`);
    }
  }
}

// --------------------------------------------------------------------------

const args = process.argv.slice(2);
const policyIndex = args.indexOf("--policy");

checkWorkflowCoverage();

if (policyIndex !== -1) {
  const policyPath = args[policyIndex + 1];
  const roleName = args[args.indexOf("--role") + 1];
  const accountId = args[args.indexOf("--account") + 1];
  if (!policyPath || !roleName || !accountId || !/^\d{12}$/.test(accountId)) {
    console.error("Usage: check-ci-role-permissions.mjs [--policy <file> --role <role-name> --account <12-digit-id>]");
    process.exit(2);
  }
  checkLivePolicy(policyPath, roleName, accountId);
} else {
  console.log("\nStatic checks only. Pass --policy <file> --role <name> to verify the live role.");
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log("\nEvery AWS call the workflows make is mapped, declared, and granted.");
