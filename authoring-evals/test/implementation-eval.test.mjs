import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const evalRoot = path.resolve(testRoot, "../implementation-evals");
const evaluator = path.join(evalRoot, "hidden/evaluate.mjs");

async function evaluate(fixture) {
  const { stdout } = await execFileAsync(process.execPath, [
    evaluator,
    path.join(evalRoot, `fixtures/${fixture}`)
  ]);
  return JSON.parse(stdout);
}

test("reference implementation passes all downstream behavioral checks", async () => {
  const result = await evaluate("reference");
  assert.equal(result.passed, 10);
  assert.equal(result.total, 10);
  assert.equal(result.pass_rate, 1);
});

test("weak implementation is rejected by downstream behavioral checks", async () => {
  const result = await evaluate("weak");
  assert.ok(result.passed < 5);
  assert.equal(result.total, 10);
  assert.ok(result.checks.some((check) => !check.passed));
});

