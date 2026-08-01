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
// This models a deliberately small slice of IAM: Allow/Deny over Action and
// Resource, with `*` and `?` wildcards. Anything outside that slice —
// NotAction, NotResource, Condition, principal keys — makes the verdict
// "unmodeled" rather than "granted". That distinction is the whole safety
// property: a Deny written as `NotAction` locks the role out of everything, and
// reading it as a pass would be worse than not checking at all.
//
// Modes:
//   (no args)          static. Every `aws` call in a workflow must be mapped
//                      below, and every ci-terraform action must be declared in
//                      bootstrap. Needs no credentials; runs on every PR.
//   --self-test        exercise the policy evaluator against known policies.
//   --policy <file> --role <name> --account <id>
//                      live. The actions must be granted by the policy document
//                      the role actually carries.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_DIR = ".github/workflows";
const BOOTSTRAP_POLICY = "infra/terraform/bootstrap/ci_terraform_role.tf";
// The live check only ever fetches this inline policy, so an action declared in
// a different one (terraform-state, a managed policy, or a Deny block) would
// pass the static check and then be reported missing every morning.
const DECLARING_DOCUMENT = "ci_terraform_resources";

// Every `aws <service> <command>` a workflow runs, and the IAM action it needs.
//
// `roles` maps each workflow that makes the call to the role it assumes there —
// the same call runs under different roles in different workflows, and a single
// role field would quietly attribute one of them to the wrong policy. Only
// ci-terraform is live-checked; the rest are here so the coverage check can
// prove no AWS call was added without someone deciding which permission it
// needs.
//
// `resource` is the ARN the call targets, checked against the statement's own
// resources so an action granted on the wrong scope is not read as a pass. It
// must resolve to a concrete ARN: wildcards expand on the policy side only, so
// a `*` left here matches nothing and reports a healthy role as broken.
const AWS_CALLS = [
  {
    call: "lambda get-function-url-config",
    action: "lambda:GetFunctionUrlConfig",
    roles: { "terraform.yml": "ci-terraform", "deploy.yml": "ci-deploy" },
    resource: "arn:aws:lambda:<region>:<account>:function:<prefix>-api",
    note: "terraform.yml verify-staging, resolving the URL to smoke-test",
  },
  {
    call: "iam get-role-policy",
    action: "iam:GetRolePolicy",
    roles: { "drift-detection.yml": "ci-terraform" },
    resource: "arn:aws:iam::<account>:role/<prefix>-ci-terraform",
    note: "this check reading the live policy",
  },
  {
    // Every authenticated principal may call this; there is no policy to check.
    call: "sts get-caller-identity",
    action: null,
    roles: { "drift-detection.yml": "ci-terraform" },
  },
  // ci-deploy is applied by the environment stacks, so these self-heal and
  // terraform plan already catches drift on them. Mapped, not live-checked.
  { call: "lambda update-function-code", action: "lambda:UpdateFunctionCode", roles: { "deploy.yml": "ci-deploy" } },
  {
    // The -v2 waiters poll GetFunction, not GetFunctionConfiguration — which is
    // why ci_deploy grants the former and not the latter (module iam.tf) while
    // deploy.yml's wait step works.
    call: "lambda wait function-updated-v2",
    action: "lambda:GetFunction",
    roles: { "deploy.yml": "ci-deploy" },
  },
  { call: "lambda invoke", action: "lambda:InvokeFunction", roles: { "deploy.yml": "ci-deploy" } },
  { call: "amplify start-job", action: "amplify:StartJob", roles: { "deploy-web.yml": "ci-deploy" } },
  { call: "amplify get-job", action: "amplify:GetJob", roles: { "deploy-web.yml": "ci-deploy" } },
];

const failures = [];
const fail = (message) => failures.push(message);
const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

const isCiTerraform = (entry) => Object.values(entry.roles).includes("ci-terraform");

// --------------------------------------------------------------------------
// Policy evaluation
// --------------------------------------------------------------------------

const escape = (value) => value.replace(/[.+^${}()|[\]\\]/g, "\\$&");

// IAM wildcards: `*` any run of characters, `?` exactly one.
const globToRegExp = (pattern, flags) =>
  new RegExp(`^${pattern.split(/([*?])/).map((part) => (part === "*" ? ".*" : part === "?" ? "." : escape(part))).join("")}$`, flags);

// Action names are case-insensitive; ARNs are not.
const actionMatches = (pattern, value) => globToRegExp(pattern, "i").test(value);
const resourceMatches = (pattern, value) => globToRegExp(pattern, "").test(value);

const asList = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

// Keys whose presence changes what a statement means in ways this does not
// model. Seeing one means the answer is "cannot tell", never "granted".
const UNMODELED_KEYS = ["NotAction", "NotResource", "Condition", "Principal", "NotPrincipal"];

