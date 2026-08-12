import { spawn } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { evaluateCapabilityStage } from "../../../packages/runtime/src/index.js";
import { adaptImplementationEvidence } from "./adapt-implementation-evidence.mjs";

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(experimentRoot, "../..");
const evalRoot = path.join(repositoryRoot, "authoring-evals/implementation-evals");
const scaffoldPath = path.join(evalRoot, "scaffold");
const evaluatorPath = path.join(evalRoot, "hidden/evaluate.mjs");
const packagePath = path.join(repositoryRoot, "conformance/fixtures/profiled-workflow");
const bundlePath = path.join(experimentRoot, "examples/daily-pipeline/accepted.yaml");

function parseArguments(argv) {
  const options = {
    model: "gpt-5.6-terra",
    reasoning: "medium",
    repetitions: 1,
    maxRepairTurns: 3,
    timeoutMs: 900000,
    runsRoot: path.join(experimentRoot, "runs"),
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
    if (name === "--model") options.model = value;
    else if (name === "--reasoning") options.reasoning = value;
    else if (name === "--repetitions") options.repetitions = Number(value);
    else if (name === "--max-repair-turns") options.maxRepairTurns = Number(value);
    else if (name === "--timeout-ms") options.timeoutMs = Number(value);
    else if (name === "--runs-root") options.runsRoot = path.resolve(value);
    else throw new Error(`Unknown option: ${name}`);
    index += 1;
  }
  for (const [name, value] of [
    ["--repetitions", options.repetitions],
    ["--max-repair-turns", options.maxRepairTurns],
    ["--timeout-ms", options.timeoutMs]
  ]) {
    if (!Number.isInteger(value) || value < (name === "--max-repair-turns" ? 0 : 1)) {
      throw new Error(`${name} has an invalid value`);
    }
  }
  if (!options.confirm) throw new Error("Model execution requires --confirm-model-execution");
  return options;
}

function execute(executable, args, { cwd, input = "", timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
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
        exitCode: code ?? 1,
        timedOut,
        elapsedMs: Math.round(performance.now() - started),
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
    child.stdin.end(input);
  });
}

function parseEvents(output) {
  return output.split(/\r?\n/u).filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { type: "unparsed-output" };
    }
  });
}

function usage(events) {
  return [...events].reverse().find((event) => event.type === "turn.completed")?.usage ?? null;
}

function threadId(events) {
  return events.find((event) => event.type === "thread.started")?.thread_id ?? null;
}

function failedGateSummary(report) {
  return report.checks
    .filter((check) => check.status !== "pass")
    .map((check) => ({
      id: check.id,
      status: check.status,
      message: check.message ?? check.description ?? "Capability check failed"
    }));
}

function totalUsage(turns) {
  const fields = [
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens"
  ];
  return Object.fromEntries(fields.map((field) => [
    field,
    turns.reduce((sum, turn) => sum + (turn.usage?.[field] ?? 0), 0)
  ]));
}

async function evaluate(workspace, cellDirectory, turn, bundle) {
  const behavioralPath = path.join(cellDirectory, `behavioral-result-${turn}.json`);
  const evidencePath = path.join(cellDirectory, `evidence-${turn}.yaml`);
  const execution = await execute(process.execPath, [evaluatorPath, workspace], {
    cwd: workspace,
    timeoutMs: 30000
  });
  if (execution.exitCode !== 0) {
    throw new Error(`Behavioral evaluator failed: ${execution.stderr || execution.stdout}`);
  }
  const behavioral = JSON.parse(execution.stdout);
  await writeFile(behavioralPath, `${JSON.stringify(behavioral, null, 2)}\n`, { flag: "wx" });
  const evidence = adaptImplementationEvidence(bundle, behavioral, {
    resultReference: path.basename(behavioralPath)
  });
  await writeFile(evidencePath, stringifyYaml(evidence), { flag: "wx" });
  const gate = await evaluateCapabilityStage(path.join(workspace, "spec"), [
    path.join(workspace, "CAPABILITY.yaml")
  ], {
    stage: "verification",
    evidencePath
  });
  await writeFile(
    path.join(cellDirectory, `gate-${turn}.json`),
    `${JSON.stringify(gate, null, 2)}\n`,
    { flag: "wx" }
  );
  const snapshotPath = path.join(cellDirectory, "snapshots", `turn-${turn}`);
  await mkdir(snapshotPath, { recursive: true });
  await cp(path.join(workspace, "src"), path.join(snapshotPath, "src"), {
    recursive: true,
    errorOnExist: true
  });
  await cp(path.join(workspace, "test"), path.join(snapshotPath, "test"), {
    recursive: true,
    errorOnExist: true
  });
  return { behavioral, gate };
}

