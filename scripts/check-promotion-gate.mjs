#!/usr/bin/env node
//
// Checks that terraform.yml really refuses to apply to production when staging
// did not verify.
//
// The promise lives entirely in apply-prod's `if:` expression. The `needs:`
// edge on verify-staging does not block on its own — `!cancelled()` is there
// precisely so the job still runs when an upstream is skipped, which means a
// gate that lists verify-staging but never tests its result promotes a broken
// staging straight to prod, and looks identical in a diff to one that works.
//
// So this reads the real expression out of the workflow and evaluates it over a
// table of upstream outcomes. Anything the evaluator cannot model faithfully is
// an error rather than a pass, because a check that quietly stops covering the
// gate is the same failure dressed differently.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TERRAFORM = ".github/workflows/terraform.yml";

// --------------------------------------------------------------------------
// Reading jobs out of the workflow
//
// A targeted reader rather than a YAML parser: the repo has no YAML dependency,
// and every lookup below throws when it does not find what it expects, so a
// reformatted workflow fails the check instead of silently matching nothing.
// --------------------------------------------------------------------------

const normalize = (value) => value.replace(/\s+/g, " ").trim();

function jobBlock(source, file, jobId) {
  const lines = source.split("\n");
  const start = lines.indexOf(`  ${jobId}:`);
  if (start === -1) {
    throw new Error(`${file} has no job "${jobId}".`);
  }
  let end = start + 1;
  // A comment at job indentation is not the next job. Treating it as one would
  // truncate the block, and a truncated block reads as "key absent" — which the
  // optional lookups below would then pass off as agreement.
  while (end < lines.length && (!/^ {2}\S/.test(lines[end]) || /^\s*#/.test(lines[end]))) {
    end += 1;
  }
  return lines.slice(start + 1, end);
}

// Returns null when the key is absent — callers that require it say so.
function jobKey(block, file, jobId, key) {
  const at = block.findIndex((line) => new RegExp(`^ {4}${key}:`).test(line));
  if (at === -1) {
    return null;
  }
  const inline = block[at].replace(new RegExp(`^ {4}${key}:`), "").trim();
  if (!["", ">", ">-", "|", "|-"].includes(inline)) {
    return normalize(inline);
  }
  const folded = [];
  for (let i = at + 1; i < block.length; i += 1) {
    if (!/^ {6}\S/.test(block[i])) {
      break;
    }
    folded.push(block[i].trim());
  }
  if (folded.length === 0) {
    throw new Error(`${file}: job "${jobId}" has an empty "${key}:" block.`);
  }
  return normalize(folded.join(" "));
}

function requireJobKey(block, file, jobId, key) {
  const value = jobKey(block, file, jobId, key);
  if (value === null) {
    throw new Error(`${file}: job "${jobId}" has no "${key}:".`);
  }
  return value;
}

// Handles the scalar, flow-sequence and block-sequence spellings. Getting this
// wrong is worse than it looks: a needs: list this cannot read comes back empty
// and the check reports a hole in the production gate that does not exist.
function parseNeeds(value) {
  const inner = value.startsWith("[") ? value.slice(1, -1) : value;
  return inner
    .split(/[,\s]+/)
    .map((entry) => entry.replace(/^-+/, "").replace(/["']/g, "").trim())
    .filter(Boolean);
}

// --------------------------------------------------------------------------
// GitHub Actions expression evaluation
// --------------------------------------------------------------------------

function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (/\s/.test(char)) {
      i += 1;
    } else if (char === "(" || char === ")") {
      tokens.push({ type: char });
      i += 1;
    } else if (["&&", "||", "==", "!="].some((op) => source.startsWith(op, i))) {
      tokens.push({ type: source.slice(i, i + 2) });
      i += 2;
    } else if (char === "!") {
      tokens.push({ type: "!" });
      i += 1;
    } else if (char === "'") {
      let j = i + 1;
      let value = "";
      while (j < source.length && !(source[j] === "'" && source[j + 1] !== "'")) {
        // '' is an escaped quote inside a GitHub expression string.
        value += source[j];
        j += source[j] === "'" ? 2 : 1;
      }
      if (j >= source.length) {
        throw new Error(`Unterminated string in gate expression: ${source}`);
      }
      tokens.push({ type: "string", value });
      i = j + 1;
    } else {
      const word = /^[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*/.exec(source.slice(i));
      if (!word) {
        throw new Error(`Unexpected character ${JSON.stringify(char)} in gate expression.`);
      }
      i += word[0].length;
      if (["true", "false", "null"].includes(word[0])) {
        // Literals, not context lookups. Without this a plausible bad edit
        // (`... == true`) would be reported as an unreadable context path.
        tokens.push({ type: "literal", value: word[0] === "null" ? null : word[0] === "true" });
        continue;
      }
      if (source[i] === "(") {
        if (source[i + 1] !== ")") {
          throw new Error(`Gate expression calls ${word[0]}() with arguments, which this check does not model.`);
        }
        tokens.push({ type: "call", name: word[0] });
        i += 2;
      } else {
        tokens.push({ type: "path", name: word[0] });
      }
    }
  }
  return tokens;
}

// Precedence, loosest first: || then && then ==/!= then ! then primary.
function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos]?.type;

  const parseOr = () => {
    let node = parseAnd();
    while (peek() === "||") {
      pos += 1;
      node = { op: "||", left: node, right: parseAnd() };
    }
    return node;
  };
  const parseAnd = () => {
    let node = parseEquality();
    while (peek() === "&&") {
      pos += 1;
      node = { op: "&&", left: node, right: parseEquality() };
    }
    return node;
  };
  const parseEquality = () => {
    let node = parseUnary();
    while (peek() === "==" || peek() === "!=") {
      const op = tokens[pos].type;
      pos += 1;
      node = { op, left: node, right: parseUnary() };
    }
    return node;
  };
  const parseUnary = () => {
    if (peek() === "!") {
      pos += 1;
      return { op: "!", operand: parseUnary() };
    }
    return parsePrimary();
  };
  const parsePrimary = () => {
    const token = tokens[pos];
    if (!token) {
      throw new Error("Gate expression ended early.");
    }
    pos += 1;
    if (token.type === "(") {
      const node = parseOr();
      if (tokens[pos]?.type !== ")") {
        throw new Error("Unbalanced parentheses in gate expression.");
      }
      pos += 1;
      return node;
    }
    if (token.type === "string" || token.type === "literal") return { op: "literal", value: token.value };
    if (token.type === "call") return { op: "call", name: token.name };
    if (token.type === "path") return { op: "path", name: token.name };
    throw new Error(`Unexpected "${token.type}" in gate expression.`);
  };

  const ast = parseOr();
  if (pos !== tokens.length) {
    throw new Error("Trailing tokens in gate expression.");
  }
  return ast;
}

const truthy = (value) => (typeof value === "string" ? value !== "" : Boolean(value));

function resolve(reference, run) {
  const parts = reference.split(".");
  if (parts[0] !== "needs") {
    throw new Error(`Gate expression reads "${reference}", which this check does not model.`);
  }
  const job = run.jobs[parts[1]];
  if (!job) {
    throw new Error(`Gate expression reads "${reference}", but the scenario declares no job "${parts[1]}".`);
  }
  if (parts.length === 3 && parts[2] === "result") {
    return job.result;
  }
  if (parts.length === 4 && parts[2] === "outputs") {
    // A job that never reached the step publishes nothing, and an absent
    // output reads as the empty string rather than erroring.
    return job.outputs?.[parts[3]] ?? "";
  }
  throw new Error(`Gate expression reads "${reference}", which this check does not model.`);
}

function equals(left, right) {
  if (typeof left !== typeof right) {
    throw new Error("Gate expression compares mixed types, which this check does not model.");
  }
  // GitHub's == ignores case when comparing strings.
  if (typeof left === "string") {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

function evaluate(node, run) {
  switch (node.op) {
    case "literal":
      return node.value;
    case "path":
      return resolve(node.name, run);
    // GitHub prepends an implicit success() to a job `if:` that names no status
    // function at all. Not modeled, because dropping !cancelled() from this gate
    // is caught by the cancellation scenarios before that could matter.
    case "call":
      if (node.name === "cancelled") return run.cancelled === true;
      // Modeled rather than rejected so that swapping !cancelled() for always()
      // fails as a named scenario instead of an unreadable crash.
      if (node.name === "always") return true;
      throw new Error(`Gate expression calls ${node.name}(), which this check does not model.`);
    case "!":
      return !truthy(evaluate(node.operand, run));
    // && and || yield an operand rather than a boolean, the way GitHub does.
    case "&&": {
      const left = evaluate(node.left, run);
      return truthy(left) ? evaluate(node.right, run) : left;
    }
    case "||": {
      const left = evaluate(node.left, run);
      return truthy(left) ? left : evaluate(node.right, run);
    }
    case "==":
      return equals(evaluate(node.left, run), evaluate(node.right, run));
    case "!=":
      return !equals(evaluate(node.left, run), evaluate(node.right, run));
    default:
      throw new Error(`Unhandled node "${node.op}".`);
  }
}

// --------------------------------------------------------------------------
// What the gate has to decide
// --------------------------------------------------------------------------

const RUNS = "runs";
const SKIPPED = "does not run";

const ok = (has_changes) => ({ result: "success", outputs: { has_changes } });

const SCENARIOS = [
  {
    name: "staging verification fails",
    note: "the case this gate exists for: staging applied cleanly and no longer serves a database-backed request",
    expect: SKIPPED,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": ok("true"),
      "apply-staging": { result: "success" },
      "verify-staging": { result: "failure" },
    },
  },
  {
    name: "staging verification passes",
    note: "without this the scenario above proves nothing — a gate that never promotes also blocks",
    expect: RUNS,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": ok("true"),
      "apply-staging": { result: "success" },
      "verify-staging": { result: "success" },
    },
  },
  {
    name: "staging apply fails, so verification never runs",
    note: "verify-staging is skipped, not failed; a gate testing only for failure would promote here",
    expect: SKIPPED,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": ok("true"),
      "apply-staging": { result: "failure" },
      "verify-staging": { result: "skipped" },
    },
  },
  {
    name: "verification skipped although staging applied",
    expect: SKIPPED,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": ok("true"),
      "apply-staging": { result: "success" },
      "verify-staging": { result: "skipped" },
    },
  },
  {
    name: "detect-staging published has_changes=false and then failed",
    note: "its artifact upload runs if: always(), so the job can fail with the output already published — only the result guard blocks here",
    expect: SKIPPED,
    jobs: {
      "detect-staging": { result: "failure", outputs: { has_changes: "false" } },
      "detect-prod": ok("true"),
      "apply-staging": { result: "skipped" },
      "verify-staging": { result: "skipped" },
    },
  },
  {
    name: "staging had changes but the apply was skipped",
    note: "the reason the promote-without-staging branch keys off has_changes: a skipped apply means both 'nothing to apply' and 'never ran', and only one of those may promote",
    expect: SKIPPED,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": ok("true"),
      "apply-staging": { result: "skipped" },
      "verify-staging": { result: "skipped" },
    },
  },
  {
    name: "staging has no changes of its own",
    note: "nothing was applied to staging, so there is nothing to verify and prod still proceeds",
    expect: RUNS,
    jobs: {
      "detect-staging": ok("false"),
      "detect-prod": ok("true"),
      "apply-staging": { result: "skipped" },
      "verify-staging": { result: "skipped" },
    },
  },
  {
    name: "run cancelled with every upstream green",
    note: "an operator cancelling a bad prod plan must stop it; always() would let this through",
    expect: SKIPPED,
    cancelled: true,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": ok("true"),
      "apply-staging": { result: "success" },
      "verify-staging": { result: "success" },
    },
  },
  {
    name: "run cancelled while verifying staging",
    expect: SKIPPED,
    cancelled: true,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": ok("true"),
      "apply-staging": { result: "success" },
      "verify-staging": { result: "cancelled" },
    },
  },
  {
    name: "prod has no changes to apply",
    expect: SKIPPED,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": ok("false"),
      "apply-staging": { result: "success" },
      "verify-staging": { result: "success" },
    },
  },
  {
    name: "detect-staging failed, publishing no has_changes",
    note: "a failed job's output reads as '', so the result guard is the one that has to hold here",
    expect: SKIPPED,
    jobs: {
      "detect-staging": { result: "failure" },
      "detect-prod": ok("true"),
      "apply-staging": { result: "skipped" },
      "verify-staging": { result: "skipped" },
    },
  },
  {
    name: "detect-staging failed after publishing has_changes",
    note: "same guard, reached the other way round: staging had changes and nothing applied them",
    expect: SKIPPED,
    jobs: {
      "detect-staging": { result: "failure", outputs: { has_changes: "true" } },
      "detect-prod": ok("true"),
      "apply-staging": { result: "skipped" },
      "verify-staging": { result: "skipped" },
    },
  },
  {
    name: "detect-prod failed",
    expect: SKIPPED,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": { result: "failure" },
      "apply-staging": { result: "success" },
      "verify-staging": { result: "success" },
    },
  },
  {
    name: "detect-prod failed after publishing has_changes",
    note: "without this row the detect-prod result guard decides nothing — the row above is already blocked by the missing output",
    expect: SKIPPED,
    jobs: {
      "detect-staging": ok("true"),
      "detect-prod": { result: "failure", outputs: { has_changes: "true" } },
      "apply-staging": { result: "success" },
      "verify-staging": { result: "success" },
    },
  },
  {
    name: "detect-staging succeeded but published no has_changes",
    note: "unreachable while the plan step always writes one; the gate still has to hold if it ever stops, so it tests has_changes == 'false' rather than != 'true'",
    expect: SKIPPED,
    jobs: {
      "detect-staging": { result: "success" },
      "detect-prod": ok("true"),
      "apply-staging": { result: "skipped" },
      "verify-staging": { result: "skipped" },
    },
  },
];

