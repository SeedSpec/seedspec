import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  authoringPostureFusedPrompt,
  authoringPostureHandoff,
  authoringPostureProposalPrompt,
  authoringPostureSelection,
  authoringPostureSelectionsMatch,
  createAuthoringPosture,
  isPostureConfirmationQuestion,
  validateAuthoringPostureProposal,
  validatePostureConfirmationMessage
} from "./lib/authoring-posture.mjs";
import {
  evaluateFixedClaimContract,
  fixedClaimRepairPrompt
} from "./lib/fixed-claim-gate.mjs";
import { matrixCell, verifyMatrixPlan } from "./lib/matrix-plan.mjs";
import { isolatedMechanismNames, preeditArtifact } from "./lib/preedit-artifacts.mjs";
import {
  classifyProxyMessage,
  readFrozenSubject,
  readProxyState,
  recordProxyOutcome
} from "./lib/proxy-author.mjs";
import { readRunContract, sha256, snapshotDirectory } from "./lib/run-contract.mjs";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const prepareScript = path.join(scriptRoot, "prepare-run.mjs");
const startScript = path.join(scriptRoot, "start-run.mjs");
const turnScript = path.join(scriptRoot, "run-agent-turn.mjs");
const collectScript = path.join(scriptRoot, "collect-evidence.mjs");
const finalizeScript = path.join(scriptRoot, "finalize-run.mjs");

function parseArguments(argv) {
  const options = { prepareOnly: false, confirm: false };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--prepare-only") options.prepareOnly = true;
    else if (name === "--confirm-model-execution") options.confirm = true;
    else if (["--plan", "--cell", "--runs-root"].includes(name)
      && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      options[name.slice(2).replaceAll("-", "_")] = argv[index + 1];
      index += 1;
    } else {
      throw new Error(
        "Usage: run-matrix-cell.mjs --plan <plan> --cell <cell-id> --runs-root <directory> "
        + "[--prepare-only | --confirm-model-execution]"
      );
    }
  }
  for (const required of ["plan", "cell", "runs_root"]) {
    if (!options[required]) throw new Error(`--${required.replaceAll("_", "-")} is required`);
  }
  if (!options.prepareOnly && !options.confirm) {
    throw new Error("Model execution requires --confirm-model-execution");
  }
  return options;
}

