import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";
import {
  authoringPostureSelectionsMatch,
  validateAuthoringPosture,
  validateAuthoringPostureProposal
} from "./lib/authoring-posture.mjs";
import { validateConflictInventory } from "./lib/conflict-inventory.mjs";
import { evaluateFixedClaimContract } from "./lib/fixed-claim-gate.mjs";
import { isolatedMechanismNames, preeditArtifact } from "./lib/preedit-artifacts.mjs";
import { runPath, sha256, snapshotDirectory, verifyRunContract } from "./lib/run-contract.mjs";

const execFileAsync = promisify(execFile);

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!["--run", "--output"].includes(name) || !value) {
      throw new Error("Usage: evaluate-run.mjs --run <directory> [--output <report.json>]");
    }
    options[name.slice(2)] = value;
  }
  if (!options.run) throw new Error("--run is required");
  return options;
}

async function cliJson(cliPath, args) {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, ...args], {
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(stdout);
}

function countCandidates(items, outcome) {
  return items.filter((candidate) => candidate.disposition?.outcome === outcome).length;
}

const options = parseArguments(process.argv.slice(2));
const runDirectory = path.resolve(options.run);
const contract = await verifyRunContract(runDirectory);
const subjectDirectory = runPath(runDirectory, "control/subject", "control subject path");
const packagePath = runPath(runDirectory, contract.workspace.package, "workspace.package");
const statePath = runPath(runDirectory, contract.workspace.state, "workspace.state");
const cliPath = contract.cli.executable;
const subject = parseYaml(await readFile(path.join(subjectDirectory, "subject.yaml"), "utf8"));
if (subject.id !== contract.subject.id) throw new Error("Frozen subject identity does not match the run contract");
let observedFreshTurns = [1];
try {
  const sessionLedger = JSON.parse(await readFile(path.join(runDirectory, "runner-session.json"), "utf8"));
  observedFreshTurns = sessionLedger.segments.map(({ started_turn: startedTurn }) => startedTurn);
} catch (error) {
  if (error?.code !== "ENOENT" || contract.execution.continuation.fresh_turns.length > 0) throw error;
}
const expectedFreshTurns = [1, ...contract.execution.continuation.fresh_turns];
const workflow = contract.execution.workflow ?? "seedspec-authoring";
const simpleWorkflow = workflow === "simple-authoring";
const mechanisms = Object.fromEntries(isolatedMechanismNames.map((name) => [
  name,
  contract.execution.mechanisms?.[name] ?? false
]));
const postureCapture = mechanisms.posture_confirmation
  || mechanisms.posture_fused_confirmation;

const [inspection, lint] = await Promise.all([
  cliJson(cliPath, ["inspect", packagePath, "--json"]),
  cliJson(cliPath, ["lint", packagePath, "--json"])
]);
let status = null;
let publish = null;
if (!simpleWorkflow) {
  [status, publish] = await Promise.all([
    cliJson(cliPath, ["author", "status", packagePath, "--json"]),
    cliJson(cliPath, ["publish-check", packagePath, "--state", statePath, "--json"])
  ]);
}

const checks = [];
function check(id, passed, detail, category = "integrity") {
  checks.push({ id, category, passed: Boolean(passed), detail });
}

