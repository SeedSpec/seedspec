import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyMatrixPlan } from "./lib/matrix-plan.mjs";
import { semanticGate } from "./lib/semantic-gate.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const cellScript = path.join(scriptRoot, "run-matrix-cell.mjs");
const gradeScript = path.join(scriptRoot, "run-semantic-grade.mjs");
const compareScript = path.join(scriptRoot, "compare-semantic-grades.mjs");

function parseArguments(argv) {
  const options = { cells: [], prepare_only: false, confirm: false };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--prepare-only") options.prepare_only = true;
    else if (name === "--confirm-model-execution") options.confirm = true;
    else if (name === "--cell" && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      options.cells.push(argv[index + 1]);
      index += 1;
    } else if (["--plan", "--runs-root"].includes(name)
      && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      options[name.slice(2).replaceAll("-", "_")] = argv[index + 1];
      index += 1;
    } else {
      throw new Error(
        "Usage: run-matrix.mjs --plan <plan> --runs-root <directory> [--cell <id>] "
        + "[--prepare-only | --confirm-model-execution]"
      );
    }
  }
  if (!options.plan || !options.runs_root) throw new Error("--plan and --runs-root are required");
  if (options.prepare_only && options.confirm) {
    throw new Error("Use either --prepare-only or --confirm-model-execution");
  }
  if (!options.prepare_only && !options.confirm) {
    throw new Error("Matrix execution requires --confirm-model-execution");
  }
  return options;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function runChild(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: "inherit",
      env: process.env
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function progress(event) {
  process.stdout.write(`${JSON.stringify({ authoring_eval_matrix_progress_version: "1", ...event })}\n`);
}

function selectedCells(plan, requested) {
  if (requested.length === 0) return plan.cells;
  const selected = [];
  for (const identifier of [...new Set(requested)]) {
    const cell = plan.cells.find((candidate) => (
      candidate.cell_id === identifier || candidate.run_id === identifier
    ));
    if (cell === undefined) throw new Error(`Matrix cell not found: ${identifier}`);
    selected.push(cell);
  }
  return selected;
}

const options = parseArguments(process.argv.slice(2));
const plan = await verifyMatrixPlan(options.plan, { requireExecutionReady: !options.prepare_only });
if (plan.judge.model !== "gpt-5.6-sol" || plan.judge.policy !== "blinded-reference-ledger") {
  throw new Error("Matrix plan does not freeze the required blinded Sol judge");
}
const cells = selectedCells(plan, options.cells);
const campaignRoot = path.resolve(options.runs_root, plan.plan_id);
await mkdir(campaignRoot, { recursive: true });
const failures = [];
const completed = [];

for (const [index, cell] of cells.entries()) {
  const runDirectory = path.join(campaignRoot, cell.cell_id);
  progress({
    phase: options.prepare_only ? "prepare" : "author",
    state: "started",
    index: index + 1,
    total: cells.length,
    cell_id: cell.cell_id,
    subject_id: cell.subject_id,
    model: cell.model.id
  });
  const cellArgs = [
    "--plan", path.resolve(options.plan),
    "--cell", cell.cell_id,
    "--runs-root", path.resolve(options.runs_root),
    options.prepare_only ? "--prepare-only" : "--confirm-model-execution"
  ];
  const cellExit = await runChild(cellScript, cellArgs);
  if (cellExit !== 0) {
    failures.push({ cell_id: cell.cell_id, phase: "author", exit_code: cellExit });
    progress({ phase: "author", state: "failed", cell_id: cell.cell_id, exit_code: cellExit });
    continue;
  }
  if (options.prepare_only) {
    completed.push({ cell_id: cell.cell_id, status: "prepared" });
    progress({ phase: "prepare", state: "completed", cell_id: cell.cell_id });
    continue;
  }

  const resultPath = path.join(runDirectory, "run-result.json");
  if (!(await exists(resultPath))) {
    failures.push({ cell_id: cell.cell_id, phase: "author", reason: "missing-run-result" });
    progress({ phase: "author", state: "failed", cell_id: cell.cell_id, reason: "missing-run-result" });
    continue;
  }
  const result = JSON.parse(await readFile(resultPath, "utf8"));
  if (result.outcome !== "completed") {
    failures.push({ cell_id: cell.cell_id, phase: "author", reason: result.outcome });
    progress({ phase: "author", state: "failed", cell_id: cell.cell_id, reason: result.outcome });
    continue;
  }

  progress({ phase: "judge", state: "started", cell_id: cell.cell_id, judge: plan.judge.model });
  const gradeRoot = path.join(runDirectory, "semantic-grade", plan.judge.model);
  const gradeExit = await runChild(gradeScript, [
    "--run", runDirectory,
    "--out", gradeRoot,
    "--model", plan.judge.model,
    "--reasoning-effort", plan.judge.reasoning_effort,
    "--max-duration-ms", String(plan.limits.max_duration_ms),
    "--confirm-model-execution"
  ]);
  if (gradeExit !== 0) {
    failures.push({ cell_id: cell.cell_id, phase: "judge", exit_code: gradeExit });
    progress({ phase: "judge", state: "failed", cell_id: cell.cell_id, exit_code: gradeExit });
    continue;
  }
  const grade = JSON.parse(await readFile(path.join(gradeRoot, "grade.json"), "utf8"));
  const gate = semanticGate(grade);
  completed.push({
    cell_id: cell.cell_id,
    status: "graded",
    deterministic_passed: result.evaluation_report?.passed ?? null,
    semantic_passed: gate.passed,
    semantic_gate: gate,
    total_score: grade.summary.total_score,
    grade: path.join(gradeRoot, "grade.json")
  });
  progress({
    phase: "judge",
    state: "completed",
    cell_id: cell.cell_id,
    total_score: grade.summary.total_score,
    semantic_passed: gate.passed
  });
}

const comparisons = [];
if (!options.prepare_only) {
  const comparisonRoot = path.join(campaignRoot, "comparisons");
  await mkdir(comparisonRoot, { recursive: true });
  for (const subject of plan.corpus.subjects) {
    const grades = completed.filter(({ cell_id: cellId, status }) => (
      status === "graded"
      && plan.cells.find(({ cell_id: candidateId }) => candidateId === cellId)?.subject_id === subject.id
    )).map(({ grade }) => grade);
    if (grades.length < 2) continue;
    const output = path.join(comparisonRoot, `${subject.id}.json`);
    if (!(await exists(output))) {
      const args = grades.flatMap((grade) => ["--grade", grade]);
      args.push("--out", output);
      const comparisonExit = await runChild(compareScript, args);
      if (comparisonExit !== 0) {
        failures.push({ subject_id: subject.id, phase: "compare", exit_code: comparisonExit });
        progress({ phase: "compare", state: "failed", subject_id: subject.id, exit_code: comparisonExit });
        continue;
      }
    }
    const comparison = JSON.parse(await readFile(output, "utf8"));
    comparisons.push({
      subject_id: subject.id,
      comparison_id: comparison.comparison_id,
      bounded_equivalence: comparison.bounded_equivalence.claimed,
      output
    });
    progress({
      phase: "compare",
      state: "completed",
      subject_id: subject.id,
      bounded_equivalence: comparison.bounded_equivalence.claimed
    });
  }
}

const summary = {
  authoring_eval_matrix_summary_version: "1",
  plan_id: plan.plan_id,
  mode: options.prepare_only ? "prepare-only" : "execute-and-grade",
  requested_cells: cells.length,
  completed,
  comparisons,
  failures,
  passed: failures.length === 0
};
await writeFile(
  path.join(campaignRoot, options.prepare_only ? "prepare-summary.json" : "campaign-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  { encoding: "utf8", flag: "w" }
);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (!summary.passed) process.exitCode = 1;