async function runTurn({ workspace, prompt, options, currentThreadId = null }) {
  const common = [
    "--json",
    "--model", options.model,
    "-c", `model_reasoning_effort=${JSON.stringify(options.reasoning)}`,
    "-c", "sandbox_mode=\"workspace-write\"",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules"
  ];
  const args = currentThreadId
    ? ["exec", "resume", ...common, currentThreadId, "-"]
    : ["exec", ...common, "--sandbox", "workspace-write", "--cd", workspace, "-"];
  const execution = await execute("codex", args, {
    cwd: workspace,
    input: prompt,
    timeoutMs: options.timeoutMs
  });
  const events = parseEvents(execution.stdout);
  return {
    exitCode: execution.exitCode,
    timedOut: execution.timedOut,
    elapsedMs: execution.elapsedMs,
    threadId: currentThreadId ?? threadId(events),
    usage: usage(events),
    events,
    stderr: execution.stderr
  };
}

const options = parseArguments(process.argv.slice(2));
const bundle = parseYaml(await readFile(bundlePath, "utf8"));
const version = await execute("codex", ["--version"]);
if (version.exitCode !== 0) throw new Error("Could not read the Codex version");

const campaignId = `campaign-${new Date().toISOString().replace(/[:.]/gu, "-")}`;
const campaignDirectory = path.join(options.runsRoot, campaignId);
await mkdir(campaignDirectory, { recursive: true });
const campaign = {
  capability_enforcement_campaign_version: "0.4-experimental",
  campaign_id: campaignId,
  created_at: new Date().toISOString(),
  model: options.model,
  reasoning: options.reasoning,
  runner: version.stdout.trim(),
  repetitions: options.repetitions,
  max_repair_turns: options.maxRepairTurns,
  initial_prompt_identical: true,
  evaluator_visibility: "controller-only capability statuses",
  package: bundle.package,
  bundle_digest: bundle.bundle_digest,
  conditions: ["instructions-only", "enforced"]
};
await writeFile(
  path.join(campaignDirectory, "campaign.json"),
  `${JSON.stringify(campaign, null, 2)}\n`,
  { flag: "wx" }
);

const initialPrompt = [
  "Act as the implementation agent for this evaluation.",
  "Read TASK.md, every file under spec/, and CAPABILITY.yaml.",
  "Treat the accepted capability outcomes and checks as the completion rubric.",
  "Implement the behavior in src/pipeline-briefing.mjs.",
  "Work only inside this workspace.",
  "Do not inspect parent directories or search for hidden tests.",
  "Run the visible tests before finishing.",
  "Do not stop at a plan or explanation."
].join("\n");
const results = [];

