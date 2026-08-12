import { spawn } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentId,
  sha256,
  snapshotDirectory
} from "./lib/run-contract.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const evalRoot = path.resolve(scriptRoot, "../implementation-evals");

function parseArguments(argv) {
  const options = {
    model: "gpt-5.6-luna",
    reasoning: "medium",
    timeoutMs: 900000,
    confirm: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--confirm-model-execution") {
      options.confirm = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${name}`);
    if (name === "--manifest") options.manifest = value;
    else if (name === "--runs-root") options.runsRoot = value;
    else if (name === "--model") options.model = value;
    else if (name === "--reasoning") options.reasoning = value;
    else if (name === "--timeout-ms") options.timeoutMs = Number(value);
    else throw new Error(`Unknown argument: ${name}`);
    index += 1;
  }
  if (!options.manifest || !options.runsRoot) {
    throw new Error(
      "Usage: run-implementation-eval.mjs --manifest <json> --runs-root <directory> "
      + "[--model <selector>] [--reasoning <effort>] --confirm-model-execution"
    );
  }
  if (!options.confirm) throw new Error("Model execution requires --confirm-model-execution");
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive integer");
  }
  return options;
}

function execute(executable, args, { cwd, input = "", timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code ?? 1,
        timedOut
      });
    });
    child.stdin.end(input);
  });
}

function validateManifest(manifest) {
  if (manifest?.implementation_candidate_manifest_version !== "1") {
    throw new Error("Unsupported implementation candidate manifest");
  }
  if (!Array.isArray(manifest.candidates) || manifest.candidates.length === 0) {
    throw new Error("Manifest requires at least one candidate");
  }
  for (const [index, candidate] of manifest.candidates.entries()) {
    if (typeof candidate?.label !== "string" || candidate.label.trim() === "") {
      throw new Error(`Candidate ${index + 1} requires a label`);
    }
    if (typeof candidate?.package_path !== "string" || candidate.package_path.trim() === "") {
      throw new Error(`Candidate ${index + 1} requires package_path`);
    }
  }
}

function parseCodexEvents(output) {
  const events = [];
  for (const line of output.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (["thinking", "redacted_thinking", "reasoning"].includes(event.type)) {
        events.push({ type: "reasoning-redacted" });
      } else {
        events.push(event);
      }
    } catch {
      events.push({ type: "unparsed-output", text: line });
    }
  }
  return events;
}

function finalMessage(events) {
  const messages = events.filter((event) => (
    event.type === "item.completed" && event.item?.type === "agent_message"
  ));
  return messages.at(-1)?.item?.text ?? "Unavailable.";
}

function usage(events) {
  return [...events].reverse().find((event) => event.type === "turn.completed")?.usage ?? null;
}

const options = parseArguments(process.argv.slice(2));
const manifestPath = path.resolve(options.manifest);
const runsRoot = path.resolve(options.runsRoot);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
validateManifest(manifest);

const versionResult = await execute("codex", ["--version"]);
if (versionResult.exitCode !== 0) throw new Error("Could not resolve the Codex CLI version");
const codexVersion = versionResult.stdout.trim();
const harnessSnapshot = await snapshotDirectory(evalRoot, { exclude: ["README.md"] });
const candidates = [];
for (const [index, candidate] of manifest.candidates.entries()) {
  const packagePath = path.resolve(candidate.package_path);
  candidates.push({
    condition_id: `condition-${String(index + 1).padStart(2, "0")}`,
    label: candidate.label,
    author_score: candidate.author_score ?? null,
    package_path: packagePath,
    package_snapshot: await snapshotDirectory(packagePath)
  });
}
const planBody = {
  implementation_eval_plan_version: "1",
  model: { selector: options.model, reasoning_effort: options.reasoning },
  runner: { id: "codex-cli", version: codexVersion },
  harness_snapshot: harnessSnapshot,
  candidates
};
const plan = { ...planBody, plan_id: contentId("implementation-plan", planBody) };
const planDirectory = path.join(runsRoot, plan.plan_id);
await mkdir(planDirectory, { recursive: true });
await writeFile(path.join(planDirectory, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`, {
  flag: "wx"
}).catch(async (error) => {
  if (error.code !== "EEXIST") throw error;
  const existing = JSON.parse(await readFile(path.join(planDirectory, "plan.json"), "utf8"));
  if (JSON.stringify(existing) !== JSON.stringify(plan)) throw new Error("Existing plan differs");
});

const prompt = [
  "Act as the fresh implementation agent for this evaluation.",
  "Read TASK.md and every file under spec/, then complete the implementation.",
  "Work only inside this workspace. Run the visible tests before finishing.",
  "Do not stop at a plan or explanation; implement the behavior."
].join("\n");
const results = [];

for (const candidate of candidates) {
  const cellDirectory = path.join(planDirectory, candidate.condition_id);
  const workspace = path.join(cellDirectory, "workspace");
  const resultPath = path.join(cellDirectory, "result.json");
  try {
    const existing = JSON.parse(await readFile(resultPath, "utf8"));
    results.push(existing);
    process.stdout.write(`SKIP ${candidate.condition_id} ${candidate.label}\n`);
    continue;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await mkdir(cellDirectory, { recursive: false });
  await cp(path.join(evalRoot, "scaffold"), workspace, { recursive: true, errorOnExist: true });
  await cp(candidate.package_path, path.join(workspace, "spec"), {
    recursive: true,
    errorOnExist: true
  });
  const copiedSnapshot = await snapshotDirectory(path.join(workspace, "spec"));
  if (copiedSnapshot.digest !== candidate.package_snapshot.digest) {
    throw new Error(`Copied package changed for ${candidate.condition_id}`);
  }
  await writeFile(path.join(cellDirectory, "prompt.txt"), `${prompt}\n`);
  process.stdout.write(`START ${candidate.condition_id} ${candidate.label}\n`);

  const execution = await execute("codex", [
    "exec",
    "--json",
    "--ephemeral",
    "--model", options.model,
    "-c", `model_reasoning_effort=${JSON.stringify(options.reasoning)}`,
    "-c", "sandbox_mode=\"workspace-write\"",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules",
    "--sandbox", "workspace-write",
    "--cd", workspace,
    "-"
  ], { cwd: workspace, input: prompt, timeoutMs: options.timeoutMs });
  const events = parseCodexEvents(execution.stdout);
  await writeFile(
    path.join(cellDirectory, "events.jsonl"),
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n`
  );
  await writeFile(path.join(cellDirectory, "stderr.txt"), execution.stderr);
  await writeFile(path.join(cellDirectory, "final-message.md"), `${finalMessage(events)}\n`);

  const evaluation = await execute(process.execPath, [
    path.join(evalRoot, "hidden/evaluate.mjs"),
    workspace
  ], { cwd: workspace, timeoutMs: 30000 });
  let behavioralResult;
  try {
    behavioralResult = JSON.parse(evaluation.stdout);
  } catch {
    behavioralResult = {
      implementation_eval_version: "1",
      passed: 0,
      total: 10,
      pass_rate: 0,
      harness_error: evaluation.stderr || evaluation.stdout || "Evaluator returned no result"
    };
  }
  await writeFile(
    path.join(cellDirectory, "behavioral-result.json"),
    `${JSON.stringify(behavioralResult, null, 2)}\n`
  );
  const implementationSnapshot = await snapshotDirectory(workspace, { exclude: ["spec"] });
  const resultBody = {
    implementation_eval_result_version: "1",
    plan_id: plan.plan_id,
    condition_id: candidate.condition_id,
    label: candidate.label,
    author_score: candidate.author_score,
    model: plan.model,
    runner_exit_code: execution.exitCode,
    runner_timed_out: execution.timedOut,
    usage: usage(events),
    behavioral_result: behavioralResult,
    implementation_snapshot: implementationSnapshot,
    prompt_digest: sha256(prompt)
  };
  const result = { ...resultBody, result_id: contentId("implementation-result", resultBody) };
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  results.push(result);
  process.stdout.write(
    `DONE ${candidate.condition_id} ${candidate.label} `
    + `${behavioralResult.passed}/${behavioralResult.total}\n`
  );
}

const summaryBody = {
  implementation_eval_summary_version: "1",
  plan_id: plan.plan_id,
  result_ids: results.map((result) => result.result_id),
  results: results.map((result) => ({
    condition_id: result.condition_id,
    label: result.label,
    author_score: result.author_score,
    passed: result.behavioral_result.passed,
    total: result.behavioral_result.total,
    pass_rate: result.behavioral_result.pass_rate,
    runner_exit_code: result.runner_exit_code,
    usage: result.usage
  }))
};
const summary = { ...summaryBody, summary_id: contentId("implementation-summary", summaryBody) };
await writeFile(path.join(planDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