// --------------------------------------------------------------------------

const failures = [];
const fail = (message) => failures.push(message);

const read = (file) => readFileSync(path.join(repoRoot, file), "utf8");

const terraform = read(TERRAFORM);

const applyProd = jobBlock(terraform, TERRAFORM, "apply-prod");
const gate = requireJobKey(applyProd, TERRAFORM, "apply-prod", "if");
const gateNeeds = parseNeeds(requireJobKey(applyProd, TERRAFORM, "apply-prod", "needs"));

console.log(`${TERRAFORM} — apply-prod\n`);
console.log(`  needs: ${gateNeeds.join(", ")}`);
console.log(`  if:    ${gate}\n`);

if (!gateNeeds.includes("verify-staging")) {
  fail(`${TERRAFORM}: apply-prod does not declare verify-staging in needs:, so prod can apply before staging is verified.`);
}

const ast = parse(tokenize(gate));

// A job the gate never reads cannot gate anything, whatever needs: says.
for (const job of gateNeeds) {
  if (!gate.includes(`needs.${job}.`)) {
    fail(`${TERRAFORM}: apply-prod lists "${job}" in needs: but never reads it in if:, so that edge does not gate the promotion.`);
  }
}

// And the converse: the needs context holds only direct dependencies, so a read
// of a job that is not declared silently evaluates to null rather than erroring.
for (const [, job] of gate.matchAll(/needs\.([\w-]+)\./g)) {
  if (!gateNeeds.includes(job)) {
    fail(`${TERRAFORM}: apply-prod reads "needs.${job}" but does not declare it in needs:, so that clause evaluates to null on GitHub.`);
  }
}