for (let repetition = 1; repetition <= options.repetitions; repetition += 1) {
  const conditions = repetition % 2 === 1
    ? ["instructions-only", "enforced"]
    : ["enforced", "instructions-only"];
  for (const condition of conditions) {
    const cellId = `r${String(repetition).padStart(2, "0")}-${condition}`;
    const cellDirectory = path.join(campaignDirectory, cellId);
    const workspace = path.join(cellDirectory, "workspace");
    await mkdir(cellDirectory, { recursive: false });
    await cp(scaffoldPath, workspace, { recursive: true, errorOnExist: true });
    await cp(packagePath, path.join(workspace, "spec"), {
      recursive: true,
      errorOnExist: true
    });
    await cp(bundlePath, path.join(workspace, "CAPABILITY.yaml"), { errorOnExist: true });
    await writeFile(path.join(cellDirectory, "initial-prompt.txt"), `${initialPrompt}\n`, {
      flag: "wx"
    });
    process.stdout.write(`START ${cellId}\n`);

    const turns = [];
    const initial = await runTurn({ workspace, prompt: initialPrompt, options });
    turns.push(initial);
    await writeFile(
      path.join(cellDirectory, "turn-0-events.jsonl"),
      `${initial.events.map((event) => JSON.stringify(event)).join("\n")}\n`,
      { flag: "wx" }
    );
    await writeFile(path.join(cellDirectory, "turn-0-stderr.txt"), initial.stderr, { flag: "wx" });
    let assessment = await evaluate(workspace, cellDirectory, 0, bundle);
    const firstPass = assessment.behavioral.passed;
    let repairs = 0;

    while (
      condition === "enforced"
      && assessment.gate.status !== "pass"
      && repairs < options.maxRepairTurns
      && initial.threadId
    ) {
      repairs += 1;
      const failures = failedGateSummary(assessment.gate);
      const repairPrompt = [
        "SeedSpec capability enforcement blocked completion.",
        "Repair every failed check below.",
        JSON.stringify(failures, null, 2),
        "Inspect the current implementation, make the repairs, and run visible tests.",
        "Do not claim completion until these checks are addressed."
      ].join("\n\n");
      await writeFile(
        path.join(cellDirectory, `repair-prompt-${repairs}.txt`),
        `${repairPrompt}\n`,
        { flag: "wx" }
      );
      const repair = await runTurn({
        workspace,
        prompt: repairPrompt,
        options,
        currentThreadId: initial.threadId
      });
      turns.push(repair);
      await writeFile(
        path.join(cellDirectory, `turn-${repairs}-events.jsonl`),
        `${repair.events.map((event) => JSON.stringify(event)).join("\n")}\n`,
        { flag: "wx" }
      );
      await writeFile(
        path.join(cellDirectory, `turn-${repairs}-stderr.txt`),
        repair.stderr,
        { flag: "wx" }
      );
      assessment = await evaluate(workspace, cellDirectory, repairs, bundle);
    }

    const result = {
      capability_enforcement_result_version: "0.4-experimental",
      campaign_id: campaignId,
      cell_id: cellId,
      condition,
      repetition,
      first_pass: firstPass,
      final_pass: assessment.behavioral.passed,
      total_checks: assessment.behavioral.total,
      first_full_conformance: firstPass === assessment.behavioral.total,
      final_full_conformance: assessment.behavioral.passed === assessment.behavioral.total,
      repair_turns: repairs,
      gate_status: assessment.gate.status,
      thread_resumable: Boolean(initial.threadId),
      runner_failures: turns.filter((turn) => turn.exitCode !== 0 || turn.timedOut).length,
      elapsed_ms: turns.reduce((sum, turn) => sum + turn.elapsedMs, 0),
      usage: totalUsage(turns),
      turns: turns.map((turn, index) => ({
        turn: index,
        exit_code: turn.exitCode,
        timed_out: turn.timedOut,
        elapsed_ms: turn.elapsedMs,
        usage: turn.usage
      }))
    };
    await writeFile(
      path.join(cellDirectory, "result.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      { flag: "wx" }
    );
    results.push(result);
    process.stdout.write(
      `DONE ${cellId} ${result.first_pass}/${result.total_checks} -> `
      + `${result.final_pass}/${result.total_checks} repairs=${repairs}\n`
    );
  }
}

const summary = {
  capability_enforcement_summary_version: "0.4-experimental",
  campaign_id: campaignId,
  results
};
await writeFile(
  path.join(campaignDirectory, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  { flag: "wx" }
);
process.stdout.write(`${campaignDirectory}\n`);
