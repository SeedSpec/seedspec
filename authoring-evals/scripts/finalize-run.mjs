import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  contentId,
  readRunContract,
  runPath,
  sha256,
  snapshotDirectory,
  verifyRunContract
} from "./lib/run-contract.mjs";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const evaluateScript = path.join(scriptRoot, "evaluate-run.mjs");

function parseArguments(argv) {
  const options = { limitations: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error("Every finalize-run option requires a value");
    }
    if (name === "--limitation") options.limitations.push(value);
    else options[name.slice(2)] = value;
    index += 1;
  }
  for (const required of ["run", "status", "exit-code"]) {
    if (options[required] === undefined) throw new Error(`--${required} is required`);
  }
  if (!["succeeded", "failed", "timed-out", "cancelled"].includes(options.status)) {
    throw new Error("--status must be succeeded, failed, timed-out, or cancelled");
  }
  const exitCode = Number(options["exit-code"]);
  if (!Number.isInteger(exitCode)) throw new Error("--exit-code must be an integer");
  return { ...options, exitCode };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function captureFile(runDirectory, sourcePath, destinationName) {
  if (!sourcePath) return null;
  const source = path.resolve(sourcePath);
  const destinationRelative = `evidence/${destinationName}`;
  const destination = runPath(runDirectory, destinationRelative, "evidence destination");
  const content = await readFile(source);
  await writeFile(destination, content, { flag: "wx" });
  return {
    path: destinationRelative,
    digest: sha256(content),
    bytes: content.byteLength
  };
}

function usageProblems(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return ["Usage evidence must be a JSON object."];
  }
  if (!["provider-reported", "runner-reported", "unavailable"].includes(usage.capture)) {
    return ["Usage capture must be provider-reported, runner-reported, or unavailable."];
  }
  const problems = [];
  for (const [key, value] of Object.entries(usage)) {
    if (key === "capture") continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      problems.push(`Usage field ${key} must be a nonnegative number.`);
    }
  }
  return problems;
}

function budgetProblems(contract, usage, startedAt, finishedAt) {
  const problems = [];
  const duration = Date.parse(finishedAt) - Date.parse(startedAt);
  if (!Number.isFinite(duration) || duration < 0) {
    problems.push("Run timestamps do not define a valid duration.");
  } else if (duration > contract.budget.max_duration_ms) {
    problems.push("Run exceeded budget.max_duration_ms.");
  }
  const comparisons = [
    ["input_tokens", contract.budget.max_input_tokens],
    ["output_tokens", contract.budget.max_output_tokens],
    ["cost_usd", contract.budget.max_spend_usd]
  ];
  for (const [field, limit] of comparisons) {
    if (limit !== null && typeof usage?.[field] === "number" && usage[field] > limit) {
      problems.push(`Run exceeded budget limit for ${field}.`);
    }
  }
  if (typeof usage?.turns === "number" && usage.turns > contract.budget.max_turns) {
    problems.push("Run exceeded budget.max_turns.");
  }
  return problems;
}

async function writeFinalSnapshot(runDirectory, name, root) {
  const snapshot = await snapshotDirectory(root);
  const relativePath = `evidence/${name}-manifest.json`;
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(runPath(runDirectory, relativePath), content, { encoding: "utf8", flag: "wx" });
  return {
    algorithm: snapshot.algorithm,
    digest: snapshot.digest,
    files: snapshot.file_count,
    bytes: snapshot.bytes,
    manifest: {
      path: relativePath,
      digest: sha256(content),
      bytes: Buffer.byteLength(content, "utf8")
    }
  };
}

const options = parseArguments(process.argv.slice(2));
const runDirectory = path.resolve(options.run);
const statePath = path.join(runDirectory, "run-state.json");
const reasons = [];
let contract = null;
let state = null;
try {
  state = await readJson(statePath);
} catch (error) {
  reasons.push(`Run state unavailable: ${error.message}`);
}
try {
  contract = await verifyRunContract(runDirectory);
} catch (error) {
  reasons.push(`Frozen contract integrity failed: ${error.message}`);
  try {
    contract = await readRunContract(runDirectory);
  } catch {
    // A quarantine record can still preserve supplied evidence without trusting
    // an invalid contract body.
  }
}

const evidence = {};
for (const [option, destination] of [
  ["transcript", "transcript.jsonl"],
  ["commands", "command-trace.jsonl"],
  ["usage", "usage.json"],
  ["final-message", "final-message.md"]
]) {
  try {
    evidence[option.replace("-", "_")] = await captureFile(
      runDirectory,
      options[option],
      destination
    );
  } catch (error) {
    reasons.push(`Could not retain ${option} evidence: ${error.message}`);
    evidence[option.replace("-", "_")] = null;
  }
}

