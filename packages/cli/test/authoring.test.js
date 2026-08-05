import assert from "node:assert/strict";
import { cp, mkdtemp, readFile } from "node:fs/promises";
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
const bundledFixture = path.join(
  repositoryRoot,
  "conformance/fixtures/bundled-family-hub"
);
const ambiguousFixture = path.join(
  repositoryRoot,
  "packages/runtime/test/fixtures/authoring-ambiguous-delivery"
);

function run(arguments_, cwd, input) {
  return spawnSync(process.execPath, [cli, ...arguments_], {
    cwd,
    encoding: "utf8",
    input
  });
}

function currentAuthoringRevision(cwd) {
  const status = run(["author", "status", "--json"], cwd);
  assert.equal(status.status, 0, status.stderr);
  return JSON.parse(status.stdout).workspace.revision;
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

  const publish = run(["publish-check", packageRoot, "--json"], projectRoot);
  assert.equal(publish.status, 0, publish.stderr);
  assert.equal(JSON.parse(publish.stdout).review.state, stateRoot);
});

test("author exposes prompt, review, candidates, history, check, and help under one namespace", async () => {
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
  assert.match(prompt.stdout, /idea to shape/iu);
  assert.match(prompt.stdout, /practical first specification/iu);
  assert.match(prompt.stdout, /--target shape/u);

  const deepPrompt = run(["author", "prompt", "--deep"], projectRoot);
  assert.equal(deepPrompt.status, 0, deepPrompt.stderr);
  assert.match(deepPrompt.stdout, /every consequential aspect/iu);
  assert.match(deepPrompt.stdout, /recommended answer/iu);
  assert.match(deepPrompt.stdout, /--target deep/u);

  const minimalPrompt = run(["author", "prompt", "--minimal"], projectRoot);
  assert.equal(minimalPrompt.status, 0, minimalPrompt.stderr);
  assert.match(minimalPrompt.stdout, /authoring boundary/iu);
  assert.match(minimalPrompt.stdout, /Do not brainstorm/u);
  assert.match(minimalPrompt.stdout, /--target minimal/u);

  const incompatiblePrompt = run(["author", "prompt", "--deep", "--minimal"], projectRoot);
  assert.notEqual(incompatiblePrompt.status, 0);
  assert.match(incompatiblePrompt.stderr, /Choose either --deep or --minimal/u);

  const questions = run(["author", "questions"], projectRoot);
  assert.equal(questions.status, 0, questions.stderr);
  assert.match(questions.stdout, /No authoring-session questions recorded/u);

  const candidates = run(["author", "candidates"], projectRoot);
  assert.equal(candidates.status, 0, candidates.stderr);
  assert.match(candidates.stdout, /No clarification candidates recorded/u);

  const probes = run(["author", "probes"], projectRoot);
  assert.equal(probes.status, 0, probes.stderr);
  assert.match(probes.stdout, /No clarification probes recorded/u);

  const history = run(["author", "history"], projectRoot);
  assert.equal(history.status, 0, history.stderr);
  assert.match(history.stdout, /No review passes recorded/u);

  const check = run(["author", "check"], projectRoot);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /SeedSpec preparation/u);

  const help = run(["author", "help"], projectRoot);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /npx @seedspec\/cli author/u);

  const guidance = run(["author", "guidance"], projectRoot);
  assert.equal(guidance.status, 0, guidance.stderr);
  assert.match(guidance.stdout, /composition\s+shaping prose for a declared parent-to-child integration seam/u);
  assert.match(guidance.stdout, /candidates\s+recording and resolving consequential clarification candidates/u);
  assert.match(guidance.stdout, /requirements\s+forming supplied requirements without inventing completeness/u);

  const requirementsGuidance = run(
    ["author", "guidance", "--topic", "requirements"],
    projectRoot
  );
  assert.equal(requirementsGuidance.status, 0, requirementsGuidance.stderr);
  assert.match(requirementsGuidance.stdout, /## Classify supplied meaning/u);
  assert.match(requirementsGuidance.stdout, /## Expansion and contraction/u);

  const compositionGuidance = run(
    ["author", "guidance", "--topic", "composition"],
    projectRoot
  );
  assert.equal(compositionGuidance.status, 0, compositionGuidance.stderr);
  assert.match(compositionGuidance.stdout, /## Responsibility boundary/u);
  assert.match(compositionGuidance.stdout, /Delete unused sections/u);

  const changesSchema = run(["author", "schema", "changes"], projectRoot);
  assert.equal(changesSchema.status, 0, changesSchema.stderr);
  assert.match(changesSchema.stdout, /authoring-change-proposals/u);

  const candidatesSchema = run(["author", "schema", "candidates"], projectRoot);
  assert.equal(candidatesSchema.status, 0, candidatesSchema.stderr);
  assert.match(candidatesSchema.stdout, /authoring-candidates/u);

  const probeSchema = run(["author", "schema", "probe-brief"], projectRoot);
  assert.equal(probeSchema.status, 0, probeSchema.stderr);
  assert.match(probeSchema.stdout, /frozen clarification probe brief/iu);
});

test("author prepares and rechecks a frozen clarification probe without calling a model", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-probe-"));
  const projectRoot = path.join(temporaryRoot, "project");
  const packageRoot = path.join(projectRoot, "seedspec");
  const stateRoot = path.join(projectRoot, "authoring");
  const bundle = path.join(temporaryRoot, "probe-bundle");
  await cp(ambiguousFixture, packageRoot, { recursive: true });
  const created = run(["author", "create", packageRoot, "--state", stateRoot], projectRoot);
  assert.equal(created.status, 0, created.stderr);
  const review = run(["author", "review", packageRoot, "--state", stateRoot], projectRoot);
  assert.equal(review.status, 0, review.stderr);
  const prepared = run(
    [
      "author",
      "probe-prepare",
      packageRoot,
      "--state",
      stateRoot,
      "--output",
      bundle,
      "--json",
      "-"
    ],
    projectRoot,
    JSON.stringify({
      model: { provider: "anthropic", id: "claude-sonnet-5" },
      runner: {
        id: "claude-code-cli",
        version: "2.0.64",
        enforces_output_token_limit: false,
        enforces_spend_limit: false
      },
      settings: { effort: "medium", tools: [] },
      limits: {
        model_context_tokens: 1_000_000,
        max_input_tokens: 10_000,
        max_output_tokens: 4_000,
        max_attempts: 1,
        max_retries: 0,
        max_duration_ms: 120_000,
        max_spend_usd: 0.25
      },
      pricing: {
        currency: "USD",
        basis: "subscription-list-price-equivalent",
        input_per_million_usd: 2,
        output_per_million_usd: 10,
        source: "https://www.anthropic.com/claude/sonnet",
        observed_at: "2026-08-03T12:00:00.000Z"
      }
    })
  );
  assert.equal(prepared.status, 0, prepared.stderr);
  const preparation = JSON.parse(prepared.stdout);
  assert.equal(preparation.brief.preflight.status, "ready");
  assert.equal(preparation.brief.execution.permitted_tools.length, 0);
  const checked = run([
    "author",
    "probe-check",
    packageRoot,
    "--state",
    stateRoot,
    "--bundle",
    bundle,
    "--json"
  ], projectRoot);
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(JSON.parse(checked.stdout).ready, true);
  const probes = run(["author", "probes", packageRoot, "--state", stateRoot], projectRoot);
  assert.equal(probes.status, 0, probes.stderr);
  assert.match(probes.stdout, /No clarification probes recorded/u);
});

