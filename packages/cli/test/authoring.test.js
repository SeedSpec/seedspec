import assert from "node:assert/strict";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const cli = path.join(repositoryRoot, "packages/cli/bin/seedspec.js");
const fixture = path.join(
  repositoryRoot,
  "conformance/fixtures/comprehensive-application"
);

function run(arguments_, cwd) {
  return spawnSync(process.execPath, [cli, ...arguments_], {
    cwd,
    encoding: "utf8"
  });
}

test("author discovers and resumes a conventional workspace without paths", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-author-"));
  const projectRoot = path.join(temporaryRoot, "project");
  const packageRoot = path.join(projectRoot, "seedspec");
  const stateRoot = path.join(projectRoot, "authoring");
  await cp(fixture, packageRoot, { recursive: true });

  const created = run([
    "author",
    "create",
    packageRoot,
    "--state",
    stateRoot
  ], projectRoot);
  assert.equal(created.status, 0, created.stderr);

  const opened = run(["author"], projectRoot);
  assert.equal(opened.status, 0, opened.stderr);
  assert.match(opened.stdout, /^SeedSpec authoring$/mu);
  assert.match(opened.stdout, /^Status: valid$/mu);
  assert.match(opened.stdout, /npx @seedspec\/cli author review/u);
  assert.doesNotMatch(opened.stdout, /sha256:|Workspace:/u);

  const nested = run(["author", "status"], path.join(packageRoot, "definition"));
  assert.equal(nested.status, 0, nested.stderr);
  assert.match(nested.stdout, /^Status: valid$/mu);
});

test("author exposes review, questions, history, check, and help under one namespace", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-author-"));
  const projectRoot = path.join(temporaryRoot, "project");
  const packageRoot = path.join(projectRoot, "seedspec");
  await cp(fixture, packageRoot, { recursive: true });

  assert.equal(run(["author"], projectRoot).status, 0);
  const review = run(["author", "review", "--status"], projectRoot);
  assert.equal(review.status, 0, review.stderr);
  assert.match(review.stdout, /SeedSpec authoring audit/u);

  const questions = run(["author", "questions"], projectRoot);
  assert.equal(questions.status, 0, questions.stderr);
  assert.match(questions.stdout, /No authoring questions recorded/u);

  const history = run(["author", "history"], projectRoot);
  assert.equal(history.status, 0, history.stderr);
  assert.match(history.stdout, /No review passes recorded/u);

  const check = run(["author", "check"], projectRoot);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /SeedSpec preparation/u);

  const help = run(["author", "help"], projectRoot);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /npx @seedspec\/cli author/u);
});
