import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  contentId,
  snapshotDirectory
} from "./run-contract.mjs";
import {
  isolatedMechanismNames,
  mechanismSelectionSupported
} from "./preedit-artifacts.mjs";

const execFileAsync = promisify(execFile);

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} is required`);
}

export function validateMatrixPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error("Matrix plan must be an object");
  }
  if (plan.authoring_eval_matrix_plan_version !== "1") {
    throw new Error("authoring_eval_matrix_plan_version must be 1");
  }
  if (!["seedspec-authoring", "simple-authoring"].includes(plan.workflow ?? "seedspec-authoring")) {
    throw new Error("Matrix workflow must be seedspec-authoring or simple-authoring");
  }
  const mechanisms = plan.mechanisms ?? {
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
  };
  if (Object.entries(mechanisms).some(([name, enabled]) => (
    !isolatedMechanismNames.includes(name) || typeof enabled !== "boolean"
  ))) {
    throw new Error("Matrix mechanisms must contain boolean mechanism values");
  }
  if ((plan.workflow ?? "seedspec-authoring") !== "simple-authoring"
      && Object.values(mechanisms).some(Boolean)) {
    throw new Error("Matrix mechanisms require simple-authoring");
  }
  if (!mechanismSelectionSupported(mechanisms)) {
    throw new Error("Matrix plans contain an unsupported mechanism combination");
  }
  requireString(plan.plan_id, "plan_id");
  if (!Array.isArray(plan.cells) || plan.cells.length === 0) {
    throw new Error("Matrix plan must contain cells");
  }
  const anthropicCells = plan.cells.filter(({ model }) => model?.provider === "anthropic");
  if (plan.limits?.anthropic_cell_count !== anthropicCells.length) {
    throw new Error("Matrix Anthropic cell count does not match its spend allocation");
  }
  const totalSpend = plan.limits?.anthropic_total_spend_usd;
  const perCellSpend = plan.limits?.anthropic_per_cell_spend_usd;
  const allocatedSpend = plan.limits?.anthropic_allocated_spend_usd;
  if (anthropicCells.length === 0) {
    if (perCellSpend !== null || allocatedSpend !== 0) {
      throw new Error("A matrix without Anthropic cells cannot allocate Anthropic spend");
    }
  } else if (totalSpend === null) {
    if (perCellSpend !== null || allocatedSpend !== 0 || plan.execution_ready) {
      throw new Error("An unbudgeted Anthropic matrix cannot be execution-ready");
    }
  } else if (!(perCellSpend > 0)
      || allocatedSpend !== Number((perCellSpend * anthropicCells.length).toFixed(2))
      || allocatedSpend > totalSpend
      || !plan.execution_ready) {
    throw new Error("Matrix Anthropic spend allocation is invalid");
  }
  const cellIds = new Set();
  const runIds = new Set();
  for (const cell of plan.cells) {
    requireString(cell.cell_id, "cell.cell_id");
    requireString(cell.run_id, "cell.run_id");
    requireString(cell.subject_id, "cell.subject_id");
    requireString(cell.model?.selector, "cell.model.selector");
    requireString(cell.runner?.id, "cell.runner.id");
    requireString(cell.runner?.version, "cell.runner.version");
    requireString(cell.runner?.executable, "cell.runner.executable");
    if (cellIds.has(cell.cell_id)) throw new Error(`Duplicate matrix cell: ${cell.cell_id}`);
    if (runIds.has(cell.run_id)) throw new Error(`Duplicate matrix run: ${cell.run_id}`);
    cellIds.add(cell.cell_id);
    runIds.add(cell.run_id);
  }
  const { plan_id: ignored, ...body } = plan;
  void ignored;
  const expected = contentId("matrix-plan", body);
  if (plan.plan_id !== expected) throw new Error(`Matrix plan identity mismatch; expected ${expected}`);
  return plan;
}

export async function readMatrixPlan(planPath) {
  const source = await readFile(path.resolve(planPath), "utf8");
  return validateMatrixPlan(JSON.parse(source));
}

export async function verifyMatrixPlan(planPath, { requireExecutionReady = false } = {}) {
  const plan = await readMatrixPlan(planPath);
  if (requireExecutionReady && !plan.execution_ready) {
    throw new Error("Matrix plan is not execution-ready; Anthropic cells require a frozen spend ceiling");
  }
  const cliSnapshot = await snapshotDirectory(plan.cli_baseline.source_root, {
    exclude: [".git", ".tmp", "node_modules", "authoring-evals"]
  });
  if (cliSnapshot.digest !== plan.cli_baseline.source_digest) {
    throw new Error("Matrix CLI baseline changed after planning");
  }
  const cliVersion = (
    await execFileAsync(process.execPath, [plan.cli_baseline.executable, "--version"], {
      maxBuffer: 1024 * 1024
    })
  ).stdout.trim();
  if (cliVersion !== plan.cli_baseline.version) {
    throw new Error(`Matrix CLI version changed: expected ${plan.cli_baseline.version}, received ${cliVersion}`);
  }
  for (const subject of plan.corpus.subjects) {
    const snapshot = await snapshotDirectory(subject.path);
    if (snapshot.digest !== subject.digest) {
      throw new Error(`Matrix subject changed after planning: ${subject.id}`);
    }
  }
  const runners = new Map(plan.cells.map((cell) => [cell.runner.executable, cell.runner.version]));
  for (const [executable, version] of runners) {
    const actual = (await execFileAsync(executable, ["--version"], { maxBuffer: 1024 * 1024 })).stdout.trim();
    if (actual !== version) {
      throw new Error(`Matrix runner changed: expected ${version}, received ${actual}`);
    }
  }
  return plan;
}

export function matrixCell(plan, cellId) {
  const cell = plan.cells.find((candidate) => candidate.cell_id === cellId || candidate.run_id === cellId);
  if (cell === undefined) throw new Error(`Matrix cell not found: ${cellId}`);
  return cell;
}
