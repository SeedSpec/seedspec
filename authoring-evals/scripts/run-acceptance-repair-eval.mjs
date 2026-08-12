import { spawn } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  contentId,
  sha256,
  snapshotDirectory
} from "./lib/run-contract.mjs";

const MANUAL_PROMPT = `Review this package once for publication readiness.

Read every file under seedspec/. Compare the solution obligations with the
acceptance criteria. Repair consequential acceptance omissions you find.

Edit only seedspec/acceptance/criteria.md. Preserve the solution's meaning,
scope, and implementation latitude. Do not add product obligations. Do not
inspect parent directories or look for hidden tests. Finish after one review
and repair pass.`;

const GATED_PROMPT = `The source-backed acceptance coverage gate blocked publication.

Read every file under seedspec/. Repair only these missing critical acceptance
obligations in seedspec/acceptance/criteria.md:

1. [critical:resource-provisioning] Acceptance must require setup to provision
   the required HubSpot property, report, and dashboard plus the daily schedule.
   A setup retry must not duplicate any of those resource kinds.
2. [critical:secret-safe-failure] Acceptance must require visible, retryable
   delivery failure evidence without credentials, tokens, cookies, private
   keys, customer records, or verbatim provider errors that could contain them.

Prefix each new criterion with its bracketed critical obligation ID so the
gate can verify coverage structurally. Edit no other file. Preserve the
solution's meaning, scope, and implementation latitude. Do not inspect parent
directories or look for hidden tests. Finish after this repair pass.`;