function policyVerdict(statements, action, resource) {
  for (const statement of statements) {
    const unmodeled = UNMODELED_KEYS.filter((key) => statement[key] !== undefined);
    if (unmodeled.length > 0) {
      return {
        verdict: "unmodeled",
        detail: `statement "${statement.Sid ?? "(no Sid)"}" uses ${unmodeled.join(", ")}`,
      };
    }
  }

  const applies = (statement, effect) =>
    statement.Effect === effect &&
    asList(statement.Action).some((pattern) => actionMatches(pattern, action)) &&
    asList(statement.Resource).some((pattern) => resourceMatches(pattern, resource));

  // An explicit Deny beats any Allow, so check it first.
  if (statements.some((statement) => applies(statement, "Deny"))) {
    return { verdict: "denied" };
  }
  return { verdict: statements.some((statement) => applies(statement, "Allow")) ? "granted" : "missing" };
}

// --------------------------------------------------------------------------
// Static: no AWS call may go unmapped, and no ci-terraform action undeclared
// --------------------------------------------------------------------------

// Flags that consume the next token, so `aws --region eu-north-1 lambda invoke`
// is not read as a call to a service named "--region".
const VALUE_FLAGS = new Set([
  "--region", "--profile", "--output", "--endpoint-url", "--query", "--ca-bundle",
  "--color", "--cli-read-timeout", "--cli-connect-timeout", "--debug",
]);

const isWord = (token) => token !== undefined && /^[a-z][a-z0-9-]*$/.test(token);

// Workflows wrap calls in command substitution (`URL=$(aws lambda ...`), so the
// token carrying `aws` is rarely bare. Trailing `aws` after shell punctuation
// counts; `myaws` and `aws2` do not.
const isAwsToken = (token) => /(?:^|[^\w.-])aws$/.test(token);

// Returns every `aws` invocation on a line, not just the first: `a && b` and
// `a; b` both put two on one line, and stopping at the first hides the second.
function callsInLine(line) {
  const calls = [];
  const tokens = line.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i += 1) {
    if (!isAwsToken(tokens[i])) continue;
    let j = i + 1;
    while (j < tokens.length && tokens[j].startsWith("-")) {
      const flag = tokens[j];
      j += 1;
      if (VALUE_FLAGS.has(flag) && j < tokens.length && !tokens[j].startsWith("-")) j += 1;
    }
    if (!isWord(tokens[j]) || !isWord(tokens[j + 1])) continue;
    const [service, command] = [tokens[j], tokens[j + 1]];
    // `aws lambda wait function-updated-v2` — the waiter, not `wait`, decides
    // the permission.
    calls.push(command === "wait" && isWord(tokens[j + 2]) ? `${service} wait ${tokens[j + 2]}` : `${service} ${command}`);
  }
  return calls;
}