check("protocol-valid", inspection.id && lint.protocol_valid, lint.diagnostics ?? []);
check("lint-clean", (lint.diagnostics ?? []).length === 0, lint.diagnostics ?? []);
if (!simpleWorkflow) {
  check("publish-ready", publish.ready === true, publish.checks ?? []);
}
check(
  "fresh-continuations-observed",
  JSON.stringify(observedFreshTurns) === JSON.stringify(expectedFreshTurns),
  { expected: expectedFreshTurns, observed: observedFreshTurns },
  "outcome"
);
if (simpleWorkflow) {
  const commandTrace = await readFile(path.join(runDirectory, "evidence", "command-trace.jsonl"), "utf8");
  const authorCommands = commandTrace.split(/\r?\n/u).filter(Boolean).map((line) => (
    JSON.parse(line).command ?? ""
  )).filter((command) => /(?:^|\s)author(?:\s|$)/u.test(command));
  check("simple-workflow-adherence", authorCommands.length === 0, authorCommands);
  const postureEnabled = mechanisms.authoring_posture || postureCapture;
  if (postureEnabled) {
    let posture = null;
    try {
      posture = JSON.parse(await readFile(path.join(statePath, "posture.json"), "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const issues = validateAuthoringPosture(posture, subject.authoring_posture);
    check(
      "authoring-posture-preserved",
      issues.length === 0,
      { posture, issues }
    );
    const packageSnapshot = await snapshotDirectory(packagePath);
    const leakedMetadata = [];
    for (const file of packageSnapshot.files) {
      const content = await readFile(path.join(packagePath, file.path), "utf8");
      if (path.basename(file.path) === "posture.json"
          || path.basename(file.path) === "posture-proposal.json"
          || content.includes("authoring_eval_posture_version")
          || content.includes("authoring_eval_posture_proposal_version")
          || content.includes("private authoring-intent preflight")
          || content.includes('"addition_rule"')) {
        leakedMetadata.push(file.path);
      }
    }
    check("authoring-posture-private", leakedMetadata.length === 0, leakedMetadata);
  }
  if (postureCapture) {
    let matrixState = null;
    let proposalSource = "";
    let proposal = null;
    let postureSource = "";
    try {
      [matrixState, proposalSource, postureSource] = await Promise.all([
        readFile(path.join(runDirectory, "control", "matrix-cell-state.json"), "utf8").then(JSON.parse),
        readFile(path.join(statePath, "posture-proposal.json"), "utf8"),
        readFile(path.join(statePath, "posture.json"), "utf8")
      ]);
      proposal = JSON.parse(proposalSource);
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const proposalIssues = proposal === null
      ? ["posture proposal is missing or invalid JSON"]
      : validateAuthoringPostureProposal(proposal);
    const expectedCaptureMode = mechanisms.posture_fused_confirmation
      ? "fused-product-decision"
      : "separate-confirmation";
    const expectedQuestionStatus = mechanisms.posture_fused_confirmation
      ? "one-fused-product-question"
      : "one-combined-question";
    const observed = matrixState?.posture_confirmation_completed === true
      && matrixState?.posture_capture_mode === expectedCaptureMode
      && matrixState?.posture_confirmation_turn === 1
      && matrixState?.posture_confirmation_question_status === expectedQuestionStatus
      && matrixState?.posture_proposal_path === "posture-proposal.json"
      && matrixState?.posture_proposal_turn === 1
      && matrixState?.posture_proposal_package_unchanged === true
      && matrixState?.posture_proposal_digest === sha256(proposalSource)
      && matrixState?.accepted_posture_digest === sha256(postureSource)
      && proposalIssues.length === 0;
    check(
      "authoring-posture-confirmation-observed",
      observed,
      {
        completed: matrixState?.posture_confirmation_completed ?? false,
        mode: matrixState?.posture_capture_mode ?? null,
        turn: matrixState?.posture_confirmation_turn ?? null,
        response: matrixState?.posture_confirmation_response ?? null,
        question_status: matrixState?.posture_confirmation_question_status ?? null,
        package_unchanged: matrixState?.posture_proposal_package_unchanged ?? false,
        proposal_issues: proposalIssues
      }
    );
    const proposalMatches = proposal !== null
      && authoringPostureSelectionsMatch(proposal, subject.authoring_posture);
    check(
      "authoring-posture-proposal-accurate",
      proposalMatches
        && matrixState?.posture_proposal_matches_expected === true
        && matrixState?.posture_confirmation_response === "confirmed",
      {
        expected: subject.authoring_posture,
        proposed: proposal,
        controller_match: matrixState?.posture_proposal_matches_expected ?? null,
        response: matrixState?.posture_confirmation_response ?? null
      },
      "process-observation"
    );
    check(
      "authoring-posture-correction-consistent",
      matrixState?.posture_proposal_matches_expected === proposalMatches
        && matrixState?.posture_confirmation_response === (proposalMatches ? "confirmed" : "corrected"),
      {
        proposal_matches: proposalMatches,
        controller_match: matrixState?.posture_proposal_matches_expected ?? null,
        response: matrixState?.posture_confirmation_response ?? null
      }
    );
    if (mechanisms.posture_fused_confirmation) {
      let proxyState = null;
      try {
        proxyState = JSON.parse(
          await readFile(path.join(runDirectory, "control", "proxy-author-state.json"), "utf8")
        );
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      const fusedDecisionId = matrixState?.posture_fused_decision_id ?? null;
      check(
        "authoring-posture-product-decision-fused",
        typeof fusedDecisionId === "string"
          && proxyState?.answered?.some(({ decision_id: decisionId, turn }) => (
            decisionId === fusedDecisionId && turn === 1
          )),
        {
          fused_decision_id: fusedDecisionId,
          answered: proxyState?.answered ?? []
        }
      );
    }
  }
  if (mechanisms.fixed_claim_gate) {
    let matrixState = null;
    try {
      matrixState = JSON.parse(
        await readFile(path.join(runDirectory, "control", "matrix-cell-state.json"), "utf8")
      );
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const claimIssues = await evaluateFixedClaimContract(
      subject.fixed_claim_contract,
      packagePath
    );
    check(
      "fixed-claim-publish-gate-completed",
      matrixState?.fixed_claim_gate_completed === true
        && Number.isInteger(matrixState?.fixed_claim_gate_completion_turn)
        && matrixState.fixed_claim_gate_completion_turn >= 1
        && Number.isInteger(matrixState?.fixed_claim_gate_attempts)
        && matrixState.fixed_claim_gate_attempts >= 0
        && matrixState.fixed_claim_gate_attempts <= 2
        && matrixState?.fixed_claim_gate_repair_required
          === (matrixState.fixed_claim_gate_attempts > 0)
        && matrixState?.fixed_claim_gate_last_digest === sha256("[]")
        && claimIssues.length === 0,
      {
        completed: matrixState?.fixed_claim_gate_completed ?? false,
        completion_turn: matrixState?.fixed_claim_gate_completion_turn ?? null,
        attempts: matrixState?.fixed_claim_gate_attempts ?? null,
        repair_required: matrixState?.fixed_claim_gate_repair_required ?? null,
        first_issues: matrixState?.fixed_claim_gate_first_issues ?? null,
        final_issues: claimIssues
      }
    );
  }
  if (mechanisms.decision_ledger || mechanisms.decision_contract) {
    let ledger = null;
    let proxyState = null;
    try {
      [ledger, proxyState] = await Promise.all([
        readFile(path.join(statePath, "decision-ledger.json"), "utf8").then(JSON.parse),
        readFile(path.join(runDirectory, "control", "proxy-author-state.json"), "utf8").then(JSON.parse)
      ]);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const expectedEntries = (proxyState?.answered ?? []).map(({ decision_id: decisionId }) => {
      const decision = subject.proxy_author.decisions.find(({ id }) => id === decisionId);
      return {
        decision_id: decisionId,
        status: "settled",
        author_answer: decision?.answer
      };
    });
    const actualEntries = (ledger?.entries ?? []).map((entry) => ({
      decision_id: entry.decision_id,
      status: entry.status,
      author_answer: entry.author_answer
    }));
    check(
      "decision-ledger-complete",
      ledger?.authoring_eval_decision_ledger_version === "1"
        && JSON.stringify(actualEntries) === JSON.stringify(expectedEntries),
      { expected: expectedEntries, actual: actualEntries }
    );
    if (mechanisms.decision_contract) {
      const requiredDecisionIds = (subject.proxy_author?.decisions ?? []).map(({ id }) => id).sort();
      const answeredDecisionIds = (proxyState?.answered ?? [])
        .map(({ decision_id: decisionId }) => decisionId)
        .sort();
      check(
        "decision-contract-converged",
        JSON.stringify(answeredDecisionIds) === JSON.stringify(requiredDecisionIds),
        { required: requiredDecisionIds, answered: answeredDecisionIds },
        "outcome"
      );
    }
  }
  if (mechanisms.final_review) {
    let matrixState = null;
    try {
      matrixState = JSON.parse(
        await readFile(path.join(runDirectory, "control", "matrix-cell-state.json"), "utf8")
      );
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    check(
      "final-semantic-review-observed",
      matrixState?.final_review_requested === true && matrixState?.final_review_completed === true,
      {
        requested: matrixState?.final_review_requested ?? false,
        completed: matrixState?.final_review_completed ?? false
      }
    );
  }
  if (mechanisms.conflict_inventory) {
    let matrixState = null;
    let inventorySource = "";
    let inventory = null;
    try {
      [matrixState, inventorySource] = await Promise.all([
        readFile(path.join(runDirectory, "control", "matrix-cell-state.json"), "utf8").then(JSON.parse),
        readFile(path.join(statePath, "conflict-inventory.json"), "utf8")
      ]);
      inventory = JSON.parse(inventorySource);
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const issues = inventory === null
      ? ["conflict inventory is missing or invalid JSON"]
      : validateConflictInventory(inventory);
    check(
      "conflict-inventory-observed",
      matrixState?.conflict_inventory_completed === true
        && matrixState?.conflict_inventory_turn === 1
        && matrixState?.conflict_inventory_package_unchanged === true
        && matrixState?.conflict_inventory_digest === sha256(inventorySource)
        && issues.length === 0,
      {
        completed: matrixState?.conflict_inventory_completed ?? false,
        turn: matrixState?.conflict_inventory_turn ?? null,
        package_unchanged: matrixState?.conflict_inventory_package_unchanged ?? false,
        issues
      }
    );
  }
  const artifact = preeditArtifact(mechanisms);
  if (artifact && artifact.name !== "conflict_inventory") {
    let matrixState = null;
    let artifactSource = "";
    let artifactValue = null;
    try {
      [matrixState, artifactSource] = await Promise.all([
        readFile(path.join(runDirectory, "control", "matrix-cell-state.json"), "utf8").then(JSON.parse),
        readFile(path.join(statePath, artifact.file), "utf8")
      ]);
      artifactValue = JSON.parse(artifactSource);
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const issues = artifactValue === null
      ? [`${artifact.file} is missing or invalid JSON`]
      : artifact.validate(artifactValue);
    check(
      `${artifact.name.replaceAll("_", "-")}-observed`,
      matrixState?.preedit_artifact_completed === true
        && matrixState?.preedit_artifact_name === artifact.name
        && matrixState?.preedit_artifact_path === artifact.file
        && matrixState?.preedit_artifact_turn === 1
        && matrixState?.preedit_artifact_package_unchanged === true
        && matrixState?.preedit_artifact_digest === sha256(artifactSource)
        && issues.length === 0,
      {
        completed: matrixState?.preedit_artifact_completed ?? false,
        name: matrixState?.preedit_artifact_name ?? null,
        turn: matrixState?.preedit_artifact_turn ?? null,
        package_unchanged: matrixState?.preedit_artifact_package_unchanged ?? false,
        issues
      }
    );
  }
} else {
  check(
    "review-complete",
    status.review.complete === subject.expectations.state.review_complete,
    status.review.complete,
    "outcome"
  );

  for (const [field, expected] of Object.entries(subject.expectations.state.questions ?? {})) {
    check(
      `questions-${field}`,
      status.review.questions[field] === expected,
      status.review.questions[field],
      field === "open" ? "outcome" : "process-observation"
    );
  }
  const candidates = status.review.candidates.items ?? [];
  for (const [field, expected] of Object.entries(subject.expectations.state.candidates ?? {})) {
    const actual = field === "open"
      ? status.review.candidates.open
      : countCandidates(candidates, field === "accepted" ? "accept" : field.replace(/d$/u, ""));
    check(
      `candidates-${field}`,
      actual === expected,
      actual,
      field === "open" ? "outcome" : "process-observation"
    );
  }
  const proposals = status.review.proposals.items ?? [];
  const actualProposalPaths = proposals
    .filter(({ status: proposalStatus }) => proposalStatus === "applied")
    .map(({ document }) => document.path);
  const proposalExpectations = subject.expectations.state.proposals ?? {};
  if (proposalExpectations.applied !== undefined) {
    check(
      "proposals-applied",
      status.review.proposals.applied === proposalExpectations.applied,
      status.review.proposals.applied,
      "process-observation"
    );
  }
  if (proposalExpectations.paths !== undefined) {
    check(
      "proposal-paths",
      JSON.stringify(actualProposalPaths) === JSON.stringify(proposalExpectations.paths),
      actualProposalPaths,
      "process-observation"
    );
  }
  const requiredProposalPaths = subject.expectations.state.proposals.required_paths ?? [];
  check(
    "required-proposal-paths",
    requiredProposalPaths.every((requiredPath) => actualProposalPaths.includes(requiredPath)),
    actualProposalPaths,
    "process-observation"
  );
}

if (subject.authoring_eval_subject_version === "2") {
  const initialSnapshot = JSON.parse(
    await readFile(path.join(runDirectory, "control", "manifests", "starter-package.json"), "utf8")
  );
  const currentSnapshot = await snapshotDirectory(packagePath);
  if (simpleWorkflow) {
    check(
      "package-changed-from-starter",
      currentSnapshot.digest !== initialSnapshot.digest,
      { initial: initialSnapshot.digest, current: currentSnapshot.digest },
      "outcome"
    );
  }
  for (const protectedPath of subject.reference.protected_paths) {
    const within = ({ path: candidatePath }) => (
      candidatePath === protectedPath.path || candidatePath.startsWith(`${protectedPath.path}/`)
    );
    const initial = initialSnapshot.files.filter(within);
    const current = currentSnapshot.files.filter(within);
    check(
      `protected:${protectedPath.path}`,
      initial.length > 0 && JSON.stringify(current) === JSON.stringify(initial),
      {
        kind: protectedPath.kind,
        initial,
        current
      },
      "outcome"
    );
  }
}

const gatingChecks = checks.filter(({ category }) => category !== "process-observation");

const report = {
  authoring_eval_report_version: "4",
  run_id: contract.run_id,
  contract_id: contract.contract_id,
  subject: subject.id,
  execution: contract.execution,
  cli: {
    version: contract.cli.version,
    protocol_release: contract.cli.protocol_release,
    source_commit: contract.cli.source_commit,
    source_dirty: contract.cli.source_dirty,
    source_digest: contract.snapshots.cli_source.digest
  },
  package: {
    id: inspection.id,
    version: inspection.version,
    digest: inspection.digest
  },
  passed: gatingChecks.every(({ passed }) => passed),
  observations_matched: checks.every(({ passed }) => passed),
  metrics: {
    questions: status?.review.questions.total ?? null,
    questions_open: status?.review.questions.open ?? null,
    questions_resolved: status?.review.questions.resolved ?? null,
    candidates: status?.review.candidates.total ?? null,
    candidates_open: status?.review.candidates.open ?? null,
    proposals: status?.review.proposals.total ?? null,
    proposals_applied: status?.review.proposals.applied ?? null,
    fresh_session_segments: observedFreshTurns.length,
    posture_proposal_exact_match: postureCapture
      ? checks.find(({ id }) => id === "authoring-posture-proposal-accurate")?.passed ?? false
      : null,
    posture_confirmation_turns: postureCapture ? 1 : 0,
    posture_product_decision_fused: mechanisms.posture_fused_confirmation
      ? checks.find(({ id }) => id === "authoring-posture-product-decision-fused")?.passed ?? false
      : null,
    fixed_claim_gate_repair_required: mechanisms.fixed_claim_gate
      ? checks.find(({ id }) => id === "fixed-claim-publish-gate-completed")?.detail
        ?.repair_required ?? null
      : null,
    fixed_claim_gate_attempts: mechanisms.fixed_claim_gate
      ? checks.find(({ id }) => id === "fixed-claim-publish-gate-completed")?.detail?.attempts ?? null
      : null
  },
  checks
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) {
  const outputPath = path.resolve(options.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
}
process.stdout.write(serialized);
if (!report.passed) process.exitCode = 1;
