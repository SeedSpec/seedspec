import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  contentId,
  gitIdentity,
  snapshotDirectory
} from "./lib/run-contract.mjs";
import {
  isolatedMechanismNames,
  mechanismSelectionSupported
} from "./lib/preedit-artifacts.mjs";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptRoot, "../..");
const defaultCorpusRoot = path.join(repositoryRoot, "authoring-evals", "subjects");
const defaultCli = path.join(repositoryRoot, "packages", "cli", "bin", "seedspec.js");

const MODEL_CATALOG = {
  "claude-sonnet": {
    provider: "anthropic",
    requested: "claude-sonnet",
    selector: "sonnet",
    reasoning_effort: "provider-default",
    tools: ["Bash", "Edit", "Read", "Write"],
    runner: { id: "claude-code-cli", executable: "claude" }
  },
  "claude-opus": {
    provider: "anthropic",
    requested: "claude-opus",
    selector: "opus",
    reasoning_effort: "provider-default",
    tools: ["Bash", "Edit", "Read", "Write"],
    runner: { id: "claude-code-cli", executable: "claude" }
  },
  "codex-terra": {
    provider: "openai",
    requested: "gpt-5.6-terra",
    selector: "gpt-5.6-terra",
    reasoning_effort: "medium",
    tools: ["filesystem", "shell"],
    runner: { id: "codex-cli", executable: "codex" }
  },
  "codex-luna": {
    provider: "openai",
    requested: "gpt-5.6-luna",
    selector: "gpt-5.6-luna",
    reasoning_effort: "medium",
    tools: ["filesystem", "shell"],
    runner: { id: "codex-cli", executable: "codex" }
  }
};

function parseArguments(argv) {
  const options = { subjects: [], models: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error("Every plan-matrix option requires a value");
    }
    if (name === "--subject") options.subjects.push(value);
    else if (name === "--model") options.models.push(value);
    else options[name.slice(2)] = value;
    index += 1;
  }
  if (!options.out) throw new Error("--out is required");
  return options;
}