console.log("Promotion decisions:\n");
for (const scenario of SCENARIOS) {
  const actual = truthy(evaluate(ast, { cancelled: scenario.cancelled === true, jobs: scenario.jobs }))
    ? RUNS
    : SKIPPED;
  const passed = actual === scenario.expect;
  console.log(`  ${passed ? "ok  " : "FAIL"}  apply-prod ${actual.padEnd(12)}  ${scenario.name}`);
  if (scenario.note) {
    console.log(`        ${scenario.note}`);
  }
  if (!passed) {
    fail(`Gate mismatch — "${scenario.name}": apply-prod ${actual}, expected ${scenario.expect}.`);
  }
}

// --------------------------------------------------------------------------
// The scenario table above assumes a shape the upstream jobs have to keep.
// --------------------------------------------------------------------------

console.log(`\nUpstream job structure:\n`);

// The gate's promote-without-staging branch is satisfied by has_changes alone —
// it never reads apply-staging.result. That is only sound while apply-staging is
// itself skipped on 'false'. Remove this condition and a *failed* staging apply
// on a no-change run promotes to prod, and the scenario table above would not
// notice, because it states job results rather than deriving them.
const applyStagingIf = requireJobKey(jobBlock(terraform, TERRAFORM, "apply-staging"), TERRAFORM, "apply-staging", "if");
if (!applyStagingIf.includes("needs.detect-staging.outputs.has_changes")) {
  fail(
    `${TERRAFORM}: apply-staging's if: no longer keys off detect-staging's has_changes output (it is "${applyStagingIf}"). ` +
      `The gate promotes on has_changes == 'false' without reading apply-staging.result, which is only safe while that if: skips the apply.`,
  );
} else {
  console.log("  ok    apply-staging still skips on detect-staging's has_changes");
}

