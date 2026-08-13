import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testRoot, "../..");
const scriptsRoot = path.join(repositoryRoot, "authoring-evals", "scripts");
const dimensionIds = [
  "semantic-fidelity",
  "invented-obligations",
  "missed-consequential-decisions",
  "unnecessary-question-burden",
  "implementation-latitude",
  "internal-consistency",
  "packaging-readiness",
  "fresh-agent-usefulness"
];
const axes = [
  {
    axis_id: "meaning:authoritative-outcome",
    reference_kind: "meaning",
    reference_id: "authoritative-outcome",
    level: "critical"
  },
  {
    axis_id: "permitted-variability:presentation",
    reference_kind: "permitted-variability",
    reference_id: "presentation",
    level: "material"
  },
  {
    axis_id: "decision:wording",
    reference_kind: "decision",
    reference_id: "wording",
    level: "minor"
  }
];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function contentId(prefix, value) {
  return `${prefix}-${sha256(canonicalJson(value)).slice("sha256:".length)}`;
}

async function runScript(name, args, { reject = true } = {}) {
  try {
    const result = await execFileAsync(process.execPath, [path.join(scriptsRoot, name), ...args], {
      cwd: repositoryRoot,
      maxBuffer: 20 * 1024 * 1024
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (reject) throw error;
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

async function syntheticKit(packageText = "Use the approved result.") {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-semantic-kit-"));
  const kitRoot = path.join(temporaryRoot, "kit");
  const contents = new Map([
    ["final-package/definition.md", `# Outcome\n\n${packageText}\n`],
    ["source-material/sources/brief.md", "# Brief\n\nThe approved result is required.\n"],
    ["process/transcript.jsonl", `${JSON.stringify({ turn: 1, role: "assistant", text: "Question?" })}\n`],
    ["reference-ledgers.json", `${JSON.stringify({ semantic_reference_version: "1" })}\n`]
  ]);
  const files = [];
  for (const [relativePath, source] of contents) {
    const content = Buffer.from(source, "utf8");
    await mkdir(path.dirname(path.join(kitRoot, relativePath)), { recursive: true });
    await writeFile(path.join(kitRoot, relativePath), content);
    files.push({
      path: relativePath,
      role: relativePath.startsWith("final-package/")
        ? "final-package"
        : relativePath.startsWith("source-material/")
          ? "source-material"
          : relativePath.startsWith("process/") ? "sanitized-process" : "reference-ledgers",
      digest: sha256(content),
      bytes: content.byteLength
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path, "en"));
  const body = {
    semantic_grade_evidence_version: "1",
    subject: {
      id: "synthetic-subject",
      format_version: "2",
      digest: `sha256:${"1".repeat(64)}`
    },
    cli_baseline: {
      version: "0.3.1-test",
      protocol_release: "synthetic-release",
      source_digest: `sha256:${"2".repeat(64)}`
    },
    dimensions: dimensionIds,
    reference_axes: axes,
    blinding: {
      runner_identity: "excluded",
      model_identity: "excluded",
      usage: "excluded",
      raw_evaluation_report: "excluded"
    },
    files
  };
  const evidence = { ...body, evidence_id: contentId("semantic-grade-evidence", body) };
  const evidencePath = path.join(kitRoot, "evidence.json");
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return { temporaryRoot, kitRoot, evidencePath, evidence };
}

async function completedSubjectV2Run() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-semantic-run-"));
  const runDirectory = path.join(temporaryRoot, "run");
  await runScript("prepare-run.mjs", [
    "--subject", path.join(repositoryRoot, "authoring-evals", "subjects", "01-sparse-product-idea"),
    "--out", runDirectory,
    "--runner-id", "hidden-runner",
    "--runner-version", "hidden-runner-version",
    "--model-provider", "hidden-provider",
    "--model-id", "hidden-model-id",
    "--model-selector", "hidden-model-selector",
    "--reasoning-effort", "test",
    "--tool", "filesystem",
    "--tool", "shell",
    "--network", "disabled",
    "--max-duration-ms", "60000",
    "--max-turns", "10",
    "--max-spend-usd", "none",
    "--max-input-tokens", "1000000",
    "--max-output-tokens", "100000",
    "--retention-class", "test-local"
  ]);
  await runScript("start-run.mjs", ["--run", runDirectory]);
  const transcript = path.join(temporaryRoot, "transcript.jsonl");
  const commands = path.join(temporaryRoot, "commands.jsonl");
  const usage = path.join(temporaryRoot, "usage.json");
  const finalMessage = path.join(temporaryRoot, "final-message.md");
  await Promise.all([
    writeFile(transcript, `${JSON.stringify({
      turn: 1,
      runner: "hidden-runner",
      model: "hidden-model-id",
      provider: "hidden-provider",
      text: "Answer from hidden-model-selector."
    })}\n`),
    writeFile(commands, `${JSON.stringify({
      turn: 1,
      command: "node seedspec author status",
      runner_id: "hidden-runner"
    })}\n`),
    writeFile(usage, `${JSON.stringify({
      capture: "runner-reported",
      input_tokens: 20,
      output_tokens: 10,
      turns: 1
    })}\n`),
    writeFile(finalMessage, "Completed by hidden-provider with hidden-model-id.\n")
  ]);
  const finalized = await runScript("finalize-run.mjs", [
    "--run", runDirectory,
    "--status", "succeeded",
    "--exit-code", "0",
    "--transcript", transcript,
    "--commands", commands,
    "--usage", usage,
    "--final-message", finalMessage
  ]);
  assert.equal(JSON.parse(finalized.stdout).outcome, "completed");
  return { temporaryRoot, runDirectory };
}

function referenceSummary(assessments) {
  return {
    axis_count: assessments.length,
    aligned_count: assessments.filter(({ alignment }) => alignment === "aligned").length,
    within_permitted_variation_count: assessments.filter(({ alignment }) => (
      alignment === "within-permitted-variation"
    )).length,
    divergent_count: assessments.filter(({ alignment }) => alignment === "divergent").length,
    critical_divergences: assessments.filter(({ level, alignment }) => (
      level === "critical" && alignment === "divergent"
    )).map(({ axis_id: axisId }) => axisId),
    permitted_variability_respected: assessments.every(({ permitted_variability_respected: respected }) => respected)
  };
}

function draftFor(evidence, evaluatorId, { score = 3, divergences = [] } = {}) {
  const citations = [{
    path: "final-package/definition.md",
    locator: "Outcome paragraph",
    observation: "The package states the evaluated outcome."
  }];
  const referenceAssessments = axes.map((axis) => {
    const divergent = divergences.includes(axis.axis_id);
    const variability = axis.reference_kind === "permitted-variability";
    return {
      ...axis,
      alignment: divergent
        ? "divergent"
        : variability ? "within-permitted-variation" : "aligned",
      permitted_variability_respected: !(divergent && variability),
      confidence: "high",
      citations,
      rationale: divergent ? "The package conflicts with this axis." : "The package remains within this axis."
    };
  });
  const total = score * dimensionIds.length;
  return {
    semantic_grade_version: "1",
    evidence_id: evidence.evidence_id,
    subject: evidence.subject,
    cli_baseline: evidence.cli_baseline,
    evaluator_id: evaluatorId,
    dimensions: dimensionIds.map((id) => ({
      id,
      score,
      confidence: "high",
      citations,
      rationale: `Synthetic rationale for ${id}.`
    })),
    reference_assessments: referenceAssessments,
    summary: { total_score: total, maximum_score: 32, mean_score: total / 8 },
    reference_summary: referenceSummary(referenceAssessments),
    limitations: []
  };
}

async function finalizeDraft(kit, draft, name) {
  const draftPath = path.join(kit.temporaryRoot, `${name}-draft.json`);
  const gradePath = path.join(kit.temporaryRoot, `${name}-grade.json`);
  await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`);
  const result = await runScript("finalize-semantic-grade.mjs", [
    "--draft", draftPath,
    "--evidence", kit.evidencePath,
    "--out", gradePath
  ]);
  return { gradePath, grade: JSON.parse(result.stdout) };
}

test("semantic finalization validates identity, schema, exact dimensions, and arithmetic", async () => {
  const kit = await syntheticKit();
  const finalized = await finalizeDraft(kit, draftFor(kit.evidence, "evaluator-a"), "valid");
  assert.match(finalized.grade.grade_id, /^semantic-grade-[a-f0-9]{64}$/u);
  assert.equal(finalized.grade.summary.total_score, 24);
  assert.deepEqual(finalized.grade.dimensions.map(({ id }) => id), dimensionIds);
  assert.equal(finalized.grade.reference_summary.within_permitted_variation_count, 1);

  const wrong = draftFor(kit.evidence, "evaluator-b");
  wrong.summary.total_score = 23;
  const wrongPath = path.join(kit.temporaryRoot, "wrong-draft.json");
  await writeFile(wrongPath, `${JSON.stringify(wrong)}\n`);
  const rejected = await runScript("finalize-semantic-grade.mjs", [
    "--draft", wrongPath,
    "--evidence", kit.evidencePath
  ], { reject: false });
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /Grade arithmetic is invalid/u);
});

test("semantic gate replaces lexical matching with critical and material reference axes", async () => {
  const kit = await syntheticKit();
  const aligned = await finalizeDraft(kit, draftFor(kit.evidence, "evaluator-a"), "gate-aligned");
  const alignedResult = await runScript("evaluate-semantic-grade.mjs", [
    "--grade", aligned.gradePath
  ]);
  const alignedGate = JSON.parse(alignedResult.stdout);
  assert.equal(alignedGate.gate.passed, true);
  assert.equal(alignedGate.gate.lexical_matching_used, false);

  const divergentKit = await syntheticKit("The package contradicts the approved result.");
  const divergent = await finalizeDraft(
    divergentKit,
    draftFor(divergentKit.evidence, "evaluator-a", {
      divergences: ["meaning:authoritative-outcome"]
    }),
    "gate-divergent"
  );
  const divergentResult = await runScript("evaluate-semantic-grade.mjs", [
    "--grade", divergent.gradePath
  ]);
  const divergentGate = JSON.parse(divergentResult.stdout);
  assert.equal(divergentGate.gate.passed, false);
  assert.deepEqual(divergentGate.gate.critical_divergences, [
    "meaning:authoritative-outcome"
  ]);
});

test("preparation builds a blinded, content-addressed kit from a completed v2 run", async () => {
  const run = await completedSubjectV2Run();
  const kitRoot = path.join(run.temporaryRoot, "semantic-kit");
  const prepared = await runScript("prepare-semantic-grade.mjs", [
    "--run", run.runDirectory,
    "--out", kitRoot
  ]);
  const summary = JSON.parse(prepared.stdout);
  const evidence = JSON.parse(await readFile(path.join(kitRoot, "evidence.json"), "utf8"));
  assert.match(summary.evidence_id, /^semantic-grade-evidence-[a-f0-9]{64}$/u);
  assert.equal(summary.evidence_id, evidence.evidence_id);
  assert.deepEqual(evidence.dimensions, dimensionIds);
  assert.ok(evidence.reference_axes.length > 0);
  assert.ok(evidence.files.some(({ role }) => role === "final-package"));
  assert.ok(evidence.files.some(({ role }) => role === "source-material"));
  assert.ok(evidence.files.some(({ role }) => role === "sanitized-process"));
  assert.ok(evidence.files.some(({ role }) => role === "reference-ledgers"));
  assert.equal(evidence.files.some(({ path: filePath }) => /usage/iu.test(filePath)), false);
  const visible = (await Promise.all(evidence.files.map(async ({ path: filePath }) => (
    readFile(path.join(kitRoot, filePath), "utf8")
  )))).join("\n");
  assert.doesNotMatch(visible, /hidden-runner|hidden-provider|hidden-model/iu);
  assert.match(visible, /semantic-fidelity/u);
  assert.match(visible, /same-building-visibility/u);
});

test("semantic judge prepare-only freezes Sol without calling the model", async () => {
  const run = await completedSubjectV2Run();
  const outputRoot = path.join(run.temporaryRoot, "semantic-judge");
  const prepared = await runScript("run-semantic-grade.mjs", [
    "--run", run.runDirectory,
    "--out", outputRoot,
    "--prepare-only"
  ]);
  const summary = JSON.parse(prepared.stdout);
  const judgePlan = JSON.parse(await readFile(path.join(outputRoot, "judge-plan.json"), "utf8"));
  assert.equal(summary.status, "prepared");
  assert.equal(summary.grade, null);
  assert.equal(judgePlan.model, "gpt-5.6-sol");
  assert.equal(judgePlan.reasoning_effort, "high");
  assert.match(judgePlan.judge_plan_id, /^semantic-judge-plan-[a-f0-9]{64}$/u);
  assert.equal(await readFile(path.join(outputRoot, "evidence-kit", "INSTRUCTIONS.md"), "utf8")
    .then((content) => content.includes("semantic-fidelity")), true);
});

test("semantic finalization rejects changed kit evidence", async () => {
  const kit = await syntheticKit();
  await writeFile(path.join(kit.kitRoot, "final-package", "definition.md"), "changed\n");
  const draftPath = path.join(kit.temporaryRoot, "draft.json");
  await writeFile(draftPath, `${JSON.stringify(draftFor(kit.evidence, "evaluator-a"))}\n`);
  const rejected = await runScript("finalize-semantic-grade.mjs", [
    "--draft", draftPath,
    "--evidence", kit.evidencePath
  ], { reject: false });
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.stderr, /Evidence file identity changed/u);
});

test("comparison preserves scores and claims only reference-bounded equivalence", async () => {
  const kit = await syntheticKit();
  const first = await finalizeDraft(kit, draftFor(kit.evidence, "evaluator-a", { score: 4 }), "first");
  const secondKit = await syntheticKit("Use the approved result with different presentation.");
  const second = await finalizeDraft(secondKit, draftFor(secondKit.evidence, "evaluator-a", {
    score: 2,
    divergences: ["decision:wording"]
  }), "second");
  const equivalentResult = await runScript("compare-semantic-grades.mjs", [
    "--grade", first.gradePath,
    "--grade", second.gradePath
  ]);
  const equivalent = JSON.parse(equivalentResult.stdout);
  assert.equal(equivalent.bounded_equivalence.claimed, true);
  assert.equal(equivalent.bounded_equivalence.digest_equality_used, false);
  assert.deepEqual(equivalent.grades.map(({ summary }) => summary.total_score), [32, 16]);

  const divergentKit = await syntheticKit("Use a presentation that conflicts with the approved result.");
  const divergent = await finalizeDraft(divergentKit, draftFor(divergentKit.evidence, "evaluator-a", {
    divergences: ["meaning:authoritative-outcome"]
  }), "divergent");
  const divergentResult = await runScript("compare-semantic-grades.mjs", [
    "--grade", first.gradePath,
    "--grade", divergent.gradePath
  ]);
  const comparison = JSON.parse(divergentResult.stdout);
  assert.equal(comparison.bounded_equivalence.claimed, false);
  assert.equal(comparison.bounded_equivalence.no_critical_divergence, false);
  assert.deepEqual(comparison.bounded_equivalence.critical_divergences, [
    "meaning:authoritative-outcome"
  ]);
});
