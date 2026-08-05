import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readRunContract, runPath } from "./lib/run-contract.mjs";

function parseArguments(argv) {
  const options = { runs: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Every compare-runs option requires a value");
    }
    if (name === "--run") options.runs.push(value);
    else if (name === "--output") options.output = value;
    else throw new Error("Usage: compare-runs.mjs --run <directory> --run <directory> [--output <file>]");
    index += 1;
  }
  if (options.runs.length < 2) throw new Error("At least two --run values are required");
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function lineCount(filePath) {
  const content = await readFile(filePath, "utf8");
  return content.split(/\r?\n/u).filter((line) => line.trim()).length;
}

async function runSummary(runInput) {
  const runDirectory = path.resolve(runInput);
  const contract = await readRunContract(runDirectory);
  const result = await readJson(path.join(runDirectory, "run-result.json"));
  if (result.contract_id !== contract.contract_id || result.run_id !== contract.run_id) {
    throw new Error(`Run result does not match its contract: ${runDirectory}`);
  }
  const report = result.evaluation_report
    ? await readJson(runPath(runDirectory, result.evaluation_report.path))
    : null;
  const usage = result.evidence?.usage
    ? await readJson(runPath(runDirectory, result.evidence.usage.path))
    : { capture: "unavailable" };
  const commands = result.evidence?.commands
    ? await lineCount(runPath(runDirectory, result.evidence.commands.path))
    : null;
  return {
    run_id: contract.run_id,
    contract_id: contract.contract_id,
    subject: contract.subject.id,
    subject_digest: contract.snapshots.subject.digest,
    mode: contract.authoring.mode,
    runner: contract.execution.runner,
    model: contract.execution.model,
    cli: {
      version: contract.cli.version,
      source_digest: contract.snapshots.cli_source.digest
    },
    outcome: result.outcome,
    assessment: result.assessment,
    package_digest: report?.package?.digest ?? result.final_snapshots?.package?.digest ?? null,
    metrics: report?.metrics ?? null,
    process_observation_mismatches: report?.checks?.filter((check) => (
      check.category === "process-observation" && !check.passed
    )).map(({ id, detail }) => ({ id, detail })) ?? [],
    commands,
    usage,
    limitations: result.limitations ?? []
  };
}

const options = parseArguments(process.argv.slice(2));
const runs = [];
for (const runInput of options.runs) runs.push(await runSummary(runInput));
const subjects = new Set(runs.map((run) => `${run.subject}\0${run.subject_digest}`));
if (subjects.size !== 1) throw new Error("Compared runs must use the same frozen subject");
const cliSources = new Set(runs.map((run) => run.cli.source_digest));
const modes = new Set(runs.map((run) => run.mode));
const completed = runs.every((run) => run.outcome === "completed");
const comparison = {
  authoring_eval_comparison_version: "1",
  comparison_mode: "descriptive-confounded",
  subject: runs[0].subject,
  identity: {
    subject_matched: true,
    cli_source_matched: cliSources.size === 1,
    authoring_mode_matched: modes.size === 1,
    all_runs_completed: completed
  },
  runs,
  claims: {
    winner: null,
    causal_model_effect: false,
    causal_runner_effect: false
  },
  limitations: [
    "Runner and model change together, so the comparison cannot isolate either factor.",
    "One occurrence per environment does not estimate population behavior.",
    "Process observations describe interaction shape; they do not override outcome checks."
  ]
};
const serialized = `${JSON.stringify(comparison, null, 2)}\n`;
if (options.output) await writeFile(path.resolve(options.output), serialized, { encoding: "utf8", flag: "wx" });
process.stdout.write(serialized);
