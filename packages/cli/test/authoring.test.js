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

function run(arguments_, cwd, input) {
  return spawnSync(process.execPath, [cli, ...arguments_], {
    cwd,
    encoding: "utf8",
    input
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
  assert.match(opened.stdout, /Optional authoring skill/u);
  assert.match(opened.stdout, /ask the user whether they want it added/u);
  assert.match(
    opened.stdout,
    /skills export --skill author-seedspec --output <project-skill-directory>/u
  );
  assert.match(opened.stdout, /It is not required/u);
  assert.doesNotMatch(opened.stdout, /sha256:|Workspace:/u);

  const nested = run(["author", "status"], path.join(packageRoot, "definition"));
  assert.equal(nested.status, 0, nested.stderr);
  assert.match(nested.stdout, /^Status: valid$/mu);
  assert.doesNotMatch(nested.stdout, /Optional authoring skill/u);
});

test("author exposes prompt, review, questions, history, check, and help under one namespace", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-author-"));
  const projectRoot = path.join(temporaryRoot, "project");
  const packageRoot = path.join(projectRoot, "seedspec");
  await cp(fixture, packageRoot, { recursive: true });

  assert.equal(run(["author"], projectRoot).status, 0);
  const review = run(["author", "review", "--status"], projectRoot);
  assert.equal(review.status, 0, review.stderr);
  assert.match(review.stdout, /SeedSpec authoring agent brief/u);
  assert.doesNotMatch(review.stdout, /## Area objective/u);

  const prompt = run(["author", "prompt"], projectRoot);
  assert.equal(prompt.status, 0, prompt.stderr);
  assert.equal(
    prompt.stdout.trim(),
    "Co-author the SeedSpec in this directory with me. Run `npx @seedspec/cli author review` and follow the complete operating brief it returns. Do not change package documents without my explicit approval."
  );
  assert.doesNotMatch(prompt.stdout, /source-bound|review area|configuration|success material/iu);

  const questions = run(["author", "questions"], projectRoot);
  assert.equal(questions.status, 0, questions.stderr);
  assert.match(questions.stdout, /No authoring-session questions recorded/u);

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

test("author review emits the agent work order by default and shortens it only on request", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-author-"));
  const fullProjectRoot = path.join(temporaryRoot, "full-project");
  const fullPackageRoot = path.join(fullProjectRoot, "seedspec");
  await cp(fixture, fullPackageRoot, { recursive: true });

  assert.equal(run(["author"], fullProjectRoot).status, 0);
  const full = run(["author", "review"], fullProjectRoot);
  assert.equal(full.status, 0, full.stderr);
  assert.match(full.stdout, /# SeedSpec authoring agent operating brief/u);
  assert.match(full.stdout, /## How to talk to the author/u);
  assert.match(full.stdout, /## Current focus/u);
  assert.match(full.stdout, /Absence is not a gap/u);
  assert.doesNotMatch(full.stdout, /Current source documentation|github\.com\/SeedSpec\/seedspec\/blob/u);

  // Every command the brief prints must run for someone with no global
  // install, so the brief may never emit a bare `seedspec` invocation.
  const bareInvocations = full.stdout.match(/(?:^|[|(\s])seedspec [a-z]/gmu) ?? [];
  assert.deepEqual(bareInvocations, [], "brief must invoke the CLI through npx");
  for (const operation of ["record", "answer", "attach-source", "reviewed"]) {
    assert.match(
      full.stdout,
      new RegExp(`npx @seedspec/cli author ${operation}`, "u"),
      `${operation} must appear as a runnable command`
    );
  }

  const summaryProjectRoot = path.join(temporaryRoot, "summary-project");
  const summaryPackageRoot = path.join(summaryProjectRoot, "seedspec");
  await cp(fixture, summaryPackageRoot, { recursive: true });

  assert.equal(run(["author"], summaryProjectRoot).status, 0);
  const summary = run(["author", "review", "--summary"], summaryProjectRoot);
  assert.equal(summary.status, 0, summary.stderr);
  assert.match(summary.stdout, /SeedSpec authoring summary/u);
  assert.match(summary.stdout, /Review progress: 0 of 4 areas reviewed/u);
  assert.match(summary.stdout, /rerun this review without `--summary`/u);
  assert.doesNotMatch(summary.stdout, /## How to talk to the author|## Current focus/u);

  // `--summary` is a shorter human view, so peeking must not start work.
  const afterSummary = run(["author", "history"], summaryProjectRoot);
  assert.equal(afterSummary.status, 0, afterSummary.stderr);
  assert.match(afterSummary.stdout, /No review passes recorded/u);

  // A bare review is what begins a thread.
  assert.equal(run(["author", "review"], summaryProjectRoot).status, 0);
  const history = run(["author", "history"], summaryProjectRoot);
  assert.equal(history.status, 0, history.stderr);
  assert.doesNotMatch(history.stdout, /No review passes recorded/u);
  assert.match(history.stdout, /in-progress/u);
});

test("a generated operation command preserves apostrophes in author prose", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-author-"));
  const projectRoot = path.join(temporaryRoot, "author's project");
  const packageRoot = path.join(projectRoot, "seedspec");
  await cp(fixture, packageRoot, { recursive: true });

  assert.equal(run(["author"], projectRoot).status, 0);
  const review = run(["author", "review"], projectRoot);
  assert.equal(review.status, 0, review.stderr);

  const recorded = run(
    ["author", "record", packageRoot, "--json", "-"],
    projectRoot,
    JSON.stringify({ entries: [{ type: "question", question: "Is that the direction?" }] })
  );
  assert.equal(recorded.status, 0, recorded.stderr);
  const questionId = JSON.parse(recorded.stdout).recorded[0].id;

  const generated = review.stdout.match(
    /npx @seedspec\/cli author answer[^\n]+--json - <<'SEEDSPEC_JSON_ANSWER'\n[\s\S]*?\nSEEDSPEC_JSON_ANSWER/u
  );
  assert.ok(generated, "the brief must contain the complete answer command");

  const command = generated[0]
    .replace(
      "npx @seedspec/cli",
      `${JSON.stringify(process.execPath)} ${JSON.stringify(cli)}`
    )
    .replace(
      '{"question_id":"...","answer":"...","resolution":"resolved"}',
      JSON.stringify({
        question_id: questionId,
        answer: "That's right — don't change it.",
        resolution: "resolved"
      })
    );
  const answered = spawnSync("/bin/sh", ["-c", command], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(answered.status, 0, answered.stderr);

  const result = JSON.parse(answered.stdout);
  assert.equal(result.snapshot.review.questions.open, 0);
  assert.equal(result.snapshot.review.questions.resolved, 1);
  assert.equal(result.snapshot.review.questions.items[0].answer, "That's right — don't change it.");
});

test("the bundled authoring skill can be listed and exported project-locally", async () => {
  const listed = run(["skills", "list"], repositoryRoot);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /author-seedspec/u);

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-skills-"));
  const output = path.join(temporaryRoot, ".agents", "skills");
  const exported = run([
    "skills",
    "export",
    "--skill",
    "author-seedspec",
    "--output",
    output
  ], temporaryRoot);
  assert.equal(exported.status, 0, exported.stderr);
  assert.match(exported.stdout, /author-seedspec/u);
});

test("prompt produces a short self-bootstrapping handoff for a supplied package", () => {
  const source = "https://github.com/SeedSpec/reference-solutions/tree/main/solutions/family-hub/seedspec";
  const prompted = run(["prompt", source], repositoryRoot);
  assert.equal(prompted.status, 0, prompted.stderr);
  assert.match(prompted.stdout, new RegExp(
    `npx @seedspec/cli begin "${source.replaceAll("/", "\\/")}"`,
    "u"
  ));
  assert.match(prompted.stdout, /do not need an installed SeedSpec skill/iu);
  assert.match(prompted.stdout, /complete output as your version-matched work order/iu);
  assert.doesNotMatch(prompted.stdout, /--yes|@seedspec\/cli@\d|npm install/u);
});
