import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  authoringPostureHandoff,
  createAuthoringPosture
} from "./lib/authoring-posture.mjs";
import { mechanismSelectionSupported } from "./lib/preedit-artifacts.mjs";
import {
  createRunContract,
  gitIdentity,
  sha256,
  snapshotDirectory,
  snapshotReference,
  verifyRunContract
} from "./lib/run-contract.mjs";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptRoot, "../..");
const defaultCliPath = path.join(repositoryRoot, "packages", "cli", "bin", "seedspec.js");

function parseArguments(argv) {
  const options = { tools: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error("Every prepare-run option requires a value");
    }
    if (name === "--tool") options.tools.push(value);
    else options[name.slice(2)] = value;
    index += 1;
  }
  for (const required of [
    "subject", "out", "runner-id", "runner-version", "model-provider", "model-id",
    "model-selector", "reasoning-effort", "network", "max-duration-ms", "max-turns",
    "retention-class"
  ]) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  if (options.tools.length === 0) throw new Error("At least one --tool is required");
  return options;
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function nullableNumber(value, label) {
  if (value === undefined || value === "none") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be nonnegative or none`);
  return parsed;
}

function booleanOption(value, label) {
  const selected = value ?? "false";
  if (!["true", "false"].includes(selected)) throw new Error(`${label} must be true or false`);
  return selected === "true";
}

async function cli(cliPath, args, { cwd, input } = {}) {
  if (input !== undefined) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cliPath, ...args], {
        cwd,
        stdio: ["pipe", "pipe", "pipe"]
      });
      const stdout = [];
      const stderr = [];
      child.stdout.on("data", (chunk) => stdout.push(chunk));
      child.stderr.on("data", (chunk) => stderr.push(chunk));
      child.on("error", reject);
      child.on("close", (code) => {
        const output = Buffer.concat(stdout).toString("utf8").trim();
        if (code === 0) resolve(output);
        else reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || output));
      });
      child.stdin.end(input);
    });
  }
  const { stdout } = await execFileAsync(process.execPath, [cliPath, ...args], {
    cwd,
    maxBuffer: 10 * 1024 * 1024
  });
  return stdout.trim();
}

async function writeSnapshotManifest(runDirectory, name, root, options = {}) {
  const snapshot = await snapshotDirectory(root, options);
  const manifestPath = `control/manifests/${name}.json`;
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(path.join(runDirectory, manifestPath), content, { encoding: "utf8", flag: "wx" });
  return snapshotReference(manifestPath, snapshot, content, options);
}

async function currentRevision(cliPath, packagePath, workspaceRoot) {
  const status = JSON.parse(await cli(cliPath, ["author", "status", packagePath, "--json"], {
    cwd: workspaceRoot
  }));
  return status.workspace.revision;
}

function exactHandoff({ workspaceRoot, cliPath, modePrompt, authorPrompt }) {
  const exactCommand = `node ${JSON.stringify(cliPath)}`;
  const routedPrompt = modePrompt.replaceAll("npx @seedspec/cli", exactCommand);
  return `# Authoring evaluation handoff

Work only inside ${workspaceRoot}.

Use this exact SeedSpec CLI build for every SeedSpec command:

\`\`\`sh
${exactCommand}
\`\`\`

Do not read parent directories. They contain evaluator-only controls and expected
answers. The visible sources are under \`sources/\`. Ask the author one question
at a time. The evaluation runner supplies the author answers.

## Author's starting request

${authorPrompt}

## Authoring posture

${routedPrompt}
`;
}

function simpleHandoff({ workspaceRoot, cliPath, authorPrompt, mechanisms }) {
  const exactCommand = `node ${JSON.stringify(cliPath)}`;
  const ledgerGuidance = mechanisms.decision_ledger || mechanisms.decision_contract
    ? `\nThe evaluation controller records accepted author answers in
\`authoring/decision-ledger.json\`. Read that ledger at the start of every turn,
especially after a fresh session. Do not edit the ledger. Apply its settled
answers to the package without asking the author again.\n`
    : "";
  const preeditGuidance = Object.entries({
    conflict_inventory: "conflict-inventory.json",
    decision_contract: "decision-contract.json",
    intent_registry: "intent-registry.json",
    semantic_change_plan: "semantic-change-plan.json",
    acceptance_contract: "acceptance-contract.json"
  }).find(([name]) => mechanisms[name])?.[1];
  const analysisGuidance = preeditGuidance
    ? `
Before editing the package, complete the controller's analysis-only turn.
Read the package and every visible source. Write the source-grounded analysis to
\`authoring/${preeditGuidance}\`. Do not edit the package during that turn.
The controller will supply the exact JSON fields and continue the task after the
artifact is frozen.
`
    : "";
  const postureGuidance = mechanisms.authoring_posture ? authoringPostureHandoff() : "";
  const fixedClaimGuidance = mechanisms.fixed_claim_gate
    ? `
Before completion, the controller runs a machine-readable publish gate for
source-backed fixed claims. It returns exact target diagnostics only when a
fixed value is missing or remains broadly configurable.
`
    : "";
  return `# Simple authoring evaluation handoff

Work only inside ${workspaceRoot}.

Edit the package under \`seedspec/\` directly. Read the supplied material under
\`sources/\`. Do not use any \`seedspec author\` command, SeedSpec authoring state,
review pass, candidate, or proposal workflow.
${ledgerGuidance}${analysisGuidance}${postureGuidance}${fixedClaimGuidance}

You can use this exact CLI build to inspect, validate, and lint the package:

\`\`\`sh
${exactCommand}
\`\`\`

Do not read parent directories. They contain evaluator-only controls and
expected answers. Ask the author one consequential question at a time. The
evaluation runner supplies the author answers. Leave implementation choices
open unless the sources or author decide them.

## Author's starting request

${authorPrompt}
`;
}