test("author review exposes recursive bundled composition and optional seam prompts", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-author-"));
  const projectRoot = path.join(temporaryRoot, "project");
  const packageRoot = path.join(projectRoot, "seedspec");
  await cp(bundledFixture, packageRoot, { recursive: true });

  assert.equal(run(["author"], projectRoot).status, 0);
  const review = run([
    "author",
    "review",
    "--area",
    "supporting-material",
    "--target",
    "compose"
  ], projectRoot);

  assert.equal(review.status, 0, review.stderr);
  assert.match(review.stdout, /shared-agenda-widget/u);
  assert.match(review.stdout, /responsibility boundaries, concept mapping, state ownership/u);
  assert.match(review.stdout, /prompts, not required headings/u);
  assert.match(review.stdout, /author guidance --topic composition/u);
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
  assert.match(full.stdout, /Workspace revision: `sha256:[0-9a-f]{64}`/u);
  assert.doesNotMatch(full.stdout, /<workspace-revision>/u);
  assert.match(full.stdout, /Absence alone is not a gap/u);
  assert.doesNotMatch(full.stdout, /Current source documentation|github\.com\/SeedSpec\/seedspec\/blob/u);

  // Every command the brief prints must run for someone with no global
  // install, so the brief may never emit a bare `seedspec` invocation.
  const bareInvocations = full.stdout.match(/(?:^|[|(\s])seedspec [a-z]/gmu) ?? [];
  assert.deepEqual(bareInvocations, [], "brief must invoke the CLI through npx");
  for (const operation of ["record", "answer", "attach-source", "propose", "decide", "apply", "reviewed"]) {
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

test("author proposal commands keep package writes behind explicit acceptance", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-author-"));
  const projectRoot = path.join(temporaryRoot, "project");
  const packageRoot = path.join(projectRoot, "seedspec");
  await cp(fixture, packageRoot, { recursive: true });
  assert.equal(run(["author"], projectRoot).status, 0);
  assert.equal(run(["author", "review"], projectRoot).status, 0);

  const documentPath = path.join(packageRoot, "definition", "app.md");
  const beforeContent = await readFile(documentPath, "utf8");
  const afterContent = `${beforeContent}\n\nThe author accepted this clarification.\n`;
  const missingRevision = run(
    ["author", "propose", "--json", "-"],
    projectRoot,
    JSON.stringify({
      path: "definition/app.md",
      summary: "Missing revision",
      content: afterContent,
      basis: { kind: "author-answer", references: [] }
    })
  );
  assert.equal(missingRevision.status, 1);
  assert.match(missingRevision.stderr, /require expected_revision/u);

  const proposed = run(
    ["author", "propose", "--json", "-"],
    projectRoot,
    JSON.stringify({
      expected_revision: currentAuthoringRevision(projectRoot),
      path: "definition/app.md",
      summary: "Add the accepted clarification",
      content: afterContent,
      basis: { kind: "author-answer", references: [] }
    })
  );
  assert.equal(proposed.status, 0, proposed.stderr);
  const proposal = JSON.parse(proposed.stdout).proposal;
  assert.equal(proposal.status, "proposed");
  assert.equal(JSON.parse(proposed.stdout).snapshot, undefined);
  assert.equal(proposal.document.before_content, undefined);
  assert.ok(proposed.stdout.length < 4_000);
  assert.equal(await readFile(documentPath, "utf8"), beforeContent);

  const changes = run(["author", "changes"], projectRoot);
  assert.equal(changes.status, 0, changes.stderr);
  assert.match(changes.stdout, new RegExp(proposal.id, "u"));
  assert.match(changes.stdout, /Before:[\s\S]*After:/u);

  const decided = run(
    ["author", "decide", "--json", "-"],
    projectRoot,
    JSON.stringify({
      expected_revision: JSON.parse(proposed.stdout).workspace.revision,
      proposal_id: proposal.id,
      decision: "accept"
    })
  );
  assert.equal(decided.status, 0, decided.stderr);
  assert.equal(JSON.parse(decided.stdout).proposal.status, "accepted");
  assert.equal(await readFile(documentPath, "utf8"), beforeContent);

  const applied = run(
    ["author", "apply", "--json", "-"],
    projectRoot,
    JSON.stringify({
      expected_revision: JSON.parse(decided.stdout).workspace.revision,
      proposal_id: proposal.id
    })
  );
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).proposal.status, "applied");
  assert.equal(await readFile(documentPath, "utf8"), afterContent);
});