function checkWorkflowCoverage() {
  const byCall = new Map();

  for (const file of readdirSync(path.join(repoRoot, WORKFLOW_DIR)).filter((f) => /\.ya?ml$/.test(f))) {
    // Join backslash continuations first: workflows split long aws commands
    // across lines, and a scan per raw line would never see the service.
    const source = read(path.join(WORKFLOW_DIR, file)).replace(/\\\n\s*/g, " ");
    for (const raw of source.split("\n")) {
      if (/^\s*#/.test(raw)) continue;
      // A `#` after whitespace starts a shell comment, so anything past it is
      // prose about a call rather than a call.
      const line = raw.split(/\s+#/)[0];
      for (const call of callsInLine(line)) {
        if (!byCall.has(call)) byCall.set(call, new Set());
        byCall.get(call).add(file);
      }
    }
  }

  console.log(`AWS calls in ${WORKFLOW_DIR}: ${byCall.size}\n`);
  for (const [call, files] of byCall) {
    const entry = AWS_CALLS.find((candidate) => candidate.call === call);
    const action = entry ? (entry.action ?? "(no permission required)") : "(UNMAPPED)";
    for (const file of files) {
      const role = entry?.roles?.[file] ?? "(UNMAPPED)";
      console.log(`  aws ${call.padEnd(32)} ${action.padEnd(30)} ${role.padEnd(13)} ${file}`);
    }
    if (!entry) {
      fail(
        `${[...files].map((f) => `${WORKFLOW_DIR}/${f}`).join(", ")} runs \`aws ${call}\`, which is not mapped to an IAM action in this script, so nothing checks the role can do it.`,
      );
      continue;
    }
    // A call mapped for one workflow but made from another runs under a role
    // nobody decided on.
    for (const file of files) {
      if (!(file in entry.roles)) {
        fail(
          `${WORKFLOW_DIR}/${file} runs \`aws ${call}\`, but this script only maps that call for ${Object.keys(entry.roles).join(", ")}. Record which role ${file} assumes for it.`,
        );
      }
    }
  }

  // Scoped to the document the live check actually fetches. An action declared
  // only in terraform-state or a managed policy would otherwise pass here and
  // be reported missing by the daily job forever.
  const declared = read(BOOTSTRAP_POLICY);
  const start = declared.indexOf(`"aws_iam_policy_document" "${DECLARING_DOCUMENT}"`);
  if (start === -1) {
    fail(`${BOOTSTRAP_POLICY} has no "${DECLARING_DOCUMENT}" policy document; this script can no longer tell what is declared.`);
    return;
  }
  const next = declared.slice(start).search(/\n(?:data|resource) "/);
  const document = declared.slice(start, next === -1 ? undefined : start + next);

  for (const entry of AWS_CALLS.filter((candidate) => isCiTerraform(candidate) && candidate.action)) {
    if (!document.includes(`"${entry.action}"`)) {
      fail(
        `${BOOTSTRAP_POLICY}'s ${DECLARING_DOCUMENT} does not declare "${entry.action}", which the workflows call with the ci-terraform role.`,
      );
    }
  }
}

// --------------------------------------------------------------------------
// Live: what the role actually carries
// --------------------------------------------------------------------------

function checkLivePolicy(policyPath, roleName, accountId, region) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(policyPath, "utf8"));
  } catch (error) {
    fail(`${policyPath} is not readable JSON (${error.message}), so the live role was not verified.`);
    return;
  }
  // `aws iam get-role-policy` wraps the document; accept a bare document too.
  const statements = asList((raw.PolicyDocument ?? raw).Statement);
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

  for (const entry of AWS_CALLS.filter((candidate) => isCiTerraform(candidate) && candidate.action)) {
    const resource = entry.resource
      .replace("<prefix>", prefix)
      .replace("<account>", accountId)
      .replace("<region>", region);
    if (/[<*?]/.test(resource)) {
      fail(`Resource pattern for "${entry.action}" did not fully resolve: ${resource}. It must be a concrete ARN.`);
      continue;
    }

    const { verdict, detail } = policyVerdict(statements, entry.action, resource);
    console.log(`  ${verdict === "granted" ? "ok  " : "FAIL"}  ${entry.action.padEnd(30)} ${verdict}${detail ? ` — ${detail}` : ""}`);
    if (entry.note) console.log(`        ${entry.note}  (${resource})`);

    if (verdict === "missing") {
      fail(
        `The live ${roleName} policy does not grant "${entry.action}" on ${resource}. It is declared in ${BOOTSTRAP_POLICY}, ` +
          `so either the live role lags the configuration — apply infra/terraform/bootstrap with operator credentials — or this check's ARN matching disagrees with IAM's.`,
      );
    } else if (verdict === "denied") {
      fail(`The live ${roleName} policy explicitly denies "${entry.action}" on ${resource}, which overrides any Allow.`);
    } else if (verdict === "unmodeled") {
      fail(
        `The live ${roleName} policy cannot be evaluated for "${entry.action}": ${detail}. ` +
          `This check models only Allow/Deny over Action and Resource, so it draws no conclusion rather than a wrong one.`,
      );
    }
  }
}

// --------------------------------------------------------------------------
// Self-test: the evaluator decides whether to file an issue claiming the
// production CI role is broken, so it is checked rather than trusted.
// --------------------------------------------------------------------------

const ACTION = "lambda:GetFunctionUrlConfig";
const ARN = "arn:aws:lambda:eu-north-1:123456789012:function:loppemarked-staging-2026-api";
const allow = (Action, Resource) => ({ Sid: "A", Effect: "Allow", Action, Resource });

