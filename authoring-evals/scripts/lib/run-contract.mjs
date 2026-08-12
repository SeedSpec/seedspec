import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  isolatedMechanismNames,
  mechanismSelectionSupported
} from "./preedit-artifacts.mjs";

const execFileAsync = promisify(execFile);

export const SNAPSHOT_ALGORITHM = "seedspec-authoring-eval-tree-sha256-v1";
export const RUN_CONTRACT_VERSION = "2";
export const RUN_STATE_VERSION = "1";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentId(prefix, value) {
  return `${prefix}-${sha256(canonicalJson(value)).slice("sha256:".length)}`;
}

function excluded(relativePath, exclusions) {
  return exclusions.some((candidate) => (
    relativePath === candidate || relativePath.startsWith(`${candidate}/`)
  ));
}

export async function snapshotDirectory(root, { exclude = [] } = {}) {
  const absoluteRoot = path.resolve(root);
  const files = [];

  async function visit(directory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(absoluteRoot, absolutePath).split(path.sep).join("/");
      if (excluded(relativePath, exclude)) continue;
      const information = await lstat(absolutePath);
      if (information.isSymbolicLink()) {
        throw new Error(`Snapshot input contains a symbolic link: ${relativePath}`);
      }
      if (information.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!information.isFile()) {
        throw new Error(`Snapshot input contains a non-file entry: ${relativePath}`);
      }
      const content = await readFile(absolutePath);
      files.push({
        path: relativePath,
        digest: sha256(content),
        bytes: content.byteLength
      });
    }
  }

  await visit(absoluteRoot);
  const bytes = files.reduce((total, file) => total + file.bytes, 0);
  return {
    snapshot_version: "1",
    algorithm: SNAPSHOT_ALGORITHM,
    digest: sha256(canonicalJson(files)),
    files,
    file_count: files.length,
    bytes
  };
}

export function snapshotReference(manifestPath, snapshot, manifestContent, { exclude = [] } = {}) {
  return {
    algorithm: snapshot.algorithm,
    digest: snapshot.digest,
    files: snapshot.file_count,
    bytes: snapshot.bytes,
    exclude,
    manifest: {
      path: manifestPath,
      digest: sha256(manifestContent),
      bytes: Buffer.byteLength(manifestContent, "utf8")
    }
  };
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required`);
  }
}

function requireInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function requireNullableNumber(value, label) {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    throw new Error(`${label} must be null or a nonnegative number`);
  }
}

function validateSnapshotReference(value, label) {
  if (!isRecord(value)) throw new Error(`${label} is required`);
  if (value.algorithm !== SNAPSHOT_ALGORITHM) {
    throw new Error(`${label}.algorithm must be ${SNAPSHOT_ALGORITHM}`);
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(value.digest ?? "")) {
    throw new Error(`${label}.digest must be a SHA-256 digest`);
  }
  if (!Number.isInteger(value.files) || value.files < 0) {
    throw new Error(`${label}.files must be a nonnegative integer`);
  }
  if (!Number.isInteger(value.bytes) || value.bytes < 0) {
    throw new Error(`${label}.bytes must be a nonnegative integer`);
  }
  if (!Array.isArray(value.exclude) || value.exclude.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label}.exclude must be an array of paths`);
  }
  requireString(value.manifest?.path, `${label}.manifest.path`);
  if (!/^sha256:[a-f0-9]{64}$/u.test(value.manifest?.digest ?? "")) {
    throw new Error(`${label}.manifest.digest must be a SHA-256 digest`);
  }
}

function validateFileReference(value, label) {
  if (!isRecord(value)) throw new Error(`${label} is required`);
  requireString(value.path, `${label}.path`);
  if (!/^sha256:[a-f0-9]{64}$/u.test(value.digest ?? "")) {
    throw new Error(`${label}.digest must be a SHA-256 digest`);
  }
  if (!Number.isInteger(value.bytes) || value.bytes < 0) {
    throw new Error(`${label}.bytes must be a nonnegative integer`);
  }
}