function parseArguments(argv) {
  const options = {
    model: "gpt-5.6-luna",
    reasoning: "medium",
    repetitions: 3,
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
    if (name === "--base") options.base = value;
    else if (name === "--runs-root") options.runsRoot = value;
    else if (name === "--model") options.model = value;
    else if (name === "--reasoning") options.reasoning = value;
    else if (name === "--repetitions") options.repetitions = Number(value);
    else if (name === "--timeout-ms") options.timeoutMs = Number(value);
    else throw new Error(`Unknown argument: ${name}`);
    index += 1;
  }
  if (!options.base || !options.runsRoot) throw new Error("--base and --runs-root are required");
  if (!options.confirm) throw new Error("Model execution requires --confirm-model-execution");
  if (!Number.isInteger(options.repetitions) || options.repetitions <= 0) {
    throw new Error("--repetitions must be a positive integer");
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

function events(output) {
  return output.split(/\r?\n/u).filter(Boolean).map((line) => {
    try {
      const event = JSON.parse(line);
      return ["thinking", "redacted_thinking", "reasoning"].includes(event.type)
        ? { type: "reasoning-redacted" }
        : event;
    } catch {
      return { type: "unparsed-output", text: line };
    }
  });
}

function usage(items) {
  return [...items].reverse().find((event) => event.type === "turn.completed")?.usage ?? null;
}

function gateCoverage(source) {
  const required = [
    "[critical:resource-provisioning]",
    "[critical:secret-safe-failure]"
  ];
  const missing = required.filter((id) => !source.includes(id));
  return { admitted: missing.length === 0, missing_ids: missing };
}

const options = parseArguments(process.argv.slice(2));
const base = path.resolve(options.base);
const runsRoot = path.resolve(options.runsRoot);
const baseSnapshot = await snapshotDirectory(base);
const baseProtectedSnapshot = await snapshotDirectory(base, { exclude: ["acceptance"] });
const version = await execute("codex", ["--version"]);
if (version.exitCode !== 0) throw new Error("Could not resolve Codex version");
const planBody = {
  acceptance_repair_plan_version: "1",
  base_path: base,
  base_snapshot: baseSnapshot,
  protected_snapshot: baseProtectedSnapshot,
  prompts: {
    manual_digest: sha256(MANUAL_PROMPT),
    gated_digest: sha256(GATED_PROMPT)
  },
  repetitions: options.repetitions,
  model: { selector: options.model, reasoning_effort: options.reasoning },
  runner: { id: "codex-cli", version: version.stdout.trim() }
};
const plan = { ...planBody, plan_id: contentId("acceptance-repair-plan", planBody) };
const planDirectory = path.join(runsRoot, plan.plan_id);
await mkdir(planDirectory, { recursive: true });
await writeFile(path.join(planDirectory, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`, {
  flag: "wx"
}).catch(async (error) => {
  if (error.code !== "EEXIST") throw error;
  const existing = JSON.parse(await readFile(path.join(planDirectory, "plan.json"), "utf8"));
  if (JSON.stringify(existing) !== JSON.stringify(plan)) throw new Error("Existing plan differs");
});

const results = [];
for (const pathId of ["manual", "gated"]) {
  const prompt = pathId === "manual" ? MANUAL_PROMPT : GATED_PROMPT;
  for (let repetition = 1; repetition <= options.repetitions; repetition += 1) {
    const conditionId = `${pathId}-r${repetition}`;
    const cellDirectory = path.join(planDirectory, conditionId);
    const workspace = path.join(cellDirectory, "workspace");
    const packagePath = path.join(workspace, "seedspec");
    const resultPath = path.join(cellDirectory, "result.json");
    try {
      const existing = JSON.parse(await readFile(resultPath, "utf8"));
      results.push(existing);
      process.stdout.write(`SKIP ${conditionId}\n`);
      continue;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await mkdir(workspace, { recursive: true });
    await cp(base, packagePath, { recursive: true, errorOnExist: true });
    await writeFile(path.join(cellDirectory, "prompt.txt"), `${prompt}\n`);
    process.stdout.write(`START ${conditionId}\n`);
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
    const capturedEvents = events(execution.stdout);
    await writeFile(
      path.join(cellDirectory, "events.jsonl"),
      `${capturedEvents.map((event) => JSON.stringify(event)).join("\n")}\n`
    );
    await writeFile(path.join(cellDirectory, "stderr.txt"), execution.stderr);
    const protectedSnapshot = await snapshotDirectory(packagePath, { exclude: ["acceptance"] });
    const boundaryPreserved = protectedSnapshot.digest === baseProtectedSnapshot.digest;
    const acceptance = await readFile(path.join(packagePath, "acceptance/criteria.md"), "utf8");
    const coverage = gateCoverage(acceptance);
    const packageSnapshot = await snapshotDirectory(packagePath);
    const resultBody = {
      acceptance_repair_result_version: "1",
      plan_id: plan.plan_id,
      condition_id: conditionId,
      path: pathId,
      repetition,
      runner_exit_code: execution.exitCode,
      runner_timed_out: execution.timedOut,
      usage: usage(capturedEvents),
      protected_boundary_preserved: boundaryPreserved,
      structural_gate: coverage,
      package_snapshot: packageSnapshot,
      package_path: packagePath
    };
    const result = { ...resultBody, result_id: contentId("acceptance-repair-result", resultBody) };
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
    results.push(result);
    process.stdout.write(
      `DONE ${conditionId} boundary=${boundaryPreserved} gate=${coverage.admitted}\n`
    );
  }
}

const candidates = results.map((result) => ({
  label: `${result.path}-repair-r${result.repetition}`,
  author_score: null,
  package_path: result.package_path
}));
const candidateManifest = {
  implementation_candidate_manifest_version: "1",
  candidates
};
const candidateManifestPath = path.join(planDirectory, "implementation-candidates.json");
await writeFile(candidateManifestPath, `${JSON.stringify(candidateManifest, null, 2)}\n`);
const summary = {
  acceptance_repair_summary_version: "1",
  plan_id: plan.plan_id,
  results: results.map((result) => ({
    condition_id: result.condition_id,
    path: result.path,
    repetition: result.repetition,
    boundary_preserved: result.protected_boundary_preserved,
    structural_gate: result.structural_gate,
    usage: result.usage
  })),
  implementation_candidate_manifest: candidateManifestPath
};
await writeFile(path.join(planDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