const verifyBlock = jobBlock(terraform, TERRAFORM, "verify-staging");
const verifyNeeds = parseNeeds(requireJobKey(verifyBlock, TERRAFORM, "verify-staging", "needs"));
const verifyIf = jobKey(verifyBlock, TERRAFORM, "verify-staging", "if");

// "staging apply fails, so verification never runs" is only true while these
// hold: the default success() is what skips the verification after a failed
// apply, and an `if:` naming any status function would run it instead — turning
// a scenario the table asserts is reachable into one that never happens.
if (!verifyNeeds.includes("apply-staging")) {
  fail(`${TERRAFORM}: verify-staging does not declare apply-staging in needs:, so it no longer verifies what was applied.`);
} else {
  console.log("  ok    needs: apply-staging");
}

if (verifyIf !== null) {
  fail(
    `${TERRAFORM}: verify-staging has gained "if: ${verifyIf}". Its default success() is what makes a failed staging apply ` +
      `skip the verification; an explicit condition can run it instead, and the gate reads a skipped and a failed verification differently.`,
  );
} else {
  console.log("  ok    no if: — the default success() still gates it on the apply");
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s) with the staging-to-prod promotion gate:\n`);
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log(`\nThe promotion gate blocks prod in every scenario where staging did not verify.`);
