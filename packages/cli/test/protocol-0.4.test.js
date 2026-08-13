import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const cli = new URL("../bin/seedspec.js", import.meta.url);

async function writeSpec(root, body) {
  await writeFile(path.join(root, "SPEC.md"), body, "utf8");
  return root;
}

async function minimumPackage() {
  const root = await mkdtemp(path.join(os.tmpdir(), "seedspec-cli-0.4-"));
  return writeSpec(root, `---
id: cli-example
name: CLI example
version: "1.0.0"
target_protocol: "0.4"
---
# CLI
`);
}

async function checkablePackage() {
  const root = await minimumPackage();
  await mkdir(path.join(root, "context-modules/evaluation"), { recursive: true });
  await writeSpec(root, `---
id: cli-example
name: CLI example
kind: application
version: "1.0.0"
target_protocol: "0.4"
success:
  criteria:
    - id: done
      description: The work is done.
context_modules:
  - id: evaluation
    type: evaluation
    description: Evaluate completion.
    path: context-modules/evaluation/EVAL.md
    applies_to:
      success_criteria: [done]
---
# CLI [success:done]
`);
  await writeFile(path.join(root, "context-modules/evaluation/EVAL.md"), "# Eval\n", "utf8");
  return root;
}

test("validate and inspect use Protocol 0.4 identity", async () => {
  const root = await minimumPackage();
  const validation = await execute(process.execPath, [cli.pathname, "validate", root]);
  assert.match(validation.stdout, /cli-example@1\.0\.0/u);
  assert.match(validation.stdout, /Name: CLI example/u);
  assert.doesNotMatch(validation.stdout, /Kind:/u);
  assert.match(validation.stdout, /Protocol: 0\.4/u);

  const inspection = await execute(process.execPath, [cli.pathname, "inspect", root, "--json"]);
  const parsed = JSON.parse(inspection.stdout);
  assert.equal(parsed.protocol, "0.4");
  assert.equal(parsed.id, "cli-example");
  assert.equal(parsed.name, "CLI example");
});

test("flatten writes a portable SPEC.md", async () => {
  const root = await minimumPackage();
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "seedspec-cli-flat-"));
  const output = path.join(outputRoot, "SPEC.md");
  await execute(process.execPath, [cli.pathname, "flatten", root, "--output", output]);
  const validation = await execute(process.execPath, [cli.pathname, "validate", output]);
  assert.match(validation.stdout, /Valid SeedSpec package/u);
});

test("check reports enforceable coverage", async () => {
  const root = await checkablePackage();
  const checked = await execute(process.execPath, [cli.pathname, "check", root, "--json"]);
  const report = JSON.parse(checked.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.coverage.criteria[0].enforceable, true);
});

test("lock and get pin a package digest", async () => {
  const root = await minimumPackage();
  const lockDir = await mkdtemp(path.join(os.tmpdir(), "seedspec-cli-lock-"));
  const lockFile = path.join(lockDir, "seedspec.lock.json");
  await execute(process.execPath, [cli.pathname, "lock", root, "--output", lockFile]);
  const verified = await execute(process.execPath, [cli.pathname, "verify-lock", lockFile, "--json"]);
  assert.equal(JSON.parse(verified.stdout).status, "pass");
  const lock = JSON.parse(await readFile(lockFile, "utf8"));
  const output = path.join(lockDir, "fetched");
  const fetched = await execute(process.execPath, [
    cli.pathname,
    "get",
    root,
    "--digest",
    lock.packages[0].digest,
    "--output",
    output
  ]);
  assert.match(fetched.stdout, /Fetched cli-example@1\.0\.0/u);
});

test("commands outside the structural surface are unknown", async () => {
  await assert.rejects(
    execute(process.execPath, [cli.pathname, "resolve", "."]),
    (error) => {
      assert.match(error.stderr, /UNKNOWN_COMMAND/u);
      return true;
    }
  );
});
