import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { evaluateCapabilityStage } from "../../../packages/runtime/src/index.js";
import { adaptImplementationEvidence } from "../scripts/adapt-implementation-evidence.mjs";

const execFileAsync = promisify(execFile);
const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(experimentRoot, "../..");
const evaluator = path.join(
  repositoryRoot,
  "authoring-evals/implementation-evals/hidden/evaluate.mjs"
);
const fixtureRoot = path.join(
  repositoryRoot,
  "authoring-evals/implementation-evals/fixtures"
);
const packagePath = path.join(repositoryRoot, "conformance/fixtures/profiled-workflow");
const bundlePath = path.join(experimentRoot, "examples/daily-pipeline/accepted.yaml");
const proposalSchemaPath = path.join(
  repositoryRoot,
  "packages/runtime/schemas/capabilities/v1/capability-proposal-output.schema.json"
);

function assertTypedLiterals(schema, location = "$") {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  if (Object.hasOwn(schema, "const") || Object.hasOwn(schema, "enum")) {
    assert.ok(Object.hasOwn(schema, "type"), `${location} must type its literal values`);
  }
  for (const [key, value] of Object.entries(schema)) {
    assertTypedLiterals(value, `${location}.${key}`);
  }
}

test("provider proposal schema types literal values", async () => {
  const schema = JSON.parse(await readFile(proposalSchemaPath, "utf8"));
  assertTypedLiterals(schema);
});

async function behavioralResult(fixture) {
  const result = await execFileAsync(process.execPath, [evaluator, path.join(fixtureRoot, fixture)]);
  return JSON.parse(result.stdout);
}

test("capability verification admits the reference and rejects the weak realization", async (t) => {
  const output = await mkdtemp(path.join(tmpdir(), "seedspec-capability-evidence-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const bundle = parseYaml(await readFile(bundlePath, "utf8"));
  const referenceEvidence = adaptImplementationEvidence(
    bundle,
    await behavioralResult("reference")
  );
  const referenceEvidencePath = path.join(output, "reference.yaml");
  await writeFile(referenceEvidencePath, stringifyYaml(referenceEvidence), "utf8");
  const reference = await evaluateCapabilityStage(packagePath, [bundlePath], {
    stage: "verification",
    evidencePath: referenceEvidencePath
  });
  assert.equal(reference.status, "pass");

  const weakEvidence = adaptImplementationEvidence(bundle, await behavioralResult("weak"));
  const weakEvidencePath = path.join(output, "weak.yaml");
  await writeFile(weakEvidencePath, stringifyYaml(weakEvidence), "utf8");
  const weak = await evaluateCapabilityStage(packagePath, [bundlePath], {
    stage: "verification",
    evidencePath: weakEvidencePath
  });
  assert.equal(weak.status, "fail");
  assert.ok(weak.checks.some((check) => check.status === "fail"));
});

test("an implementing agent cannot self-certify verification", async (t) => {
  const output = await mkdtemp(path.join(tmpdir(), "seedspec-capability-self-evidence-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const bundle = parseYaml(await readFile(bundlePath, "utf8"));
  const evidence = adaptImplementationEvidence(
    bundle,
    await behavioralResult("reference")
  );
  for (const record of evidence.records) {
    for (const item of record.evidence) item.source = "implementing-agent";
  }
  const evidencePath = path.join(output, "self-evidence.yaml");
  await writeFile(evidencePath, stringifyYaml(evidence), "utf8");
  const result = await evaluateCapabilityStage(packagePath, [bundlePath], {
    stage: "verification",
    evidencePath
  });
  assert.equal(result.status, "fail");
  assert.ok(result.checks.some((check) => (
    check.id.startsWith("verification-invalid-")
    && check.description.includes("verifying-agent or tool")
  )));
});