const options = parseArguments(process.argv.slice(2));
const workflow = options.workflow ?? "seedspec-authoring";
if (!["seedspec-authoring", "simple-authoring"].includes(workflow)) {
  throw new Error("--workflow must be seedspec-authoring or simple-authoring");
}
const mechanisms = {
  decision_ledger: booleanOption(options["decision-ledger"], "--decision-ledger"),
  final_review: booleanOption(options["final-review"], "--final-review"),
  authoring_posture: booleanOption(options["authoring-posture"], "--authoring-posture"),
  posture_confirmation: booleanOption(
    options["posture-confirmation"],
    "--posture-confirmation"
  ),
  posture_fused_confirmation: booleanOption(
    options["posture-fused-confirmation"],
    "--posture-fused-confirmation"
  ),
  fixed_claim_gate: booleanOption(options["fixed-claim-gate"], "--fixed-claim-gate"),
  conflict_inventory: booleanOption(options["conflict-inventory"], "--conflict-inventory"),
  decision_contract: booleanOption(options["decision-contract"], "--decision-contract"),
  intent_registry: booleanOption(options["intent-registry"], "--intent-registry"),
  semantic_change_plan: booleanOption(options["semantic-change-plan"], "--semantic-change-plan"),
  acceptance_contract: booleanOption(options["acceptance-contract"], "--acceptance-contract")
};
if (workflow !== "simple-authoring" && Object.values(mechanisms).some(Boolean)) {
  throw new Error("Isolated mechanisms require --workflow simple-authoring");
}
if (!mechanismSelectionSupported(mechanisms)) {
  throw new Error("Enable one isolated mechanism or the fused-posture fixed-claim pair");
}
const subjectDirectory = path.resolve(options.subject);
const runDirectory = path.resolve(options.out);
const cliPath = path.resolve(options.cli ?? defaultCliPath);
const cliSourceRoot = path.resolve(options["cli-source-root"] ?? repositoryRoot);
const workspaceRoot = path.join(runDirectory, "workspace");
const packagePath = path.join(workspaceRoot, "seedspec");
const statePath = path.join(workspaceRoot, "authoring");
const sourceSubject = parseYaml(await readFile(path.join(subjectDirectory, "subject.yaml"), "utf8"));
if (mechanisms.fixed_claim_gate
    && (!Array.isArray(sourceSubject.fixed_claim_contract)
      || sourceSubject.fixed_claim_contract.length === 0)) {
  throw new Error("--fixed-claim-gate requires subject.fixed_claim_contract");
}
const posture = mechanisms.authoring_posture
  ? createAuthoringPosture(sourceSubject.authoring_posture)
  : null;

await mkdir(runDirectory);
await Promise.all([
  mkdir(path.join(runDirectory, "control", "manifests"), { recursive: true }),
  mkdir(path.join(runDirectory, "evidence"), { recursive: true }),
  mkdir(workspaceRoot, { recursive: true })
]);
await cp(subjectDirectory, path.join(runDirectory, "control", "subject"), {
  recursive: true,
  errorOnExist: true
});
await cp(path.join(subjectDirectory, sourceSubject.starter.package), packagePath, {
  recursive: true,
  errorOnExist: true
});
for (const source of sourceSubject.starter.sources) {
  const sourcePath = path.resolve(subjectDirectory, source.path);
  const targetPath = path.resolve(workspaceRoot, source.path);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { errorOnExist: true });
}

