import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkPackage, validatePackage } from "../../src/index.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.join(root, "package");
const evaluator = path.join(root, "evaluator/evaluate.mjs");

test("daily-pipeline package validates", async () => {
  const record = await validatePackage(pkg);
  assert.equal(record.manifest.id, "daily-pipeline-briefing");
  assert.match(record.digest, /^sha256:[a-f0-9]{64}$/u);
});

test("daily-pipeline reference workspace passes check", async () => {
  const report = await checkPackage(pkg, {
    evaluate: evaluator,
    workspace: path.join(root, "fixtures/reference")
  });
  assert.equal(report.status, "pass");
});

test("daily-pipeline weak workspace fails check", async () => {
  const report = await checkPackage(pkg, {
    evaluate: evaluator,
    workspace: path.join(root, "fixtures/weak")
  });
  assert.equal(report.status, "fail");
});