function positiveInteger(value, fallback, label) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function nullableNumber(value, fallback, label) {
  const selected = value ?? fallback;
  if (selected === undefined || selected === "none") return null;
  const parsed = Number(selected);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be nonnegative or none`);
  return parsed;
}

function booleanOption(value, fallback, label) {
  const selected = value ?? String(fallback);
  if (!["true", "false"].includes(selected)) throw new Error(`${label} must be true or false`);
  return selected === "true";
}

async function commandVersion(executable) {
  const { stdout } = await execFileAsync(executable, ["--version"], { maxBuffer: 1024 * 1024 });
  const version = stdout.trim();
  if (!version) throw new Error(`${executable} returned no version`);
  return version;
}

async function loadSubjects(root, selectedIds) {
  const entries = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const subjects = [];
  for (const entry of entries) {
    const subjectDirectory = path.join(root, entry.name);
    let source;
    try {
      source = await readFile(path.join(subjectDirectory, "subject.yaml"), "utf8");
    } catch {
      continue;
    }
    const subject = parseYaml(source);
    if (subject.authoring_eval_subject_version !== "2") continue;
    if (selectedIds.length > 0 && !selectedIds.includes(subject.id)) continue;
    const snapshot = await snapshotDirectory(subjectDirectory);
    subjects.push({
      id: subject.id,
      role: subject.corpus_role,
      path: subjectDirectory,
      digest: snapshot.digest
    });
  }
  if (subjects.length === 0) throw new Error("No version 2 subjects matched the matrix selection");
  const missing = selectedIds.filter((id) => !subjects.some((subject) => subject.id === id));
  if (missing.length > 0) throw new Error(`Unknown version 2 subjects: ${missing.join(", ")}`);
  return subjects;
}

const options = parseArguments(process.argv.slice(2));
const workflow = options.workflow ?? "seedspec-authoring";
if (!["seedspec-authoring", "simple-authoring"].includes(workflow)) {
  throw new Error("--workflow must be seedspec-authoring or simple-authoring");
}
const mechanisms = {
  decision_ledger: booleanOption(options["decision-ledger"], false, "--decision-ledger"),
  final_review: booleanOption(options["final-review"], false, "--final-review"),
  authoring_posture: booleanOption(options["authoring-posture"], false, "--authoring-posture"),
  posture_confirmation: booleanOption(
    options["posture-confirmation"],
    false,
    "--posture-confirmation"
  ),
  posture_fused_confirmation: booleanOption(
    options["posture-fused-confirmation"],
    false,
    "--posture-fused-confirmation"
  ),
  fixed_claim_gate: booleanOption(
    options["fixed-claim-gate"],
    false,
    "--fixed-claim-gate"
  ),
  conflict_inventory: booleanOption(options["conflict-inventory"], false, "--conflict-inventory"),
  decision_contract: booleanOption(options["decision-contract"], false, "--decision-contract"),
  intent_registry: booleanOption(options["intent-registry"], false, "--intent-registry"),
  semantic_change_plan: booleanOption(
    options["semantic-change-plan"],
    false,
    "--semantic-change-plan"
  ),
  acceptance_contract: booleanOption(options["acceptance-contract"], false, "--acceptance-contract")
};
if (Object.keys(mechanisms).some((name) => !isolatedMechanismNames.includes(name))) {
  throw new Error("Planner mechanism catalog is inconsistent");
}
if (workflow !== "simple-authoring" && Object.values(mechanisms).some(Boolean)) {
  throw new Error("Isolated mechanisms require --workflow simple-authoring");
}
if (!mechanismSelectionSupported(mechanisms)) {
  throw new Error("Enable one isolated mechanism or the fused-posture fixed-claim pair");
}
const corpusRoot = path.resolve(options.root ?? defaultCorpusRoot);
const cliPath = path.resolve(options.cli ?? defaultCli);
const cliSourceRoot = path.resolve(options["cli-source-root"] ?? repositoryRoot);
const repetitions = positiveInteger(options.repetitions, 1, "--repetitions");
const maxDurationMs = positiveInteger(options["max-duration-ms"], 3_600_000, "--max-duration-ms");
const maxTurns = positiveInteger(options["max-turns"], 16, "--max-turns");
const maxSpendUsd = nullableNumber(options["max-spend-usd"], "none", "--max-spend-usd");
const maxInputTokens = nullableNumber(options["max-input-tokens"], "none", "--max-input-tokens");
const maxOutputTokens = nullableNumber(options["max-output-tokens"], 100_000, "--max-output-tokens");
const selectedModels = options.models.length > 0 ? [...new Set(options.models)] : Object.keys(MODEL_CATALOG);
for (const model of selectedModels) {
  if (MODEL_CATALOG[model] === undefined) throw new Error(`Unknown matrix model: ${model}`);
}

const subjects = await loadSubjects(corpusRoot, [...new Set(options.subjects)]);
const anthropicCellCount = subjects.length * repetitions * selectedModels.filter((model) => (
  MODEL_CATALOG[model].provider === "anthropic"
)).length;
const anthropicPerCellSpendUsd = maxSpendUsd === null || anthropicCellCount === 0
  ? null
  : Math.floor((maxSpendUsd * 100) / anthropicCellCount) / 100;
const anthropicAllocatedSpendUsd = anthropicPerCellSpendUsd === null
  ? 0
  : Number((anthropicPerCellSpendUsd * anthropicCellCount).toFixed(2));
const cliVersion = (await execFileAsync(process.execPath, [cliPath, "--version"])).stdout.trim();
if (cliVersion !== "0.3.1") {
  throw new Error(`The reserved baseline requires SeedSpec CLI 0.3.1; received ${cliVersion}`);
}
const protocolRelease = JSON.parse(
  await readFile(path.join(cliSourceRoot, "packages", "protocol", "protocol-release.json"), "utf8")
).release_id;
const cliGit = await gitIdentity(cliSourceRoot);
const cliSnapshot = await snapshotDirectory(cliSourceRoot, {
  exclude: [".git", ".tmp", "node_modules", "authoring-evals"]
});

const runnerVersions = {};
for (const modelId of selectedModels) {
  const executable = MODEL_CATALOG[modelId].runner.executable;
  runnerVersions[executable] ??= await commandVersion(executable);
}

const cliBaseline = {
  label: "released-0.3.1",
  version: cliVersion,
  protocol_release: protocolRelease,
  executable: cliPath,
  source_root: cliSourceRoot,
  source_commit: cliGit.commit,
  source_dirty: cliGit.dirty,
  source_digest: cliSnapshot.digest
};
const cells = [];
for (const subject of subjects) {
  for (const modelId of selectedModels) {
    const catalog = MODEL_CATALOG[modelId];
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const identity = {
        subject_id: subject.id,
        subject_digest: subject.digest,
        model_id: modelId,
        model_selector: catalog.selector,
        runner_id: catalog.runner.id,
        runner_version: runnerVersions[catalog.runner.executable],
        cli_source_digest: cliBaseline.source_digest,
        workflow,
        mechanisms,
        repetition
      };
      const cellId = contentId("matrix-cell", identity);
      cells.push({
        cell_id: cellId,
        run_id: `run-${cellId.slice("matrix-cell-".length)}`,
        subject_id: subject.id,
        subject_digest: subject.digest,
        model: {
          id: modelId,
          provider: catalog.provider,
          requested: catalog.requested,
          selector: catalog.selector,
          reasoning_effort: catalog.reasoning_effort,
          tools: catalog.tools
        },
        runner: {
          id: catalog.runner.id,
          version: runnerVersions[catalog.runner.executable],
          executable: catalog.runner.executable
        },
        repetition
      });
    }
  }
}

const body = {
  authoring_eval_matrix_plan_version: "1",
  created_at: new Date().toISOString(),
  workflow,
  mechanisms,
  corpus: { root: corpusRoot, subjects },
  cli_baseline: cliBaseline,
  regression_lane: {
    baseline_version: "0.3.1",
    candidate: null,
    status: "reserved"
  },
  judge: {
    provider: "openai",
    model: "gpt-5.6-sol",
    selector: "gpt-5.6-sol",
    reasoning_effort: "high",
    policy: "blinded-reference-ledger"
  },
  limits: {
    repetitions,
    max_duration_ms: maxDurationMs,
    max_turns: maxTurns,
    anthropic_total_spend_usd: maxSpendUsd,
    anthropic_cell_count: anthropicCellCount,
    anthropic_per_cell_spend_usd: anthropicPerCellSpendUsd,
    anthropic_allocated_spend_usd: anthropicAllocatedSpendUsd,
    max_input_tokens: maxInputTokens,
    max_output_tokens: maxOutputTokens
  },
  cells,
  execution_ready: anthropicCellCount === 0 || anthropicPerCellSpendUsd > 0
};
const plan = { ...body, plan_id: contentId("matrix-plan", body) };
await writeFile(path.resolve(options.out), `${JSON.stringify(plan, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx"
});
process.stdout.write(`${JSON.stringify({
  plan_id: plan.plan_id,
  subjects: subjects.length,
  models: selectedModels.length,
  workflow,
  mechanisms,
  repetitions,
  cells: cells.length,
  execution_ready: plan.execution_ready,
  blocked_reason: plan.execution_ready ? null : "Anthropic cells require an aggregate --max-spend-usd.",
  output: path.resolve(options.out)
}, null, 2)}\n`);