const CASES = [
  { name: "exact grant", statements: [allow([ACTION], [ARN])], expect: "granted" },
  { name: "prefix wildcard grant", statements: [allow([ACTION], ["arn:aws:lambda:eu-north-1:123456789012:function:loppemarked-staging-2026-*"])], expect: "granted" },
  { name: "service wildcard grant", statements: [allow(["lambda:*"], ["*"])], expect: "granted" },
  { name: "action absent", statements: [allow(["lambda:GetFunction"], [ARN])], expect: "missing" },
  { name: "granted on the wrong function family", statements: [allow([ACTION], ["arn:aws:lambda:eu-north-1:123456789012:function:loppemarked-prod-2026-*"])], expect: "missing" },
  { name: "granted then explicitly denied", statements: [allow([ACTION], [ARN]), { Sid: "D", Effect: "Deny", Action: [ACTION], Resource: [ARN] }], expect: "denied" },
  { name: "case-insensitive action match", statements: [allow(["lambda:getfunctionurlconfig"], [ARN])], expect: "granted" },
  { name: "case-sensitive resource: uppercase ARN is a different resource", statements: [allow([ACTION], [ARN.toUpperCase()])], expect: "missing" },
  { name: "single-character ? wildcard in resource", statements: [allow([ACTION], [ARN.replace("eu-north-1", "eu-north-?")])], expect: "granted" },
  { name: "? wildcard in a Deny action", statements: [allow([ACTION], [ARN]), { Sid: "D", Effect: "Deny", Action: ["lambda:GetFunctionUrlConfi?"], Resource: [ARN] }], expect: "denied" },
  // The findings that made this self-test necessary.
  { name: "NotAction Deny locking the role out of everything", statements: [allow([ACTION], [ARN]), { Sid: "D", Effect: "Deny", NotAction: ["sts:GetCallerIdentity"], Resource: "*" }], expect: "unmodeled" },
  { name: "NotResource Deny", statements: [allow([ACTION], [ARN]), { Sid: "D", Effect: "Deny", Action: "*", NotResource: ["arn:aws:s3:::x"] }], expect: "unmodeled" },
  { name: "conditional Deny that would never fire", statements: [allow([ACTION], [ARN]), { Sid: "D", Effect: "Deny", Action: [ACTION], Resource: [ARN], Condition: { NotIpAddress: { "aws:SourceIp": "10.0.0.0/8" } } }], expect: "unmodeled" },
  { name: "conditional Allow that may never fire", statements: [{ ...allow([ACTION], [ARN]), Condition: { StringEquals: { "aws:PrincipalTag/team": "infra" } } }], expect: "unmodeled" },
];

// The scanner's failure mode is silence: a call it does not see is a permission
// nothing checks, and the coverage report cannot show what it missed. Every row
// below is a shape that occurs in these workflows or broke a previous version.
const SCAN_CASES = [
  { line: "aws lambda invoke --function-name x", expect: ["lambda invoke"] },
  { line: '          URL=$(aws lambda get-function-url-config \\', expect: ["lambda get-function-url-config"] },
  { line: "  JOB=$(aws amplify start-job --app-id x)", expect: ["amplify start-job"] },
  { line: "aws --region eu-north-1 lambda invoke x", expect: ["lambda invoke"] },
  { line: "aws --output json --profile p sts get-caller-identity", expect: ["sts get-caller-identity"] },
  { line: "aws lambda wait function-updated-v2 --function-name x", expect: ["lambda wait function-updated-v2"] },
  { line: "aws lambda invoke a && aws lambda delete-function b", expect: ["lambda invoke", "lambda delete-function"] },
  { line: "aws lambda invoke a; aws iam delete-role --role-name r", expect: ["lambda invoke", "iam delete-role"] },
  { line: "echo hi  # aws s3 cp secret bucket", expect: [] },
  { line: 'echo "then run aws logs tail to debug"', expect: ["logs tail"] },
  { line: "myaws lambda invoke x", expect: [] },
  { line: "aws2 lambda invoke x", expect: [] },
  { line: "echo arn:aws:sts::1:role/x", expect: [] },
];

function selfTest() {
  console.log("\nPolicy evaluator self-test:\n");
  for (const testCase of CASES) {
    const { verdict } = policyVerdict(testCase.statements, ACTION, ARN);
    const passed = verdict === testCase.expect;
    console.log(`  ${passed ? "ok  " : "FAIL"}  ${testCase.expect.padEnd(9)} ${testCase.name}`);
    if (!passed) fail(`Self-test "${testCase.name}": expected ${testCase.expect}, got ${verdict}.`);
  }

  console.log("\nWorkflow scanner self-test:\n");
  for (const testCase of SCAN_CASES) {
    // Mirrors the per-line handling in checkWorkflowCoverage.
    const found = /^\s*#/.test(testCase.line) ? [] : callsInLine(testCase.line.split(/\s+#/)[0]);
    const passed = JSON.stringify(found) === JSON.stringify(testCase.expect);
    console.log(`  ${passed ? "ok  " : "FAIL"}  [${found.join(", ")}]  ${testCase.line.trim().slice(0, 54)}`);
    if (!passed) {
      fail(`Scanner self-test on \`${testCase.line.trim()}\`: expected [${testCase.expect}], got [${found}].`);
    }
  }
}

// --------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};

checkWorkflowCoverage();
selfTest();

if (args.includes("--policy")) {
  const [policyPath, roleName, accountId] = [flag("--policy"), flag("--role"), flag("--account")];
  const region = flag("--region") ?? "eu-north-1";
  if (!policyPath || !roleName || !accountId || !/^\d{12}$/.test(accountId)) {
    console.error("Usage: check-ci-role-permissions.mjs [--policy <file> --role <role-name> --account <12-digit-id> [--region <region>]]");
    process.exit(2);
  }
  checkLivePolicy(policyPath, roleName, accountId, region);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log("\nEvery AWS call the workflows make is mapped, declared, and granted.");