let usage = null;
if (evidence.usage) {
  try {
    usage = await readJson(runPath(runDirectory, evidence.usage.path));
    reasons.push(...usageProblems(usage));
  } catch (error) {
    reasons.push(`Usage evidence is invalid JSON: ${error.message}`);
  }
}
for (const required of ["transcript", "commands", "usage"]) {
  if (!evidence[required]) reasons.push(`Required ${required} evidence is missing.`);
}
if (state && contract && state.contract_id !== contract.contract_id) {
  reasons.push("Run state does not match the frozen contract.");
}
if (state?.status !== "running") {
  reasons.push(`Run was finalized from ${state?.status ?? "unknown"} instead of running.`);
}
if (options.status !== "succeeded") {
  reasons.push(`Runner ended with status ${options.status}.`);
}
if (options.status === "succeeded" && options.exitCode !== 0) {
  reasons.push("A succeeded runner status requires exit code zero.");
}

const finishedAt = new Date().toISOString();
const startedAt = state?.started_at ?? state?.prepared_at ?? finishedAt;
if (contract) reasons.push(...budgetProblems(contract, usage, startedAt, finishedAt));
const finalSnapshots = { package: null, authoring_state: null };
if (contract) {
  try {
    finalSnapshots.package = await writeFinalSnapshot(
      runDirectory,
      "final-package",
      runPath(runDirectory, contract.workspace.package, "workspace.package")
    );
  } catch (error) {
    reasons.push(`Final package could not be retained: ${error.message}`);
  }
  try {
    finalSnapshots.authoring_state = await writeFinalSnapshot(
      runDirectory,
      "final-authoring-state",
      runPath(runDirectory, contract.workspace.state, "workspace.state")
    );
  } catch (error) {
    reasons.push(`Final authoring state could not be retained: ${error.message}`);
  }
}

let evaluationReport = null;
if (contract && reasons.length === 0) {
  const outputPath = path.join(runDirectory, "evidence", "evaluation-report.json");
  try {
    await execFileAsync(process.execPath, [evaluateScript, "--run", runDirectory, "--output", outputPath], {
      maxBuffer: 20 * 1024 * 1024
    });
    const content = await readFile(outputPath);
    const parsed = JSON.parse(content);
    evaluationReport = {
      path: "evidence/evaluation-report.json",
      digest: sha256(content),
      bytes: content.byteLength,
      passed: parsed.passed
    };
  } catch (error) {
    let retainedReport = false;
    try {
      const content = await readFile(outputPath);
      const parsed = JSON.parse(content);
      evaluationReport = {
        path: "evidence/evaluation-report.json",
        digest: sha256(content),
        bytes: content.byteLength,
        passed: parsed.passed
      };
      retainedReport = typeof parsed.passed === "boolean";
    } catch {
      // The error below preserves the evaluator failure without inventing a report.
    }
    if (!retainedReport) reasons.push(`Deterministic evaluation produced no valid report: ${error.message}`);
  }
}

const uniqueReasons = [...new Set(reasons)];
const resultBody = {
  authoring_eval_run_result_version: "1",
  contract_id: contract?.contract_id ?? state?.contract_id ?? null,
  run_id: contract?.run_id ?? null,
  execution: {
    requested_status: options.status,
    exit_code: options.exitCode,
    started_at: startedAt,
    finished_at: finishedAt,
    usage
  },
  evidence,
  final_snapshots: finalSnapshots,
  evaluation_report: evaluationReport,
  outcome: uniqueReasons.length === 0 ? "completed" : "quarantined",
  assessment: evaluationReport ? (evaluationReport.passed ? "passed" : "failed") : "not-run",
  limitations: [...options.limitations],
  quarantine_reasons: uniqueReasons
};
const result = {
  ...resultBody,
  run_result_id: contentId("run-result", resultBody)
};
await writeFile(
  path.join(runDirectory, "run-result.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" }
);

if (result.outcome === "quarantined") {
  const quarantineBody = {
    authoring_eval_quarantine_version: "1",
    contract_id: result.contract_id,
    run_id: result.run_id,
    run_result_id: result.run_result_id,
    created_at: finishedAt,
    reasons: uniqueReasons
  };
  await writeFile(
    path.join(runDirectory, "quarantine.json"),
    `${JSON.stringify({
      ...quarantineBody,
      quarantine_id: contentId("quarantine", quarantineBody)
    }, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );
}

if (state) {
  await writeFile(statePath, `${JSON.stringify({
    ...state,
    status: result.outcome,
    finished_at: finishedAt,
    run_result_id: result.run_result_id
  }, null, 2)}\n`, { encoding: "utf8", flag: "w" });
}

process.stdout.write(`${JSON.stringify({
  run_id: result.run_id,
  contract_id: result.contract_id,
  run_result_id: result.run_result_id,
  outcome: result.outcome,
  assessment: result.assessment,
  evaluation_report: result.evaluation_report,
  quarantine_reasons: result.quarantine_reasons,
  run: runDirectory
}, null, 2)}\n`);
if (result.outcome === "quarantined") process.exitCode = 1;
