import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

function within(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === ""
    || (!path.isAbsolute(relative)
      && relative !== ".."
      && !relative.startsWith(`..${path.sep}`));
}

function pointerValue(value, pointer) {
  const parts = pointer.slice(1).split("/").map((part) => (
    part.replaceAll("~1", "/").replaceAll("~0", "~")
  ));
  let current = value;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, part)) {
      return { found: false, value: null };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

async function readStructuredFile(packagePath, target) {
  const targetPath = path.resolve(packagePath, target.path);
  if (!within(targetPath, packagePath)) {
    throw new Error(`Fixed-claim target escapes the package: ${target.path}`);
  }
  const source = await readFile(targetPath, "utf8");
  return target.format === "json" ? JSON.parse(source) : parseYaml(source);
}

export async function evaluateFixedClaimContract(contract, packagePath) {
  if (!Array.isArray(contract) || contract.length === 0) {
    throw new Error("fixed_claim_contract must contain at least one claim");
  }
  const issues = [];
  for (const claim of contract) {
    for (const target of claim.targets) {
      let document;
      try {
        document = await readStructuredFile(packagePath, target);
      } catch (error) {
        issues.push({
          claim_id: claim.id,
          source: claim.source,
          description: claim.description,
          target: target.path,
          pointer: target.pointer,
          expected: target.expected,
          actual: null,
          problem: `cannot read ${target.format}: ${error.message}`
        });
        continue;
      }
      const actual = pointerValue(document, target.pointer);
      if (!actual.found || !Object.is(actual.value, target.expected)) {
        issues.push({
          claim_id: claim.id,
          source: claim.source,
          description: claim.description,
          target: target.path,
          pointer: target.pointer,
          expected: target.expected,
          actual: actual.found ? actual.value : null,
          problem: actual.found ? "value differs" : "target is missing"
        });
      }
    }
  }
  return issues;
}

export function fixedClaimRepairPrompt(issues) {
  const diagnostics = issues.map((issue) => (
    `- ${issue.claim_id} (${issue.source}): ${issue.target}${issue.pointer} `
    + `must equal ${JSON.stringify(issue.expected)}; `
    + `${issue.problem}${issue.actual === null ? "" : `, received ${JSON.stringify(issue.actual)}`}`
  )).join("\n");
  return `The fixed-claim publish gate found source-backed contradictions:

${diagnostics}

Repair only these contradictions. A fixed source value must not remain broadly
configurable: enforce it at the named machine-readable target or remove that
configuration surface when the package remains coherent. Preserve accepted
product decisions and implementation latitude. Then inspect, validate, and
lint again. Do not ask the author to reconfirm fixed source meaning.`;
}
