import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import {
  authoringPostureSelectionsMatch,
  createAuthoringPosture,
  isPostureConfirmationQuestion,
  validateAuthoringPosture,
  validateAuthoringPostureProposal,
  validatePostureConfirmationMessage
} from "../scripts/lib/authoring-posture.mjs";
import { validateConflictInventory } from "../scripts/lib/conflict-inventory.mjs";
import { evaluateFixedClaimContract } from "../scripts/lib/fixed-claim-gate.mjs";
import { preeditArtifact } from "../scripts/lib/preedit-artifacts.mjs";
import { classifyProxyMessage } from "../scripts/lib/proxy-author.mjs";

const execFileAsync = promisify(execFile);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testRoot, "../..");
const planScript = path.join(repositoryRoot, "authoring-evals", "scripts", "plan-matrix.mjs");
const runCellScript = path.join(repositoryRoot, "authoring-evals", "scripts", "run-matrix-cell.mjs");

test("matrix planning freezes the four-model six-subject pilot without authorizing spend", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-authoring-matrix-plan-"));
  const output = path.join(temporaryRoot, "plan.json");
  const result = await execFileAsync(process.execPath, [planScript, "--out", output], {
    cwd: repositoryRoot,
    maxBuffer: 20 * 1024 * 1024
  });
  const summary = JSON.parse(result.stdout);
  const plan = JSON.parse(await readFile(output, "utf8"));
  assert.equal(summary.subjects, 6);
  assert.equal(summary.models, 4);
  assert.equal(summary.cells, 24);
  assert.equal(summary.execution_ready, false);
  assert.equal(plan.limits.anthropic_total_spend_usd, null);
  assert.equal(plan.limits.anthropic_cell_count, 12);
  assert.equal(plan.limits.anthropic_per_cell_spend_usd, null);
  assert.equal(plan.regression_lane.baseline_version, "0.3.1");
  assert.equal(plan.regression_lane.status, "reserved");
  assert.equal(plan.judge.model, "gpt-5.6-sol");
  assert.deepEqual(plan.mechanisms, {
    decision_ledger: false,
    final_review: false,
    authoring_posture: false,
    posture_confirmation: false,
    posture_fused_confirmation: false,
    fixed_claim_gate: false,
    conflict_inventory: false,
    decision_contract: false,
    intent_registry: false,
    semantic_change_plan: false,
    acceptance_contract: false
  });
  assert.deepEqual(
    [...new Set(plan.cells.map(({ model }) => model.id))].sort(),
    ["claude-opus", "claude-sonnet", "codex-luna", "codex-terra"]
  );
});