function safeRunPath(runDirectory, relativePath, label) {
  requireString(relativePath, label);
  if (path.isAbsolute(relativePath)) throw new Error(`${label} must be relative`);
  const resolved = path.resolve(runDirectory, relativePath);
  const relative = path.relative(path.resolve(runDirectory), resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes the run directory`);
  }
  return resolved;
}

export function validateRunContract(contract) {
  if (!isRecord(contract)) throw new Error("run contract must be an object");
  if (contract.authoring_eval_run_contract_version !== RUN_CONTRACT_VERSION) {
    throw new Error(`authoring_eval_run_contract_version must be ${RUN_CONTRACT_VERSION}`);
  }
  requireString(contract.run_id, "run_id");
  requireString(contract.contract_id, "contract_id");
  requireString(contract.created_at, "created_at");
  if (Number.isNaN(Date.parse(contract.created_at))) throw new Error("created_at must be an ISO timestamp");
  requireString(contract.subject?.id, "subject.id");
  if (!["1", "2"].includes(contract.subject?.format_version)) {
    throw new Error("subject.format_version must be 1 or 2");
  }
  requireString(contract.authoring?.mode, "authoring.mode");
  if (!["minimal", "shape", "deep"].includes(contract.authoring.mode)) {
    throw new Error("authoring.mode must be minimal, shape, or deep");
  }
  requireString(contract.authoring?.prompt, "authoring.prompt");
  validateFileReference(contract.authoring?.handoff, "authoring.handoff");
  if (!["seedspec-authoring", "simple-authoring"].includes(
    contract.execution?.workflow ?? "seedspec-authoring"
  )) {
    throw new Error("execution.workflow must be seedspec-authoring or simple-authoring");
  }
  const mechanisms = contract.execution?.mechanisms ?? {
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
    throw new Error("execution.mechanisms must contain boolean mechanism values");
  }
  if ((contract.execution?.workflow ?? "seedspec-authoring") !== "simple-authoring"
      && Object.values(mechanisms).some(Boolean)) {
    throw new Error("execution.mechanisms require simple-authoring");
  }
  if (!mechanismSelectionSupported(mechanisms)) {
    throw new Error("execution.mechanisms contains an unsupported combination");
  }
  requireString(contract.execution?.runner?.id, "execution.runner.id");
  requireString(contract.execution?.runner?.version, "execution.runner.version");
  requireString(contract.execution?.model?.provider, "execution.model.provider");
  requireString(contract.execution?.model?.id, "execution.model.id");
  requireString(contract.execution?.model?.selector, "execution.model.selector");
  requireString(contract.execution?.settings?.reasoning_effort, "execution.settings.reasoning_effort");
  if (contract.execution?.continuation?.mode !== "session-lineage") {
    throw new Error("execution.continuation.mode must be session-lineage");
  }
  if (!Array.isArray(contract.execution.continuation.fresh_turns)) {
    throw new Error("execution.continuation.fresh_turns must be an array");
  }
  const freshTurns = contract.execution.continuation.fresh_turns;
  if (freshTurns.some((turn) => !Number.isInteger(turn) || turn < 2)) {
    throw new Error("execution.continuation.fresh_turns must contain integers greater than one");
  }
  if (new Set(freshTurns).size !== freshTurns.length) {
    throw new Error("execution.continuation.fresh_turns must be unique");
  }
  if (freshTurns.some((turn) => turn > contract.budget?.max_turns)) {
    throw new Error("execution.continuation.fresh_turns cannot exceed budget.max_turns");
  }
  if (JSON.stringify(freshTurns) !== JSON.stringify([...freshTurns].sort((left, right) => left - right))) {
    throw new Error("execution.continuation.fresh_turns must be sorted");
  }
  if (!Array.isArray(contract.execution?.tools) || contract.execution.tools.length === 0) {
    throw new Error("execution.tools must not be empty");
  }
  contract.execution.tools.forEach((tool, index) => requireString(tool, `execution.tools[${index}]`));
  if (!["disabled", "enabled", "runner-default"].includes(contract.execution?.network)) {
    throw new Error("execution.network must be disabled, enabled, or runner-default");
  }
  requireString(contract.cli?.version, "cli.version");
  requireString(contract.cli?.protocol_release, "cli.protocol_release");
  requireString(contract.cli?.executable, "cli.executable");
  requireString(contract.cli?.source_root, "cli.source_root");
  for (const field of ["root", "package", "state", "sources"]) {
    requireString(contract.workspace?.[field], `workspace.${field}`);
  }
  requireInteger(contract.budget?.max_duration_ms, "budget.max_duration_ms");
  requireInteger(contract.budget?.max_turns, "budget.max_turns");
  requireNullableNumber(contract.budget?.max_spend_usd, "budget.max_spend_usd");
  requireNullableNumber(contract.budget?.max_input_tokens, "budget.max_input_tokens");
  requireNullableNumber(contract.budget?.max_output_tokens, "budget.max_output_tokens");
  if (contract.budget?.on_limit !== "stop") throw new Error("budget.on_limit must be stop");
  requireString(contract.retention?.class, "retention.class");
  if (!Array.isArray(contract.retention?.retain) || contract.retention.retain.length === 0) {
    throw new Error("retention.retain must not be empty");
  }
  if (contract.retention?.hidden_reasoning !== "exclude") {
    throw new Error("retention.hidden_reasoning must be exclude");
  }
  if (contract.retention?.secrets !== "redact") {
    throw new Error("retention.secrets must be redact");
  }
  if (contract.retention?.failure_evidence !== "retain") {
    throw new Error("retention.failure_evidence must be retain");
  }
  for (const [label, reference] of Object.entries(contract.snapshots ?? {})) {
    validateSnapshotReference(reference, `snapshots.${label}`);
  }
  for (const required of ["subject", "cli_source", "starter_package", "initial_authoring_state"]) {
    if (!contract.snapshots?.[required]) throw new Error(`snapshots.${required} is required`);
  }
  const { contract_id: ignored, ...body } = contract;
  void ignored;
  const expectedId = contentId("run-contract", body);
  if (contract.contract_id !== expectedId) {
    throw new Error(`contract_id does not match the frozen contract; expected ${expectedId}`);
  }
  return contract;
}

export function createRunContract(body) {
  return validateRunContract({
    ...body,
    contract_id: contentId("run-contract", body)
  });
}

export async function readRunContract(runDirectory) {
  const source = await readFile(path.join(path.resolve(runDirectory), "run-contract.json"), "utf8");
  return validateRunContract(JSON.parse(source));
}

async function verifySnapshot(runDirectory, reference, actualRoot) {
  const manifestPath = safeRunPath(runDirectory, reference.manifest.path, "snapshot manifest path");
  const manifestContent = await readFile(manifestPath, "utf8");
  if (sha256(manifestContent) !== reference.manifest.digest) {
    throw new Error(`Snapshot manifest changed: ${reference.manifest.path}`);
  }
  const manifest = JSON.parse(manifestContent);
  if (manifest.algorithm !== reference.algorithm
      || manifest.digest !== reference.digest
      || manifest.file_count !== reference.files
      || manifest.bytes !== reference.bytes) {
    throw new Error(`Snapshot reference does not match its manifest: ${reference.manifest.path}`);
  }
  const current = await snapshotDirectory(actualRoot, { exclude: reference.exclude });
  if (current.digest !== reference.digest) {
    throw new Error(`Snapshot input changed: ${actualRoot}`);
  }
}

async function commandOutput(command, args, options = {}) {
  const { stdout } = await execFileAsync(command, args, {
    ...options,
    maxBuffer: 10 * 1024 * 1024
  });
  return stdout.trim();
}

export async function verifyRunContract(runDirectory, { prepared = false } = {}) {
  const absoluteRun = path.resolve(runDirectory);
  const contract = await readRunContract(absoluteRun);
  const subjectRoot = safeRunPath(absoluteRun, "control/subject", "control subject path");
  const handoffPath = safeRunPath(absoluteRun, contract.authoring.handoff.path, "authoring.handoff.path");
  const handoff = await readFile(handoffPath);
  if (sha256(handoff) !== contract.authoring.handoff.digest
      || handoff.byteLength !== contract.authoring.handoff.bytes) {
    throw new Error("The frozen agent handoff changed");
  }
  await verifySnapshot(absoluteRun, contract.snapshots.subject, subjectRoot);
  await verifySnapshot(absoluteRun, contract.snapshots.cli_source, contract.cli.source_root);
  const cliVersion = await commandOutput(process.execPath, [contract.cli.executable, "--version"]);
  if (cliVersion !== contract.cli.version) {
    throw new Error(`CLI version changed: expected ${contract.cli.version}, received ${cliVersion}`);
  }
  if (prepared) {
    await verifySnapshot(
      absoluteRun,
      contract.snapshots.starter_package,
      safeRunPath(absoluteRun, contract.workspace.package, "workspace.package")
    );
    await verifySnapshot(
      absoluteRun,
      contract.snapshots.initial_authoring_state,
      safeRunPath(absoluteRun, contract.workspace.state, "workspace.state")
    );
  }
  return contract;
}

export async function gitIdentity(repositoryRoot) {
  try {
    const [commit, status] = await Promise.all([
      commandOutput("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot }),
      commandOutput("git", ["status", "--porcelain=v1"], { cwd: repositoryRoot })
    ]);
    return { commit, dirty: status !== "" };
  } catch {
    return { commit: null, dirty: null };
  }
}

export function runPath(runDirectory, relativePath, label = "run path") {
  return safeRunPath(path.resolve(runDirectory), relativePath, label);
}