test("author candidate commands preserve inference until the author decides", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-author-"));
  const projectRoot = path.join(temporaryRoot, "project");
  const packageRoot = path.join(projectRoot, "seedspec");
  await cp(fixture, packageRoot, { recursive: true });
  assert.equal(run(["author"], projectRoot).status, 0);
  const review = run(["author", "review"], projectRoot);
  assert.equal(review.status, 0, review.stderr);
  assert.match(review.stdout, /author candidate[^\n]+--json -/u);
  assert.match(review.stdout, /source_claims/u);

  const beforeContent = await readFile(path.join(packageRoot, "definition", "app.md"), "utf8");
  const recorded = run(
    ["author", "candidate", "--json", "-"],
    projectRoot,
    JSON.stringify({
      expected_revision: currentAuthoringRevision(projectRoot),
      issue: "The source permits two meanings for archiving.",
      alternatives: ["Archive is final", "Archive is reversible"],
      assumed_default: "Archive is reversible",
      basis: {
        source_claims: [{ reference: "definition/app.md", statement: "Records can be archived." }],
        inference: "The source does not state whether archived records can return."
      }
    })
  );
  assert.equal(recorded.status, 0, recorded.stderr);
  const candidate = JSON.parse(recorded.stdout).candidate;
  assert.equal(candidate.status, "open");
  assert.match(candidate.id, /^candidate-[0-9a-f-]{36}$/u);
  assert.equal(JSON.parse(recorded.stdout).snapshot, undefined);
  assert.equal(await readFile(path.join(packageRoot, "definition", "app.md"), "utf8"), beforeContent);

  const listed = run(["author", "candidates"], projectRoot);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, new RegExp(candidate.id, "u"));
  assert.match(listed.stdout, /model inference|authoring evidence/iu);
  const listedJson = run(["author", "candidates", "--json"], projectRoot);
  assert.equal(listedJson.status, 0, listedJson.stderr);
  const retainedCandidate = JSON.parse(listedJson.stdout).items[0];
  assert.equal(retainedCandidate.basis.actor, "authoring-agent");
  assert.equal(retainedCandidate.materiality, "material");
  assert.deepEqual(retainedCandidate.affected, []);
  assert.equal(retainedCandidate.recommended_disposition, "ask");

  const declined = run(
    ["author", "candidate-decide", "--json", "-"],
    projectRoot,
    JSON.stringify({
      expected_revision: JSON.parse(recorded.stdout).workspace.revision,
      candidate_id: candidate.id,
      decision: "decline",
      rationale: "Leave the current seed at its existing depth."
    })
  );
  assert.equal(declined.status, 0, declined.stderr);
  assert.equal(JSON.parse(declined.stdout).candidate.status, "declined");
  assert.equal(await readFile(path.join(packageRoot, "definition", "app.md"), "utf8"), beforeContent);
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
    JSON.stringify({
      expected_revision: currentAuthoringRevision(projectRoot),
      entries: [{ type: "question", question: "Is that the direction?" }]
    })
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
    .replace(/\{"expected_revision":"sha256:[0-9a-f]{64}","question_id":"\.\.\.","answer":"\.\.\.","resolution":"resolved"\}/u, JSON.stringify({
      expected_revision: JSON.parse(recorded.stdout).workspace.revision,
      question_id: questionId,
      answer: "That's right — don't change it.",
      resolution: "resolved"
    }));
  const answered = spawnSync("/bin/sh", ["-c", command], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  assert.equal(answered.status, 0, answered.stderr);

  const result = JSON.parse(answered.stdout);
  assert.equal(result.question.status, "resolved");
  assert.equal(result.snapshot, undefined);
  const status = JSON.parse(run(["author", "status", "--json"], projectRoot).stdout);
  assert.equal(status.review.questions.open, 0);
  assert.equal(status.review.questions.resolved, 1);
  assert.equal(status.review.questions.items[0].answer, "That's right — don't change it.");
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