let handoff;
if (workflow === "seedspec-authoring") {
  await cli(cliPath, ["author", "create", packagePath, "--json"], { cwd: workspaceRoot });
  for (const source of sourceSubject.starter.sources) {
    const payload = {
      expected_revision: await currentRevision(cliPath, packagePath, workspaceRoot),
      id: source.id,
      kind: "document",
      authority: source.authority,
      location: source.path,
      summary: `Frozen evaluation source: ${source.id}`
    };
    await cli(cliPath, ["author", "attach-source", packagePath, "--json", "-"], {
      cwd: workspaceRoot,
      input: JSON.stringify(payload)
    });
  }

  const modeFlag = sourceSubject.mode === "deep"
    ? "--deep"
    : sourceSubject.mode === "minimal" ? "--minimal" : null;
  const modePrompt = await cli(
    cliPath,
    ["author", "prompt", ...(modeFlag ? [modeFlag] : [])],
    { cwd: workspaceRoot }
  );
  handoff = exactHandoff({
    workspaceRoot,
    cliPath,
    modePrompt,
    authorPrompt: sourceSubject.author_prompt
  });
} else {
  await mkdir(statePath, { recursive: true });
  if (mechanisms.decision_ledger || mechanisms.decision_contract) {
    await writeFile(
      path.join(statePath, "decision-ledger.json"),
      `${JSON.stringify({ authoring_eval_decision_ledger_version: "1", entries: [] }, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" }
    );
  }
  if (posture) {
    await writeFile(
      path.join(statePath, "posture.json"),
      `${JSON.stringify(posture, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" }
    );
  }
  handoff = simpleHandoff({
    workspaceRoot,
    cliPath,
    authorPrompt: sourceSubject.author_prompt,
    mechanisms
  });
}
const handoffPath = path.join(workspaceRoot, "HANDOFF.md");
await writeFile(handoffPath, handoff, { encoding: "utf8", flag: "wx" });

const cliVersion = await cli(cliPath, ["--version"]);
const protocolRelease = JSON.parse(
  await readFile(path.join(cliSourceRoot, "packages", "protocol", "protocol-release.json"), "utf8")
).release_id;
const sourceIdentity = await gitIdentity(cliSourceRoot);
const snapshots = {
  subject: await writeSnapshotManifest(runDirectory, "subject", path.join(runDirectory, "control", "subject")),
  cli_source: await writeSnapshotManifest(runDirectory, "cli-source", cliSourceRoot, {
    exclude: [".git", ".tmp", "node_modules", "authoring-evals"]
  }),
  starter_package: await writeSnapshotManifest(runDirectory, "starter-package", packagePath),
  initial_authoring_state: await writeSnapshotManifest(runDirectory, "initial-authoring-state", statePath)
};
const createdAt = new Date().toISOString();
const body = {
  authoring_eval_run_contract_version: "2",
  run_id: options["run-id"] ?? `run-${randomUUID()}`,
  created_at: createdAt,
  subject: {
    id: sourceSubject.id,
    format_version: sourceSubject.authoring_eval_subject_version
  },
  authoring: {
    mode: sourceSubject.mode,
    prompt: sourceSubject.author_prompt,
    handoff: {
      path: "workspace/HANDOFF.md",
      digest: sha256(handoff),
      bytes: Buffer.byteLength(handoff, "utf8")
    }
  },
  execution: {
    workflow,
    mechanisms,
    runner: { id: options["runner-id"], version: options["runner-version"] },
    model: {
      provider: options["model-provider"],
      id: options["model-id"],
      selector: options["model-selector"]
    },
    settings: { reasoning_effort: options["reasoning-effort"] },
    continuation: {
      mode: "session-lineage",
      fresh_turns: [...(sourceSubject.execution?.fresh_agent_turns ?? [])].sort((left, right) => left - right)
    },
    tools: [...new Set(options.tools)].sort(),
    network: options.network
  },
  cli: {
    version: cliVersion,
    protocol_release: protocolRelease,
    executable: cliPath,
    source_root: cliSourceRoot,
    source_commit: sourceIdentity.commit,
    source_dirty: sourceIdentity.dirty
  },
  workspace: {
    root: "workspace",
    package: "workspace/seedspec",
    state: "workspace/authoring",
    sources: "workspace/sources"
  },
  budget: {
    max_duration_ms: positiveInteger(options["max-duration-ms"], "--max-duration-ms"),
    max_turns: positiveInteger(options["max-turns"], "--max-turns"),
    max_spend_usd: nullableNumber(options["max-spend-usd"], "--max-spend-usd"),
    max_input_tokens: nullableNumber(options["max-input-tokens"], "--max-input-tokens"),
    max_output_tokens: nullableNumber(options["max-output-tokens"], "--max-output-tokens"),
    on_limit: "stop"
  },
  retention: {
    class: options["retention-class"],
    retain: [
      "run-contract", "control-subject", "handoff", "transcript", "command-trace",
      "usage", "workspace", "authoring-state", "evaluation-report", "failures"
    ],
    hidden_reasoning: "exclude",
    secrets: "redact",
    failure_evidence: "retain",
    expires_at: options["expires-at"] ?? null
  },
  snapshots
};
const contract = createRunContract(body);
await writeFile(
  path.join(runDirectory, "run-contract.json"),
  `${JSON.stringify(contract, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" }
);
await writeFile(
  path.join(runDirectory, "run-state.json"),
  `${JSON.stringify({
    authoring_eval_run_state_version: "1",
    contract_id: contract.contract_id,
    status: "prepared",
    prepared_at: createdAt,
    started_at: null,
    finished_at: null
  }, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" }
);

await verifyRunContract(runDirectory, { prepared: true });
process.stdout.write(`${JSON.stringify({
  run_id: contract.run_id,
  contract_id: contract.contract_id,
  status: "prepared",
  run: runDirectory,
  workspace: workspaceRoot,
  handoff: handoffPath
}, null, 2)}\n`);
