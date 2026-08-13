import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkPackage,
  createLock,
  getPackage,
  startPreviewServer,
  verifyLock
} from "../src/index.js";

async function workspace() {
  return mkdtemp(path.join(os.tmpdir(), "seedspec-check-"));
}

async function put(root, relativePath, content) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return target;
}

async function anchoredPackage(root, extras = "") {
  await put(root, "SPEC.md", `---
id: report
name: Report
kind: application
version: "1.0.0"
success:
  criteria:
    - id: delivered
      description: The report is delivered.
    - id: unenforceable
      description: A claim with no evaluator.
capabilities:
  items:
    - id: summary
      name: Summary
      description: Produces the report.
      success_criteria: [delivered]
context_modules:
  - id: delivery-evaluation
    type: evaluation
    description: Evaluates delivery.
    path: context-modules/delivery-evaluation/EVAL.md
    applies_to:
      stages: [verification]
      success_criteria: [delivered]
${extras}---
# Delivery [success:delivered]

Send the report.
`);
  await put(root, "context-modules/delivery-evaluation/EVAL.md", "# Observe delivery.\n");
}

test("check reports anchored enforceable criteria and authoring gaps", async () => {
  const root = await workspace();
  await anchoredPackage(root);
  const report = await checkPackage(root);
  assert.equal(report.status, "review");
  assert.deepEqual(report.coverage.unanchored_criteria, ["unenforceable"]);
  assert.deepEqual(report.coverage.unenforceable_criteria, ["unenforceable"]);
  assert.equal(report.coverage.criteria.find(({ id }) => id === "delivered").enforceable, true);
  assert.ok(report.survey.some(({ id }) => id === "evaluation-coverage"));
});

test("strict check fails unenforceable and unanchored criteria", async () => {
  const root = await workspace();
  await anchoredPackage(root);
  const report = await checkPackage(root, { strict: true });
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some(({ code }) => code === "UNENFORCEABLE_CRITERION"));
});

test("trusted evaluator evidence can pass a check", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
id: report
name: Report
kind: application
version: "1.0.0"
success:
  criteria:
    - id: delivered
      description: The report is delivered.
context_modules:
  - id: delivery-evaluation
    type: evaluation
    description: Evaluates delivery.
    path: context-modules/delivery-evaluation/EVAL.md
    applies_to:
      success_criteria: [delivered]
---
# Delivery [success:delivered]
`);
  await put(root, "context-modules/delivery-evaluation/EVAL.md", "# Observe delivery.\n");
  const coverage = await checkPackage(root);
  const passed = await checkPackage(root, {
    evidence: {
      evidence_version: "0.4",
      package_id: "report",
      package_digest: coverage.package.digest,
      runner: { id: "hidden-eval", kind: "tool" },
      checks: [{ id: "delivered", passed: true }]
    }
  });
  assert.equal(passed.status, "pass");
  assert.equal(passed.verification.passed, 1);
});

test("implementing-agent evidence cannot certify verification", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
id: report
name: Report
kind: application
version: "1.0.0"
success:
  criteria:
    - id: delivered
      description: The report is delivered.
context_modules:
  - id: delivery-evaluation
    type: evaluation
    description: Evaluates delivery.
    path: context-modules/delivery-evaluation/EVAL.md
    applies_to:
      success_criteria: [delivered]
---
# Delivery [success:delivered]
`);
  await put(root, "context-modules/delivery-evaluation/EVAL.md", "# Observe delivery.\n");
  const coverage = await checkPackage(root);
  const report = await checkPackage(root, {
    evidence: {
      package_digest: coverage.package.digest,
      runner: { id: "implementer", kind: "implementing-agent" },
      checks: [{ id: "delivered", passed: true }]
    }
  });
  assert.equal(report.status, "fail");
  assert.ok(report.issues.some(({ code }) => code === "UNTRUSTED_EVIDENCE_RUNNER"));
});

test("evaluate maps an external workspace evaluator onto criteria", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
id: report
name: Report
kind: application
version: "1.0.0"
success:
  criteria:
    - id: delivered
      description: The report is delivered.
context_modules:
  - id: delivery-evaluation
    type: evaluation
    description: Evaluates delivery.
    path: context-modules/delivery-evaluation/EVAL.md
    applies_to:
      success_criteria: [delivered]
---
# Delivery [success:delivered]
`);
  await put(root, "context-modules/delivery-evaluation/EVAL.md", "# Observe delivery.\n");
  const workspaceRoot = await workspace();
  const evaluator = await put(workspaceRoot, "evaluate.mjs", `process.stdout.write(JSON.stringify({
  checks: [{ id: "delivered", description: "Delivered", passed: true }]
}) + "\\n");
`);
  const report = await checkPackage(root, {
    evaluate: evaluator,
    workspace: workspaceRoot
  });
  assert.equal(report.status, "pass");
  assert.equal(report.verification.runner.kind, "tool");
});

test("preview serves the check report", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
id: report
name: Report
kind: application
version: "1.0.0"
---
# Report
`);
  const server = await startPreviewServer(root, { port: 0 });
  try {
    const response = await fetch(`${server.url}api/check`);
    const report = await response.json();
    assert.equal(report.package.id, "report");
    assert.equal(report.status, "review");
  } finally {
    await server.close();
  }
});

test("lockfile pins package digests and get copies only matching bytes", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
id: locked
name: Locked
kind: application
version: "1.0.0"
---
# Locked
`);
  const lock = await createLock([root]);
  assert.equal(lock.packages[0].id, "locked");
  const verified = await verifyLock(lock);
  assert.equal(verified.status, "pass");

  const output = path.join(await workspace(), "fetched");
  const fetched = await getPackage(root, {
    digest: lock.packages[0].digest,
    output
  });
  assert.equal(fetched.digest, lock.packages[0].digest);

  await assert.rejects(getPackage(root, {
    digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    output: path.join(await workspace(), "wrong")
  }), { code: "DIGEST_MISMATCH" });
});