test("matrix planning allocates one aggregate Claude ceiling across Claude cells", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-authoring-matrix-spend-"));
  const output = path.join(temporaryRoot, "plan.json");
  const result = await execFileAsync(process.execPath, [
    planScript,
    "--max-spend-usd", "20",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const summary = JSON.parse(result.stdout);
  const plan = JSON.parse(await readFile(output, "utf8"));
  assert.equal(summary.execution_ready, true);
  assert.equal(plan.limits.anthropic_total_spend_usd, 20);
  assert.equal(plan.limits.anthropic_cell_count, 12);
  assert.equal(plan.limits.anthropic_per_cell_spend_usd, 1.66);
  assert.equal(plan.limits.anthropic_allocated_spend_usd, 19.92);
});

test("prepare-only materializes a fresh-agent matrix cell without calling a model", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-authoring-matrix-cell-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "05-fresh-context-recovery",
    "--model", "codex-luna",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  const cell = plan.cells[0];
  const runsRoot = path.join(temporaryRoot, "runs");
  const result = await execFileAsync(process.execPath, [
    runCellScript,
    "--plan", output,
    "--cell", cell.cell_id,
    "--runs-root", runsRoot,
    "--prepare-only"
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const prepared = JSON.parse(result.stdout);
  const contract = JSON.parse(await readFile(path.join(prepared.run, "run-contract.json"), "utf8"));
  assert.equal(contract.authoring_eval_run_contract_version, "2");
  assert.equal(contract.subject.format_version, "2");
  assert.deepEqual(contract.execution.continuation.fresh_turns, [3]);
  assert.equal(contract.execution.model.selector, "gpt-5.6-luna");
  assert.equal(contract.cli.version, "0.3.1");
});

test("simple-authoring preparation removes the SeedSpec authoring workflow", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-simple-authoring-cell-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "01-sparse-product-idea",
    "--model", "codex-terra",
    "--workflow", "simple-authoring",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  const cell = plan.cells[0];
  const runsRoot = path.join(temporaryRoot, "runs");
  const result = await execFileAsync(process.execPath, [
    runCellScript,
    "--plan", output,
    "--cell", cell.cell_id,
    "--runs-root", runsRoot,
    "--prepare-only"
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const prepared = JSON.parse(result.stdout);
  const contract = JSON.parse(await readFile(path.join(prepared.run, "run-contract.json"), "utf8"));
  const handoff = await readFile(path.join(prepared.run, "workspace", "HANDOFF.md"), "utf8");
  assert.equal(plan.workflow, "simple-authoring");
  assert.equal(contract.execution.workflow, "simple-authoring");
  assert.equal(contract.snapshots.initial_authoring_state.files, 0);
  assert.match(handoff, /Edit the package under `seedspec\/` directly/u);
  assert.match(handoff, /Do not use any `seedspec author` command/u);
});

test("simple-authoring freezes one isolated decision-ledger mechanism", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-simple-mechanisms-cell-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "05-fresh-context-recovery",
    "--model", "codex-terra",
    "--workflow", "simple-authoring",
    "--decision-ledger", "true",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  const cell = plan.cells[0];
  const runsRoot = path.join(temporaryRoot, "runs");
  const result = await execFileAsync(process.execPath, [
    runCellScript,
    "--plan", output,
    "--cell", cell.cell_id,
    "--runs-root", runsRoot,
    "--prepare-only"
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const prepared = JSON.parse(result.stdout);
  const contract = JSON.parse(await readFile(path.join(prepared.run, "run-contract.json"), "utf8"));
  const ledger = JSON.parse(
    await readFile(path.join(prepared.run, "workspace", "authoring", "decision-ledger.json"), "utf8")
  );
  const handoff = await readFile(path.join(prepared.run, "workspace", "HANDOFF.md"), "utf8");
  assert.deepEqual(plan.mechanisms, {
    decision_ledger: true,
    final_review: false,
    authoring_posture: false,
    posture_confirmation: false,
    posture_fused_confirmation: false,
    fixed_claim_gate: false,
    conflict_inventory: false,
    decision_contract: false,
    intent_registry: false,
    semantic_change_plan: false,
    acceptance_contract: false
  });
  assert.deepEqual(contract.execution.mechanisms, plan.mechanisms);
  assert.deepEqual(ledger.entries, []);
  assert.match(handoff, /Read that ledger at the start of every turn/u);
});

test("simple-authoring prepares a private controller-derived posture", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-authoring-posture-cell-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "01-sparse-product-idea",
    "--model", "codex-luna",
    "--workflow", "simple-authoring",
    "--authoring-posture", "true",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  const result = await execFileAsync(process.execPath, [
    runCellScript,
    "--plan", output,
    "--cell", plan.cells[0].cell_id,
    "--runs-root", path.join(temporaryRoot, "runs"),
    "--prepare-only"
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const prepared = JSON.parse(result.stdout);
  const posture = JSON.parse(
    await readFile(path.join(prepared.run, "workspace", "authoring", "posture.json"), "utf8")
  );
  const handoff = await readFile(path.join(prepared.run, "workspace", "HANDOFF.md"), "utf8");
  assert.deepEqual(posture, createAuthoringPosture({
    ambition: "small",
    audience: "fresh-internal",
    handoff: "planning",
    collaboration: "brief"
  }));
  assert.match(handoff, /private authoring-intent preflight/u);
  assert.match(handoff, /not product intent/u);
});

test("authoring posture validation rejects changed derived guidance", () => {
  const input = {
    ambition: "small",
    audience: "fresh-internal",
    handoff: "planning",
    collaboration: "brief"
  };
  const posture = createAuthoringPosture(input);
  assert.deepEqual(validateAuthoringPosture(posture, input), []);
  posture.guidance[0] = "Expand into adjacent capabilities.";
  assert.deepEqual(validateAuthoringPosture(posture, input), [
    "authoring posture does not match the controller-derived posture"
  ]);
});

test("posture proposal validation preserves a measurable four-field recommendation", () => {
  const proposal = {
    authoring_eval_posture_proposal_version: "1",
    ambition: "small",
    audience: "fresh-internal",
    handoff: "planning",
    collaboration: "brief",
    rationale: "The request is a bounded first specification for a fresh planner."
  };
  assert.deepEqual(validateAuthoringPostureProposal(proposal), []);
  assert.equal(authoringPostureSelectionsMatch(proposal, {
    ambition: "small",
    audience: "fresh-internal",
    handoff: "planning",
    collaboration: "brief"
  }), true);
  assert.deepEqual(validatePostureConfirmationMessage(
    "Ambition small; audience fresh-internal; handoff planning; collaboration brief. Should I use this authoring posture, or would you correct a selection?",
    proposal
  ), []);
  assert.equal(isPostureConfirmationQuestion(
    "Ambition small; audience fresh-internal; handoff planning; collaboration brief. Should I use this authoring posture, or would you correct a selection?"
  ), true);
  assert.equal(isPostureConfirmationQuestion(
    "Ambition small; audience fresh-internal; handoff planning; collaboration brief. You can correct any selection. What should happen when a tool is already lent out?"
  ), false);
});

test("posture confirmation preparation does not inject the hidden accepted posture", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-posture-confirmation-cell-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "01-sparse-product-idea",
    "--model", "codex-luna",
    "--workflow", "simple-authoring",
    "--posture-confirmation", "true",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  const result = await execFileAsync(process.execPath, [
    runCellScript,
    "--plan", output,
    "--cell", plan.cells[0].cell_id,
    "--runs-root", path.join(temporaryRoot, "runs"),
    "--prepare-only"
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const prepared = JSON.parse(result.stdout);
  const contract = JSON.parse(await readFile(path.join(prepared.run, "run-contract.json"), "utf8"));
  const handoff = await readFile(path.join(prepared.run, "workspace", "HANDOFF.md"), "utf8");
  assert.equal(contract.execution.mechanisms.posture_confirmation, true);
  assert.equal(contract.snapshots.initial_authoring_state.files, 0);
  assert.doesNotMatch(handoff, /ambition small/u);
  await assert.rejects(
    readFile(path.join(prepared.run, "workspace", "authoring", "posture.json"), "utf8"),
    /ENOENT/u
  );
});

test("fused posture confirmation freezes a distinct isolated mechanism", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-posture-fused-plan-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "02-mature-requirements",
    "--model", "codex-luna",
    "--workflow", "simple-authoring",
    "--posture-fused-confirmation", "true",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  assert.equal(plan.mechanisms.posture_fused_confirmation, true);
  assert.equal(Object.values(plan.mechanisms).filter(Boolean).length, 1);
});

test("planner permits fused posture with the fixed-claim publish gate", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-posture-fixed-pair-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "02-mature-requirements",
    "--model", "codex-luna",
    "--workflow", "simple-authoring",
    "--posture-fused-confirmation", "true",
    "--fixed-claim-gate", "true",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  assert.equal(plan.mechanisms.posture_fused_confirmation, true);
  assert.equal(plan.mechanisms.fixed_claim_gate, true);
  assert.equal(Object.values(plan.mechanisms).filter(Boolean).length, 2);
});

test("fixed-claim gate finds permissive schema targets without flagging matching examples", async () => {
  const subjectRoot = path.join(
    repositoryRoot,
    "authoring-evals",
    "subjects",
    "02-mature-requirements"
  );
  const subject = parseYaml(await readFile(path.join(subjectRoot, "subject.yaml"), "utf8"));
  const issues = await evaluateFixedClaimContract(
    subject.fixed_claim_contract,
    path.join(subjectRoot, "package")
  );
  assert.equal(issues.length, 5);
  assert.deepEqual(
    issues.map(({ claim_id: claimId }) => claimId).sort(),
    ["dashboard-name", "delivery-time", "metric-property", "reporting-timezone", "slack-channel"]
  );
  assert.equal(issues.every(({ target }) => target === "configuration/schema.json"), true);
});

test("simple-authoring prepares an agent-authored conflict inventory", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-conflict-inventory-cell-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "06-composition-conflict",
    "--model", "codex-terra",
    "--workflow", "simple-authoring",
    "--conflict-inventory", "true",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  const cell = plan.cells[0];
  const result = await execFileAsync(process.execPath, [
    runCellScript,
    "--plan", output,
    "--cell", cell.cell_id,
    "--runs-root", path.join(temporaryRoot, "runs"),
    "--prepare-only"
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const prepared = JSON.parse(result.stdout);
  const contract = JSON.parse(await readFile(path.join(prepared.run, "run-contract.json"), "utf8"));
  const handoff = await readFile(path.join(prepared.run, "workspace", "HANDOFF.md"), "utf8");
  assert.equal(contract.execution.mechanisms.conflict_inventory, true);
  assert.match(handoff, /Before editing the package, complete the controller's analysis-only turn/u);
});

test("decision-contract preparation includes durable answer state", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-decision-contract-cell-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "05-fresh-context-recovery",
    "--model", "codex-luna",
    "--workflow", "simple-authoring",
    "--decision-contract", "true",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  const result = await execFileAsync(process.execPath, [
    runCellScript,
    "--plan", output,
    "--cell", plan.cells[0].cell_id,
    "--runs-root", path.join(temporaryRoot, "runs"),
    "--prepare-only"
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const prepared = JSON.parse(result.stdout);
  const contract = JSON.parse(await readFile(path.join(prepared.run, "run-contract.json"), "utf8"));
  const ledger = JSON.parse(
    await readFile(path.join(prepared.run, "workspace", "authoring", "decision-ledger.json"), "utf8")
  );
  assert.equal(contract.execution.mechanisms.decision_contract, true);
  assert.deepEqual(ledger.entries, []);
});

test("decision contract accepts one or many source references", () => {
  const mechanism = preeditArtifact({ decision_contract: true });
  assert.deepEqual(mechanism.validate({
    authoring_eval_decision_contract_version: "1",
    decisions: [{
      id: "delivery",
      source: ["requirements.md", "operations.md"],
      question: "Which delivery behavior applies?",
      consequence: "Changes observable delivery",
      resolver: "Product owner",
      status: "unresolved",
      outcome_bounds: ["Do not fabricate data"],
      blocked_actions: ["Publish package"]
    }]
  }), []);
});

test("acceptance contract accepts structured or scalar scenario fields", () => {
  const mechanism = preeditArtifact({ acceptance_contract: true });
  assert.deepEqual(mechanism.validate({
    authoring_eval_acceptance_contract_version: "1",
    scenarios: ["one", "two", "three"].map((id) => ({
      id,
      source: ["requirements.md"],
      given: { state: "ready" },
      when: "The workflow runs",
      then: ["The outcome is visible"],
      forbidden: "No duplicate outcome"
    })),
    failure_scenarios: [{
      id: "failure",
      source: "operations.md",
      given: "Delivery fails",
      when: "The workflow runs",
      then: "The failure is visible"
    }],
    configuration_invariants: [{
      id: "timezone",
      source: "requirements.md",
      field: "timezone",
      requirement: "Use the configured timezone"
    }]
  }), []);
});

test("conflict inventory validation requires controls, conflict, authority, decision, and candidates", () => {
  assert.deepEqual(validateConflictInventory({}), [
    "authoring_eval_conflict_inventory_version must be 1",
    "governing_controls must contain at least 2 item(s)",
    "conflicts must contain at least 1 item(s)",
    "authority_boundaries must contain at least 1 item(s)",
    "unresolved_decisions must contain at least 1 item(s)",
    "candidates must contain at least 1 item(s)"
  ]);
});

test("conflict inventory accepts keyed candidate compatibility", () => {
  assert.deepEqual(validateConflictInventory({
    authoring_eval_conflict_inventory_version: "1",
    governing_controls: [
      { id: "first", source: "first.md", requirement: "First control" },
      { id: "second", source: "second.md", requirement: "Second control" }
    ],
    conflicts: [{ id: "conflict", control_ids: ["first", "second"], description: "Conflict" }],
    authority_boundaries: [{ id: "owner", source: "owner.md", authority: "Cannot waive" }],
    unresolved_decisions: [{
      id: "resolution",
      question: "Which control governs?",
      resolver: "Steering group",
      blocked_actions: ["Provider selection"]
    }],
    candidates: [{
      id: "candidate",
      control_compatibility: { first: "compatible", second: "incompatible" },
      selection_status: "unselected"
    }]
  }), []);
});

test("conflict inventory accepts prose compatibility and subsidiary conflicts", () => {
  assert.deepEqual(validateConflictInventory({
    authoring_eval_conflict_inventory_version: "1",
    governing_controls: [
      { id: "first", source: "first.md", requirement: "First control" },
      { id: "second", source: "second.md", requirement: "Second control" }
    ],
    conflicts: [
      { id: "core", control_ids: ["first", "second"], description: "Core conflict" },
      { id: "candidate", control_ids: ["first"], description: "Candidate incompatibility" }
    ],
    authority_boundaries: [{ id: "owner", source: "owner.md", authority: "Cannot waive" }],
    unresolved_decisions: [{
      id: "resolution",
      question: "Which control governs?",
      resolver: "Steering group",
      blocked_actions: ["Provider selection"]
    }],
    candidates: [{
      id: "candidate",
      control_compatibility: "Compatible with first; incompatible with second.",
      selection_status: "unselected"
    }]
  }), []);
});

test("matrix planning rejects combined isolated mechanisms", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-combined-mechanisms-plan-"));
  await assert.rejects(
    execFileAsync(process.execPath, [
      planScript,
      "--subject", "06-composition-conflict",
      "--model", "codex-terra",
      "--workflow", "simple-authoring",
      "--final-review", "true",
      "--conflict-inventory", "true",
      "--out", path.join(temporaryRoot, "plan.json")
    ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 }),
    /Enable one isolated mechanism or the fused-posture fixed-claim pair/u
  );
});

test("isolated mechanisms reject the SeedSpec authoring workflow", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-invalid-mechanism-plan-"));
  await assert.rejects(
    execFileAsync(process.execPath, [
      planScript,
      "--subject", "05-fresh-context-recovery",
      "--model", "codex-terra",
      "--decision-ledger", "true",
      "--out", path.join(temporaryRoot, "plan.json")
    ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 }),
    /Isolated mechanisms require --workflow simple-authoring/u
  );
});

test("model execution rejects a run root inside the frozen CLI source", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-authoring-matrix-root-"));
  const output = path.join(temporaryRoot, "plan.json");
  await execFileAsync(process.execPath, [
    planScript,
    "--subject", "01-sparse-product-idea",
    "--model", "codex-terra",
    "--out", output
  ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 });
  const plan = JSON.parse(await readFile(output, "utf8"));
  const cell = plan.cells[0];
  await assert.rejects(
    execFileAsync(process.execPath, [
      runCellScript,
      "--plan", output,
      "--cell", cell.cell_id,
      "--runs-root", path.join(repositoryRoot, "authoring-evals", "runs"),
      "--confirm-model-execution"
    ], { cwd: repositoryRoot, maxBuffer: 20 * 1024 * 1024 }),
    /outside the frozen CLI source root/
  );
});

test("proxy classification distinguishes expected, repeated, and unexpected questions", () => {
  const subject = {
    proxy_author: {
      decisions: [{
        id: "delivery",
        match: { any: ["delivery channel", "email or team channel"] },
        answer: "Use the team channel."
      }]
    }
  };
  const empty = { answered: [] };
  const first = classifyProxyMessage(subject, "Which delivery channel should we use?", empty);
  assert.equal(first.status, "answer");
  const answered = {
    answered: [{ decision_id: "delivery", turn: 1, question_digest: "x", answer_digest: "y" }]
  };
  const repeated = classifyProxyMessage(subject, "Should the delivery channel be email or team channel?", answered);
  assert.equal(repeated.status, "repeated-question");
  const unexpected = classifyProxyMessage(subject, "Which database should I choose?", answered);
  assert.equal(unexpected.status, "unexpected-question");
  const punctuation = classifyProxyMessage({
    proxy_author: {
      decisions: [{
        id: "availability",
        match: { any: ["already lent"] },
        answer: "Queue one request."
      }]
    }
  }, "What happens to an already-lent tool request?", empty);
  assert.equal(punctuation.status, "answer");
  const interleaved = classifyProxyMessage({
    proxy_author: {
      decisions: [{
        id: "empty-day",
        match: { any: ["no data message"] },
        answer: "Send one explicit no-data message."
      }]
    }
  }, "Should we send a no data for yesterday message, or skip it?", empty);
  assert.equal(interleaved.status, "answer");
});