async function runNode(script, args, { reject = true } = {}) {
  try {
    const result = await execFileAsync(process.execPath, [script, ...args], {
      maxBuffer: 50 * 1024 * 1024
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (reject) throw error;
    return {
      code: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message
    };
  }
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function limitValue(value) {
  return value === null ? "none" : String(value);
}

function isWithin(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === ""
    || (!path.isAbsolute(relative)
      && relative !== ".."
      && !relative.startsWith(`..${path.sep}`));
}

async function prepareCell(plan, cell, runDirectory) {
  const subject = plan.corpus.subjects.find(({ id }) => id === cell.subject_id);
  if (subject === undefined) throw new Error(`Cell subject is absent from the plan corpus: ${cell.subject_id}`);
  await mkdir(path.dirname(runDirectory), { recursive: true });
  const args = [
    "--subject", subject.path,
    "--out", runDirectory,
    "--run-id", cell.run_id,
    "--runner-id", cell.runner.id,
    "--runner-version", cell.runner.version,
    "--model-provider", cell.model.provider,
    "--model-id", cell.model.requested,
    "--model-selector", cell.model.selector,
    "--reasoning-effort", cell.model.reasoning_effort,
    "--network", "disabled",
    "--max-duration-ms", String(plan.limits.max_duration_ms),
    "--max-turns", String(plan.limits.max_turns),
    "--max-spend-usd", limitValue(
      cell.model.provider === "anthropic" ? plan.limits.anthropic_per_cell_spend_usd : null
    ),
    "--max-input-tokens", limitValue(plan.limits.max_input_tokens),
    "--max-output-tokens", limitValue(plan.limits.max_output_tokens),
    "--retention-class", "local-private-controlled-eval",
    "--workflow", plan.workflow ?? "seedspec-authoring",
    "--decision-ledger", String(plan.mechanisms?.decision_ledger ?? false),
    "--final-review", String(plan.mechanisms?.final_review ?? false),
    "--authoring-posture", String(plan.mechanisms?.authoring_posture ?? false),
    "--posture-confirmation", String(plan.mechanisms?.posture_confirmation ?? false),
    "--posture-fused-confirmation", String(
      plan.mechanisms?.posture_fused_confirmation ?? false
    ),
    "--fixed-claim-gate", String(plan.mechanisms?.fixed_claim_gate ?? false),
    "--conflict-inventory", String(plan.mechanisms?.conflict_inventory ?? false),
    "--decision-contract", String(plan.mechanisms?.decision_contract ?? false),
    "--intent-registry", String(plan.mechanisms?.intent_registry ?? false),
    "--semantic-change-plan", String(plan.mechanisms?.semantic_change_plan ?? false),
    "--acceptance-contract", String(plan.mechanisms?.acceptance_contract ?? false),
    "--cli", plan.cli_baseline.executable,
    "--cli-source-root", plan.cli_baseline.source_root
  ];
  for (const tool of cell.model.tools) args.push("--tool", tool);
  const prepared = await runNode(prepareScript, args);
  return JSON.parse(prepared.stdout);
}

async function readJson(target) {
  return JSON.parse(await readFile(target, "utf8"));
}

function runMechanisms(contract) {
  return Object.fromEntries(isolatedMechanismNames.map((name) => [
    name,
    contract.execution.mechanisms?.[name] ?? false
  ]));
}

async function appendDecisionLedger(runDirectory, contract, decision, turn) {
  const target = path.join(runDirectory, contract.workspace.state, "decision-ledger.json");
  const ledger = await readJson(target);
  if (ledger.authoring_eval_decision_ledger_version !== "1" || !Array.isArray(ledger.entries)) {
    throw new Error("Simple decision ledger is malformed");
  }
  if (ledger.entries.some(({ decision_id: decisionId }) => decisionId === decision.id)) return;
  ledger.entries.push({
    decision_id: decision.id,
    status: "settled",
    author_answer: decision.answer,
    recorded_after_turn: turn
  });
  await writeFile(target, `${JSON.stringify(ledger, null, 2)}\n`, {
    encoding: "utf8",
    flag: "w"
  });
}

async function cliJson(executable, args) {
  try {
    const result = await execFileAsync(process.execPath, [executable, ...args], {
      maxBuffer: 10 * 1024 * 1024
    });
    return JSON.parse(result.stdout);
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim()) {
      return JSON.parse(error.stdout);
    }
    throw error;
  }
}

async function authoringReady(contract, runDirectory) {
  const packagePath = path.join(runDirectory, contract.workspace.package);
  const statePath = path.join(runDirectory, contract.workspace.state);
  const status = await cliJson(contract.cli.executable, ["author", "status", packagePath, "--json"]);
  const publish = await cliJson(contract.cli.executable, [
    "publish-check",
    packagePath,
    "--state",
    statePath,
    "--json"
  ]);
  return {
    ready: status.review.complete === true
      && status.review.questions.open === 0
      && status.review.candidates.open === 0
      && publish.ready === true,
    status,
    publish
  };
}

async function simpleReady(contract, runDirectory) {
  const packagePath = path.join(runDirectory, contract.workspace.package);
  const [inspection, lint, initial] = await Promise.all([
    cliJson(contract.cli.executable, ["inspect", packagePath, "--json"]),
    cliJson(contract.cli.executable, ["lint", packagePath, "--json"]),
    readJson(path.join(runDirectory, "control", "manifests", "starter-package.json"))
  ]);
  const current = await snapshotDirectory(packagePath);
  return {
    ready: Boolean(inspection.id)
      && lint.protocol_valid === true
      && (lint.diagnostics ?? []).length === 0
      && current.digest !== initial.digest,
    inspection,
    lint,
    package_changed: current.digest !== initial.digest
  };
}

async function writeMatrixState(runDirectory, state) {
  await writeFile(
    path.join(runDirectory, "control", "matrix-cell-state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
    { encoding: "utf8", flag: "w" }
  );
}

async function writeFrozenJson(target, value) {
  const source = `${JSON.stringify(value, null, 2)}\n`;
  if (await exists(target)) {
    const current = await readFile(target, "utf8");
    if (current !== source) throw new Error(`Frozen controller state changed: ${target}`);
  } else {
    await writeFile(target, source, { encoding: "utf8", flag: "wx" });
  }
  return source;
}

async function readMatrixState(runDirectory, contract) {
  const target = path.join(runDirectory, "control", "matrix-cell-state.json");
  try {
    const state = await readJson(target);
    if (state.contract_id !== contract.contract_id
      || state.authoring_eval_matrix_cell_state_version !== "1") {
      throw new Error("Matrix cell state does not match the frozen run contract");
    }
    return state;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const mechanisms = runMechanisms(contract);
    const artifact = preeditArtifact(mechanisms);
    return {
      authoring_eval_matrix_cell_state_version: "1",
      contract_id: contract.contract_id,
      pending_prompt: mechanisms.posture_fused_confirmation
        ? authoringPostureFusedPrompt()
        : mechanisms.posture_confirmation
        ? authoringPostureProposalPrompt()
        : artifact
        ? artifact.prompt
        : "Read HANDOFF.md completely and execute the authoring request. Use the exact CLI named there. Ask the author one consequential question at a time when needed.",
      processed_turn: 0,
      continuation_prompts: 0,
      final_review_requested: false,
      final_review_completed: false,
      conflict_inventory_completed: false,
      conflict_inventory_turn: null,
      conflict_inventory_digest: null,
      conflict_inventory_package_unchanged: null,
      preedit_artifact_completed: false,
      preedit_artifact_name: null,
      preedit_artifact_path: null,
      preedit_artifact_turn: null,
      preedit_artifact_digest: null,
      preedit_artifact_package_unchanged: null,
      posture_confirmation_completed: false,
      posture_capture_mode: null,
      posture_confirmation_turn: null,
      posture_confirmation_response: null,
      posture_confirmation_question_status: null,
      posture_proposal_path: null,
      posture_proposal_turn: null,
      posture_proposal_digest: null,
      posture_proposal_package_unchanged: null,
      posture_proposal_matches_expected: null,
      accepted_posture_digest: null,
      posture_fused_decision_id: null,
      fixed_claim_gate_completed: false,
      fixed_claim_gate_completion_turn: null,
      fixed_claim_gate_attempts: 0,
      fixed_claim_gate_repair_required: false,
      fixed_claim_gate_first_issues: null,
      fixed_claim_gate_last_issues: null,
      fixed_claim_gate_last_digest: null
    };
  }
}

async function ensurePrompt(runDirectory, turn, prompt) {
  const promptDirectory = path.join(runDirectory, "runner", "prompts");
  await mkdir(promptDirectory, { recursive: true });
  const target = path.join(promptDirectory, `turn-${String(turn).padStart(2, "0")}.md`);
  if (await exists(target)) {
    const current = await readFile(target, "utf8");
    if (current !== `${prompt}\n`) throw new Error(`Frozen prompt changed for turn ${String(turn)}`);
  } else {
    await writeFile(target, `${prompt}\n`, { encoding: "utf8", flag: "wx" });
  }
  return target;
}

async function collectAndFinalize(runDirectory, runnerId, status, exitCode, limitation) {
  const runState = await readJson(path.join(runDirectory, "run-state.json"));
  const turnCount = runState.turns_completed ?? 0;
  const output = path.join(runDirectory, "control", "captured-evidence");
  if (!(await exists(path.join(output, "usage.json")))) {
    const collectArgs = ["--format", runnerId === "codex-cli" ? "codex" : "claude", "--output", output];
    for (let turn = 1; turn <= turnCount; turn += 1) {
      const prefix = path.join(runDirectory, "runner", `turn-${String(turn).padStart(2, "0")}`);
      collectArgs.push("--event", `${prefix}-events.jsonl`, "--final", `${prefix}-final.txt`);
    }
    await runNode(collectScript, collectArgs);
  }
  const finalizeArgs = [
    "--run", runDirectory,
    "--status", status,
    "--exit-code", String(exitCode),
    "--transcript", path.join(output, "transcript.jsonl"),
    "--commands", path.join(output, "command-trace.jsonl"),
    "--usage", path.join(output, "usage.json"),
    "--final-message", path.join(output, "final-message.md")
  ];
  if (limitation) finalizeArgs.push("--limitation", limitation);
  return runNode(finalizeScript, finalizeArgs, { reject: false });
}

const options = parseArguments(process.argv.slice(2));
const plan = await verifyMatrixPlan(options.plan, { requireExecutionReady: !options.prepareOnly });
const cell = matrixCell(plan, options.cell);
const runDirectory = path.resolve(options.runs_root, plan.plan_id, cell.cell_id);
if (!options.prepareOnly && isWithin(runDirectory, plan.cli_baseline.source_root)) {
  throw new Error(
    "Model execution requires --runs-root outside the frozen CLI source root"
  );
}
if (!(await exists(path.join(runDirectory, "run-contract.json")))) {
  await prepareCell(plan, cell, runDirectory);
}
const contract = await readRunContract(runDirectory);
if (contract.run_id !== cell.run_id) throw new Error("Prepared run identity does not match the matrix cell");
if (options.prepareOnly) {
  process.stdout.write(`${JSON.stringify({
    cell_id: cell.cell_id,
    run_id: cell.run_id,
    status: "prepared",
    run: runDirectory
  }, null, 2)}\n`);
  process.exit(0);
}

let runState = await readJson(path.join(runDirectory, "run-state.json"));
if (["completed", "quarantined"].includes(runState.status)) {
  process.stdout.write(`${JSON.stringify({
    cell_id: cell.cell_id,
    run_id: cell.run_id,
    status: runState.status,
    run: runDirectory,
    reused: true
  }, null, 2)}\n`);
  process.exit(0);
}
if (runState.status === "prepared") {
  await runNode(startScript, ["--run", runDirectory]);
  runState = await readJson(path.join(runDirectory, "run-state.json"));
}
if (runState.status !== "running") throw new Error(`Matrix cell cannot continue from ${runState.status}`);

const subject = await readFrozenSubject(runDirectory);
if (subject.authoring_eval_subject_version !== "2") {
  throw new Error("Matrix cells require a version 2 subject");
}
let proxyState = await readProxyState(runDirectory, contract.contract_id);
let matrixState = await readMatrixState(runDirectory, contract);

while (true) {
  runState = await readJson(path.join(runDirectory, "run-state.json"));
  const turn = (runState.turns_completed ?? 0) + 1;
  if (turn > contract.budget.max_turns) {
    const finalized = await collectAndFinalize(
      runDirectory,
      cell.runner.id,
      "failed",
      1,
      "The subject reached the frozen turn limit before convergence."
    );
    process.stdout.write(finalized.stdout);
    process.exitCode = 1;
    break;
  }
  const promptPath = await ensurePrompt(runDirectory, turn, matrixState.pending_prompt);
  const turnExecution = await runNode(turnScript, [
    "--run", runDirectory,
    "--turn", String(turn),
    "--prompt", promptPath,
    "--executable", cell.runner.executable
  ], { reject: false });
  let turnResult;
  try {
    turnResult = JSON.parse(turnExecution.stdout);
  } catch {
    const finalized = await collectAndFinalize(
      runDirectory,
      cell.runner.id,
      "failed",
      turnExecution.code,
      `Runner turn ${String(turn)} returned no structured capture result.`
    );
    process.stdout.write(finalized.stdout);
    process.exitCode = 1;
    break;
  }
  process.stdout.write(`${JSON.stringify({
    cell_id: cell.cell_id,
    run_id: cell.run_id,
    turn,
    runner_exit_code: turnResult.exit_code,
    timed_out: turnResult.timed_out,
    continuation: turnResult.continuation
  })}\n`);
  if (turnResult.exit_code !== 0 || turnResult.timed_out) {
    const finalized = await collectAndFinalize(
      runDirectory,
      cell.runner.id,
      turnResult.timed_out ? "timed-out" : "failed",
      turnResult.exit_code,
      `Runner turn ${String(turn)} did not complete successfully.`
    );
    process.stdout.write(finalized.stdout);
    process.exitCode = 1;
    break;
  }

  const workflow = contract.execution.workflow ?? "seedspec-authoring";
  const mechanisms = runMechanisms(contract);
  const simpleWorkflow = workflow === "simple-authoring";
  const capturesPosture = mechanisms.posture_confirmation
    || mechanisms.posture_fused_confirmation;
  if (simpleWorkflow && capturesPosture
      && !matrixState.posture_confirmation_completed) {
    const fusedCapture = mechanisms.posture_fused_confirmation;
    const proposalFile = "posture-proposal.json";
    const proposalPath = path.join(runDirectory, contract.workspace.state, proposalFile);
    let proposalSource = "";
    let proposal = null;
    try {
      proposalSource = await readFile(proposalPath, "utf8");
      proposal = JSON.parse(proposalSource);
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const issues = proposal === null
      ? [`authoring/${proposalFile} is missing or invalid JSON`]
      : validateAuthoringPostureProposal(proposal);
    if (proposal !== null) {
      issues.push(...validatePostureConfirmationMessage(turnResult.final_message, proposal));
      if (!fusedCapture && !isPostureConfirmationQuestion(turnResult.final_message)) {
        issues.push("the analysis-only turn did not ask a combined posture confirmation question");
      }
    }
    const preflightClassification = classifyProxyMessage(
      subject,
      turnResult.final_message,
      proxyState
    );
    let fusedDecision = null;
    if (fusedCapture) {
      if (preflightClassification.status === "answer") {
        fusedDecision = preflightClassification.decision;
      } else if (!isPostureConfirmationQuestion(turnResult.final_message)) {
        issues.push("the fused preflight did not ask one recognized product decision");
      }
    }
    const [initial, current] = await Promise.all([
      readJson(path.join(runDirectory, "control", "manifests", "starter-package.json")),
      snapshotDirectory(path.join(runDirectory, contract.workspace.package))
    ]);
    if (current.digest !== initial.digest) {
      issues.push("the package changed during the posture recommendation turn");
    }
    if (issues.length > 0) {
      const finalized = await collectAndFinalize(
        runDirectory,
        cell.runner.id,
        "failed",
        1,
        `Authoring posture confirmation integrity failed: ${issues.join("; ")}`
      );
      process.stdout.write(finalized.stdout);
      process.exitCode = 1;
      break;
    }
    const expectedPosture = subject.authoring_posture;
    const proposedSelection = authoringPostureSelection(proposal);
    const proposalMatches = authoringPostureSelectionsMatch(proposedSelection, expectedPosture);
    const acceptedPosture = createAuthoringPosture(expectedPosture);
    const acceptedSource = await writeFrozenJson(
      path.join(runDirectory, contract.workspace.state, "posture.json"),
      acceptedPosture
    );
    const authorResponse = proposalMatches
      ? "Author confirmation: Yes. Use that posture."
      : `Author correction: Use ambition ${expectedPosture.ambition}, audience ${expectedPosture.audience}, handoff ${expectedPosture.handoff}, and collaboration ${expectedPosture.collaboration}.`;
    let decisionResponse = "";
    if (fusedDecision !== null) {
      proxyState = await recordProxyOutcome(runDirectory, proxyState, {
        kind: "answered",
        turn,
        decision: fusedDecision,
        message: turnResult.final_message
      });
      decisionResponse = `\nAuthor answer (${fusedDecision.id}): ${fusedDecision.answer}\n`;
    }
    matrixState = {
      ...matrixState,
      processed_turn: turn,
      posture_confirmation_completed: true,
      posture_capture_mode: fusedCapture ? "fused-product-decision" : "separate-confirmation",
      posture_confirmation_turn: turn,
      posture_confirmation_response: proposalMatches ? "confirmed" : "corrected",
      posture_confirmation_question_status: fusedCapture
        ? "one-fused-product-question"
        : "one-combined-question",
      posture_proposal_path: proposalFile,
      posture_proposal_turn: turn,
      posture_proposal_digest: sha256(proposalSource),
      posture_proposal_package_unchanged: true,
      posture_proposal_matches_expected: proposalMatches,
      accepted_posture_digest: sha256(acceptedSource),
      posture_fused_decision_id: fusedDecision?.id ?? null,
      pending_prompt: `${authorResponse}${decisionResponse}

The controller wrote the accepted private posture to authoring/posture.json.
The proposal and accepted posture are frozen; do not edit either file.
${authoringPostureHandoff()}
Now execute the author's starting request by editing the package directly. Ask
one consequential product question at a time only when needed. Otherwise finish
the package, then inspect, validate, and lint it with the exact CLI in HANDOFF.md.`
    };
    await writeMatrixState(runDirectory, matrixState);
    continue;
  }
  if (simpleWorkflow && capturesPosture
      && isPostureConfirmationQuestion(turnResult.final_message)) {
    const finalized = await collectAndFinalize(
      runDirectory,
      cell.runner.id,
      "failed",
      1,
      "The agent asked the author to reconfirm the frozen authoring posture."
    );
    process.stdout.write(finalized.stdout);
    process.exitCode = 1;
    break;
  }
  const classification = classifyProxyMessage(subject, turnResult.final_message, proxyState);
  const readiness = simpleWorkflow
    ? await simpleReady(contract, runDirectory)
    : await authoringReady(contract, runDirectory);
  if (simpleWorkflow && mechanisms.fixed_claim_gate && readiness.ready) {
    const claimIssues = await evaluateFixedClaimContract(
      subject.fixed_claim_contract,
      path.join(runDirectory, contract.workspace.package)
    );
    if (claimIssues.length > 0) {
      const nextAttempt = matrixState.fixed_claim_gate_attempts + 1;
      if (nextAttempt > 2) {
        const finalized = await collectAndFinalize(
          runDirectory,
          cell.runner.id,
          "failed",
          1,
          "The fixed-claim publish gate still failed after two targeted repair turns."
        );
        process.stdout.write(finalized.stdout);
        process.exitCode = 1;
        break;
      }
      matrixState = {
        ...matrixState,
        processed_turn: turn,
        fixed_claim_gate_attempts: nextAttempt,
        fixed_claim_gate_repair_required: true,
        fixed_claim_gate_first_issues: matrixState.fixed_claim_gate_first_issues ?? claimIssues,
        fixed_claim_gate_last_issues: claimIssues,
        fixed_claim_gate_last_digest: sha256(JSON.stringify(claimIssues)),
        pending_prompt: fixedClaimRepairPrompt(claimIssues)
      };
      await writeMatrixState(runDirectory, matrixState);
      continue;
    }
    matrixState = {
      ...matrixState,
      fixed_claim_gate_completed: true,
      fixed_claim_gate_completion_turn: turn,
      fixed_claim_gate_last_issues: [],
      fixed_claim_gate_last_digest: sha256("[]")
    };
    await writeMatrixState(runDirectory, matrixState);
  }
  const artifact = simpleWorkflow ? preeditArtifact(mechanisms) : null;
  if (artifact && !matrixState.preedit_artifact_completed
      && !matrixState.conflict_inventory_completed) {
    const artifactPath = path.join(
      runDirectory,
      contract.workspace.state,
      artifact.file
    );
    let artifactSource = "";
    let artifactValue = null;
    try {
      artifactSource = await readFile(artifactPath, "utf8");
      artifactValue = JSON.parse(artifactSource);
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    const issues = artifactValue === null
      ? [`authoring/${artifact.file} is missing or invalid JSON`]
      : artifact.validate(artifactValue);
    const [initial, current] = await Promise.all([
      readJson(path.join(runDirectory, "control", "manifests", "starter-package.json")),
      snapshotDirectory(path.join(runDirectory, contract.workspace.package))
    ]);
    if (classification.status !== "no-question") {
      issues.push("the analysis-only turn asked an author question");
    }
    if (current.digest !== initial.digest) {
      issues.push("the package changed during the inventory turn");
    }
    if (issues.length > 0) {
      const finalized = await collectAndFinalize(
        runDirectory,
        cell.runner.id,
        "failed",
        1,
        `${artifact.name} mechanism integrity failed: ${issues.join("; ")}`
      );
      process.stdout.write(finalized.stdout);
      process.exitCode = 1;
      break;
    }
    matrixState = {
      ...matrixState,
      processed_turn: turn,
      preedit_artifact_completed: true,
      preedit_artifact_name: artifact.name,
      preedit_artifact_path: artifact.file,
      preedit_artifact_turn: turn,
      preedit_artifact_digest: sha256(artifactSource),
      preedit_artifact_package_unchanged: true,
      conflict_inventory_completed: artifact.name === "conflict_inventory",
      conflict_inventory_turn: artifact.name === "conflict_inventory" ? turn : null,
      conflict_inventory_digest: artifact.name === "conflict_inventory"
        ? sha256(artifactSource)
        : null,
      conflict_inventory_package_unchanged: artifact.name === "conflict_inventory" ? true : null,
      pending_prompt: artifact.next
    };
    await writeMatrixState(runDirectory, matrixState);
    continue;
  }
  if (readiness.ready && (!simpleWorkflow || classification.status === "no-question")) {
    const requiredTurn = Math.max(1, ...contract.execution.continuation.fresh_turns);
    if (turn < requiredTurn) {
      matrixState = {
        ...matrixState,
        processed_turn: turn,
        pending_prompt: simpleWorkflow
          ? mechanisms.decision_ledger || mechanisms.decision_contract
            ? "The package is currently valid. Preserve its settled meaning. Continue to the frozen recovery turn. In the fresh session, read authoring/decision-ledger.json, the package, and visible sources before confirming completion."
            : "The package is currently valid. Preserve its settled meaning. Continue to the frozen recovery turn, then inspect the package and visible sources before confirming completion."
          : "The package is currently publish-ready. Preserve its settled meaning. Continue to the frozen recovery turn, then inspect the durable package and authoring state before confirming completion."
      };
      await writeMatrixState(runDirectory, matrixState);
      continue;
    }
    if (simpleWorkflow && mechanisms.final_review && !matrixState.final_review_requested) {
      matrixState = {
        ...matrixState,
        processed_turn: turn,
        final_review_requested: true,
        pending_prompt: "Perform one independent semantic review before completion. Reread every visible source and compare it with the entire package. Check authoritative meaning, controlling constraints, forbidden scope, consequential decisions, and interactions across capabilities. Fix every supported omission or contradiction without narrowing implementation latitude. Then validate and lint again. Ask one consequential author question only if the sources cannot resolve it."
      };
      await writeMatrixState(runDirectory, matrixState);
      continue;
    }
    matrixState = {
      ...matrixState,
      processed_turn: turn,
      final_review_completed: simpleWorkflow && mechanisms.final_review
        ? true
        : matrixState.final_review_completed,
      pending_prompt: null
    };
    await writeMatrixState(runDirectory, matrixState);
    const finalized = await collectAndFinalize(runDirectory, cell.runner.id, "succeeded", 0, null);
    process.stdout.write(finalized.stdout);
    if (finalized.code !== 0) process.exitCode = 1;
    break;
  }

  let nextPrompt;
  if (classification.status === "answer") {
    proxyState = await recordProxyOutcome(runDirectory, proxyState, {
      kind: "answered",
      turn,
      decision: classification.decision,
      message: turnResult.final_message
    });
    if (simpleWorkflow && (mechanisms.decision_ledger || mechanisms.decision_contract)) {
      await appendDecisionLedger(runDirectory, contract, classification.decision, turn);
    }
    nextPrompt = simpleWorkflow
      ? mechanisms.decision_ledger || mechanisms.decision_contract
        ? `Author answer (${classification.decision.id}): ${classification.decision.answer}\n\nThe controller recorded this answer in authoring/decision-ledger.json. Read the ledger, apply the answer directly to the package, and continue. Do not use SeedSpec author commands or ask the author to reconfirm settled meaning.`
        : `Author answer (${classification.decision.id}): ${classification.decision.answer}\n\nApply this answer directly to the package, then continue. Do not use SeedSpec author commands or ask the author to reconfirm settled meaning.`
      : `Author answer (${classification.decision.id}): ${classification.decision.answer}\n\nRecord this author authority through the SeedSpec workflow, then continue. Do not ask the author to reconfirm settled meaning.`;
  } else if (classification.status === "repeated-question") {
    proxyState = await recordProxyOutcome(runDirectory, proxyState, {
      kind: "repeated",
      turn,
      decision: classification.decision,
      message: turnResult.final_message
    });
    nextPrompt = simpleWorkflow
      ? mechanisms.decision_ledger || mechanisms.decision_contract
        ? `That question was already settled. Read authoring/decision-ledger.json and continue without asking again or using SeedSpec author commands.`
        : `That question was already settled. The recorded author answer was: ${classification.decision.answer}\n\nUse the visible package and sources. Continue without asking again or using SeedSpec author commands.`
      : `That question was already settled. The recorded author answer was: ${classification.decision.answer}\n\nUse the durable authoring state and continue without asking again.`;
  } else if (["ambiguous-question", "ambiguous-repeat"].includes(classification.status)) {
    proxyState = await recordProxyOutcome(runDirectory, proxyState, {
      kind: "unmatched",
      turn,
      classification: classification.status,
      message: turnResult.final_message
    });
    nextPrompt = "The proxy author answers one decision at a time. Ask one consequential question only. Do not combine decisions or assume either answer.";
  } else if (classification.status === "unexpected-question") {
    proxyState = await recordProxyOutcome(runDirectory, proxyState, {
      kind: "unmatched",
      turn,
      classification: classification.status,
      message: turnResult.final_message
    });
    nextPrompt = simpleWorkflow
      ? "The proxy author has no predeclared answer for that question. If it is consequential, preserve it explicitly as unresolved in the package. If it is implementation latitude or a retrievable fact, do not ask the author. Continue toward a valid package without SeedSpec author commands."
      : "The proxy author has no predeclared answer for that question. If it is consequential, preserve it explicitly as unresolved. If it is implementation latitude or a retrievable fact, do not ask the author. Continue toward a publishable baseline.";
  } else {
    matrixState.continuation_prompts += 1;
    if (matrixState.continuation_prompts > 3) {
      const finalized = await collectAndFinalize(
        runDirectory,
        cell.runner.id,
        "failed",
        1,
        "The runner stopped making observable progress before the package became ready."
      );
      process.stdout.write(finalized.stdout);
      process.exitCode = 1;
      break;
    }
    nextPrompt = simpleWorkflow
      ? "Continue from the visible package and sources. Complete the requested package directly without SeedSpec author commands. Ask one consequential author question if needed; otherwise finish validation and lint checks."
      : "Continue from the durable authoring state. Complete the requested package baseline. Ask one consequential author question if needed; otherwise finish review, validation, and publication checks.";
  }
  matrixState = {
    ...matrixState,
    processed_turn: turn,
    pending_prompt: nextPrompt
  };
  await writeMatrixState(runDirectory, matrixState);
}
