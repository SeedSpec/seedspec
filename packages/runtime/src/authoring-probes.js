import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import {
  AUTHORING_CANDIDATE_FORMAT,
  assignAuthoringCandidateId
} from "./authoring/core/candidates.js";
import {
  AUTHORING_PROBE_BRIEF_FORMAT,
  AUTHORING_PROBE_INSTRUCTION_ID,
  AUTHORING_PROBE_INSTRUCTION_VERSION,
  AUTHORING_PROBE_RUN_FORMAT,
  AuthoringProbeInputError,
  clarificationProbeInstructions,
  clarificationProbeResultSchema,
  clarificationProbeTransportSchema,
  validateClarificationProbeResult,
  validateProbePreparationInput
} from "./authoring/core/probes.js";
import { readAuthoringPasses } from "./authoring/passes.js";
import {
  computeWorkspaceRevision,
  inspectAuthoringWorkspace
} from "./authoring-workspace.js";

export const AUTHORING_PROBE_EXECUTION_FORMAT = "1";

const TEXT_EXTENSIONS = new Set([".json", ".md", ".txt", ".yaml", ".yml"]);
const RETAINED_FILES = Object.freeze([
  "probe-brief.json",
  "instructions.md",
  "input.md",
  "result.schema.json",
  "validation.schema.json",
  "probe-execution.json",
  "probe-result.json",
  "raw-response.txt",
  "provider-events.jsonl",
  "provider-output-metadata.json",
  "provider-stderr.log"
]);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function authoringProbeDigest(value) {
  const bytes = typeof value === "string" || Buffer.isBuffer(value)
    ? value
    : stableJson(value);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fail(message, code, details = []) {
  throw new SeedSpecError(message, { code, details });
}

function toSeedSpecError(error) {
  if (error instanceof AuthoringProbeInputError) {
    fail(error.message, error.code, error.details);
  }
  throw error;
}

async function pathInfo(candidate) {
  try {
    return await lstat(candidate);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function isWithin(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      fail(`${label} is missing`, "AUTHORING_PROBE_ARTIFACT_MISSING", [filePath]);
    }
    fail(`${label} is invalid JSON`, "INVALID_AUTHORING_PROBE_ARTIFACT", [
      filePath,
      error.message
    ]);
  }
}

async function readYamlState(filePath, label, fallback) {
  try {
    return parseYaml(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    fail(`Cannot read ${label}`, "INVALID_AUTHORING_STATE", [filePath, error.message]);
  }
}

async function writeTextAtomically(filePath, content) {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function writeYamlState(filePath, value) {
  await writeTextAtomically(filePath, stringifyYaml(value));
}

async function resolveActivePass(stateRoot, requested) {
  const passes = await readAuthoringPasses(stateRoot);
  const open = passes.filter(({ open }) => open);
  if (requested) {
    const match = passes.find(({ id }) => id === requested);
    if (!match) {
      fail(`Unknown authoring pass: ${requested}`, "UNKNOWN_AUTHORING_PASS", [
        `available: ${passes.map(({ id }) => id).join(", ") || "none"}`
      ]);
    }
    if (!match.open) {
      fail(`Authoring pass ${requested} is already ${match.result.outcome}`, "AUTHORING_PASS_CLOSED");
    }
    return match;
  }
  if (open.length === 0) {
    fail("No open authoring pass. Run `seedspec author review` to begin one.", "NO_ACTIVE_AUTHORING_PASS");
  }
  return open[0];
}

function estimatedTokens(bytes) {
  return Math.ceil(bytes / 3);
}

function materialInput(subject, included) {
  const lines = [
    "# Frozen SeedSpec clarification subject",
    "",
    `Package: ${subject.package.id}@${subject.package.version}`,
    `Package kind: ${subject.package.kind}`,
    `Package digest: ${subject.package.digest}`,
    `Draft digest: ${subject.package.draft_digest}`,
    `Authoring workspace revision: ${subject.workspace.revision}`,
    `Authoring pass: ${subject.pass.id} (${subject.pass.area})`,
    "",
    "Each section below is authored material. Its heading contains the exact source anchor.",
    "",
  ];
  for (const item of included) {
    lines.push(
      `## ${item.id}`,
      "",
      `Authority: ${item.authority}`,
      `Media type: ${item.media_type}`,
      `Digest: ${item.digest}`,
      `Bytes: ${item.bytes}`,
      "",
      `<seedspec-material anchor="${item.id}">`,
      item.content,
      "</seedspec-material>",
      ""
    );
  }
  return `${lines.join("\n")}\n`;
}

async function activeSources(stateRoot) {
  const state = await readYamlState(
    path.join(stateRoot, "sources.yaml"),
    "authoring sources",
    { sources: [] }
  );
  if (!Array.isArray(state.sources)) {
    fail("Authoring sources state must contain a sources array", "INVALID_AUTHORING_STATE");
  }
  return state.sources.filter(({ status }) => status === undefined || status === "active");
}

async function visibilityManifest(packageRoot, stateRoot, snapshot) {
  const included = [];
  const excluded = [];
  for (const document of snapshot.documents) {
    if (!TEXT_EXTENSIONS.has(path.extname(document.path).toLowerCase())) {
      excluded.push({
        id: `package:${document.path}`,
        kind: "package-document",
        authority: "package-author",
        digest: document.digest,
        bytes: document.bytes,
        reason: "non-text material is not supported by the clarification probe"
      });
      continue;
    }
    const content = await readFile(path.join(packageRoot, ...document.path.split("/")), "utf8");
    included.push({
      id: `package:${document.path}`,
      kind: "package-document",
      authority: "package-author",
      path: document.path,
      media_type: document.media_type,
      digest: document.digest,
      bytes: document.bytes,
      estimated_tokens: estimatedTokens(document.bytes),
      content
    });
  }
  for (const source of await activeSources(stateRoot)) {
    if (typeof source.content !== "string" || source.content === "") {
      excluded.push({
        id: `source:${source.id ?? "unnamed-source"}`,
        kind: source.kind ?? "attached-source",
        authority: source.authority ?? "unspecified",
        digest: authoringProbeDigest(JSON.stringify({
          id: source.id ?? null,
          location: source.location ?? null,
          summary: source.summary ?? null
        })),
        bytes: 0,
        reason: "the source is a pointer without frozen inline bytes; external retrieval is disabled"
      });
      continue;
    }
    const bytes = Buffer.byteLength(source.content, "utf8");
    included.push({
      id: `source:${source.id ?? "unnamed-source"}`,
      kind: source.kind ?? "attached-source",
      authority: source.authority ?? "unspecified",
      path: null,
      media_type: "text/plain",
      digest: authoringProbeDigest(source.content),
      bytes,
      estimated_tokens: estimatedTokens(bytes),
      content: source.content
    });
  }
  excluded.push(
    {
      id: "authoring-state:administrative-records",
      kind: "workspace-state",
      authority: "authoring-system",
      digest: snapshot.workspace.state_digest,
      bytes: 0,
      reason: "administrative state is identity evidence, not authored package meaning"
    },
    {
      id: "workspace:undeclared-siblings",
      kind: "workspace-context",
      authority: "none",
      digest: null,
      bytes: 0,
      reason: "undeclared workspace files are outside the frozen visibility boundary"
    },
    {
      id: "network:external-material",
      kind: "external-context",
      authority: "none",
      digest: null,
      bytes: 0,
      reason: "network and browser access are disabled"
    },
    {
      id: "tools:all",
      kind: "execution-capability",
      authority: "authoring-policy",
      digest: null,
      bytes: 0,
      reason: "the single-interpretation clarification probe permits no tools"
    }
  );
  return { included, excluded };
}

function publicIncluded(items) {
  return items.map(({ content: _content, ...item }) => item);
}

function maxProjectedSpend(inputTokens, outputTokens, pricing) {
  return Number((
    inputTokens * pricing.input_per_million_usd / 1_000_000
    + outputTokens * pricing.output_per_million_usd / 1_000_000
  ).toFixed(6));
}

function artifactDescriptor(file, bytes) {
  return {
    file,
    digest: authoringProbeDigest(bytes),
    bytes: Buffer.byteLength(bytes, "utf8")
  };
}

async function createFreshDirectory(outputDirectory, packageRoot, stateRoot) {
  const output = path.resolve(outputDirectory);
  if (isWithin(packageRoot, output) || isWithin(stateRoot, output)) {
    fail(
      "The frozen probe bundle must be outside the package and authoring state",
      "INVALID_AUTHORING_PROBE_OUTPUT",
      [output]
    );
  }
  if (await pathInfo(output)) {
    fail("Probe output already exists", "AUTHORING_PROBE_OUTPUT_EXISTS", [output]);
  }
  await mkdir(output, { recursive: true });
  return output;
}

export async function prepareClarificationProbe(packageRoot, {
  stateRoot,
  outputDirectory,
  pass: requestedPass,
  probe: input,
  expectedRevision = null,
  now = () => new Date().toISOString()
} = {}) {
  if (!outputDirectory) fail("outputDirectory is required", "INVALID_AUTHORING_PROBE_OUTPUT");
  let shaped;
  try {
    shaped = validateProbePreparationInput(input);
  } catch (error) {
    toSeedSpecError(error);
  }
  const [snapshot, active, revision] = await Promise.all([
    inspectAuthoringWorkspace(packageRoot, { stateDirectory: stateRoot }),
    resolveActivePass(stateRoot, requestedPass),
    computeWorkspaceRevision(packageRoot, stateRoot)
  ]);
  if (expectedRevision && expectedRevision !== revision) {
    fail("Authoring workspace changed since it was read", "AUTHORING_REVISION_CONFLICT", [
      `expected: ${expectedRevision}`,
      `actual: ${revision}`
    ]);
  }
  if (snapshot.package.status !== "valid") {
    fail("A clarification probe requires a structurally valid package", "AUTHORING_PROBE_SUBJECT_INVALID");
  }
  const visibility = await visibilityManifest(packageRoot, stateRoot, snapshot);
  const subject = {
    package: {
      id: snapshot.package.id,
      version: snapshot.package.version,
      kind: snapshot.package.kind,
      digest: snapshot.package.digest,
      draft_digest: snapshot.package.draft_digest
    },
    workspace: {
      id: snapshot.workspace.id,
      revision
    },
    pass: {
      id: active.id,
      area: active.request.area,
      target: active.request.target
    }
  };
  const instructions = `${clarificationProbeInstructions()}\n`;
  const resultSchema = `${JSON.stringify(clarificationProbeTransportSchema(), null, 2)}\n`;
  const validationSchema = `${JSON.stringify(clarificationProbeResultSchema(), null, 2)}\n`;
  const probeInput = materialInput(subject, visibility.included);
  const artifacts = {
    instructions: artifactDescriptor("instructions.md", instructions),
    input: artifactDescriptor("input.md", probeInput),
    output_schema: artifactDescriptor("result.schema.json", resultSchema),
    validation_schema: artifactDescriptor("validation.schema.json", validationSchema)
  };
  const estimatedInput = {
    method: "utf8-bytes-divided-by-three-plus-fixed-runner-overhead",
    material_tokens: estimatedTokens(
      artifacts.instructions.bytes + artifacts.input.bytes + artifacts.output_schema.bytes
    ),
    fixed_runner_overhead_tokens: 1024
  };
  estimatedInput.maximum_tokens = estimatedInput.material_tokens
    + estimatedInput.fixed_runner_overhead_tokens;
  const projectedSpend = maxProjectedSpend(
    shaped.limits.max_input_tokens,
    shaped.limits.max_output_tokens,
    shaped.pricing
  );
  const checks = [
    { id: "package-valid", passed: true },
    { id: "workspace-revision-bound", passed: true },
    { id: "included-material-digested", passed: visibility.included.every(({ digest }) => Boolean(digest)) },
    {
      id: "input-within-authorized-limit",
      passed: estimatedInput.maximum_tokens <= shaped.limits.max_input_tokens
    },
    {
      id: "input-and-output-within-context",
      passed: shaped.limits.max_input_tokens + shaped.limits.max_output_tokens
        <= shaped.limits.model_context_tokens
    },
    {
      id: "projected-spend-within-ceiling",
      passed: projectedSpend <= shaped.limits.max_spend_usd
    },
    { id: "single-attempt-no-retry", passed: true },
    { id: "tools-disabled", passed: true },
    { id: "no-silent-truncation", passed: true }
  ];
  const degraded = [
    ...(!shaped.runner.enforces_output_token_limit
      ? ["the selected runner cannot enforce the reserved output-token limit"]
      : []),
    ...(!shaped.runner.enforces_spend_limit
      ? ["the selected runner cannot enforce a dollar stop during the one authorized attempt"]
      : [])
  ];
  const preparedAt = now();
  const policy = {
    id: "org.seedspec.authoring.clarification-single-pass",
    version: "1",
    digest: authoringProbeDigest({
      mode: "single-interpretation",
      tools: [],
      repetitions: 1,
      branches: 1,
      retries: 0,
      evaluators: 0,
      retention: "local-authoring"
    })
  };
  const body = {
    authoring_probe_brief_version: AUTHORING_PROBE_BRIEF_FORMAT,
    prepared_at: preparedAt,
    purpose: "clarification",
    mode: "single-interpretation",
    instruction: {
      id: AUTHORING_PROBE_INSTRUCTION_ID,
      version: AUTHORING_PROBE_INSTRUCTION_VERSION,
      digest: artifacts.instructions.digest
    },
    policy,
    subject,
    visibility: {
      manifest_version: "1",
      included: publicIncluded(visibility.included),
      excluded: visibility.excluded,
      review_lenses: ["seed", "coherence", "success", "supporting-material"],
      no_authoritative_material_silently_truncated: true
    },
    execution: {
      model: shaped.model,
      runner: shaped.runner,
      settings: shaped.settings,
      permitted_tools: [],
      external_verifier: null
    },
    budget: {
      limits: shaped.limits,
      phases: {
        generation_attempts: 1,
        repetitions: 1,
        branches: 1,
        retries: 0,
        evaluators: 0
      },
      estimated_input: estimatedInput,
      reserved_output_tokens: shaped.limits.max_output_tokens,
      projected_maximum_usd: projectedSpend,
      pricing: shaped.pricing,
      known_omissions: [
        "provider-managed system or routing tokens not exposed before execution",
        "subscription allocation and rate-limit consumption"
      ]
    },
    artifacts,
    retention: {
      classification: "local-authoring",
      raw_response: "retained-locally",
      provider_events: "retained-locally-with-hidden-reasoning-removed",
      portable_package: "excluded",
      first_party_telemetry: "excluded"
    },
    preflight: {
      checked_at: preparedAt,
      status: checks.every(({ passed }) => passed) ? "ready" : "blocked",
      checks,
      degraded
    }
  };
  const digest = authoringProbeDigest(body);
  const brief = { id: `probe-${digest.slice("sha256:".length, "sha256:".length + 24)}`, digest, ...body };
  if (brief.preflight.status !== "ready") {
    fail("Clarification probe preflight did not pass", "AUTHORING_PROBE_PREFLIGHT_BLOCKED", [
      ...checks.filter(({ passed }) => !passed).map(({ id }) => id)
    ]);
  }
  const output = await createFreshDirectory(outputDirectory, packageRoot, stateRoot);
  const briefBytes = `${JSON.stringify(brief, null, 2)}\n`;
  await Promise.all([
    writeFile(path.join(output, "probe-brief.json"), briefBytes, { encoding: "utf8", flag: "wx" }),
    writeFile(path.join(output, "instructions.md"), instructions, { encoding: "utf8", flag: "wx" }),
    writeFile(path.join(output, "input.md"), probeInput, { encoding: "utf8", flag: "wx" }),
    writeFile(path.join(output, "result.schema.json"), resultSchema, { encoding: "utf8", flag: "wx" }),
    writeFile(path.join(output, "validation.schema.json"), validationSchema, { encoding: "utf8", flag: "wx" }),
    writeFile(path.join(output, "probe-local.json"), `${JSON.stringify({
      package_root: path.resolve(packageRoot),
      state_root: path.resolve(stateRoot)
    }, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
  ]);
  return {
    operation: "prepare-clarification-probe",
    prepared: true,
    brief,
    output,
    files: {
      brief: path.join(output, "probe-brief.json"),
      instructions: path.join(output, "instructions.md"),
      input: path.join(output, "input.md"),
      output_schema: path.join(output, "result.schema.json"),
      validation_schema: path.join(output, "validation.schema.json")
    }
  };
}

async function readFrozenBundle(bundleDirectory) {
  const root = path.resolve(bundleDirectory);
  const readOptionalValidationSchema = readFile(path.join(root, "validation.schema.json"), "utf8")
    .catch((error) => {
      if (error.code === "ENOENT") return null;
      fail("Probe validation schema is not readable", "INVALID_AUTHORING_PROBE_ARTIFACT", [
        error.message
      ]);
    });
  const [brief, instructions, input, outputSchema, validationSchema] = await Promise.all([
    readJson(path.join(root, "probe-brief.json"), "probe brief"),
    readFile(path.join(root, "instructions.md"), "utf8").catch((error) => {
      fail("Probe instructions are missing", "AUTHORING_PROBE_ARTIFACT_MISSING", [error.message]);
    }),
    readFile(path.join(root, "input.md"), "utf8").catch((error) => {
      fail("Probe input is missing", "AUTHORING_PROBE_ARTIFACT_MISSING", [error.message]);
    }),
    readFile(path.join(root, "result.schema.json"), "utf8").catch((error) => {
      fail("Probe result schema is missing", "AUTHORING_PROBE_ARTIFACT_MISSING", [error.message]);
    }),
    readOptionalValidationSchema
  ]);
  return { root, brief, instructions, input, outputSchema, validationSchema };
}

function briefIdentityChecks(bundle) {
  const { id, digest, ...body } = bundle.brief;
  return [
    {
      id: "brief-content-identity",
      passed: typeof digest === "string"
        && digest === authoringProbeDigest(body)
        && id === `probe-${digest.slice("sha256:".length, "sha256:".length + 24)}`
    },
    {
      id: "instruction-digest",
      passed: bundle.brief.artifacts?.instructions?.digest === authoringProbeDigest(bundle.instructions)
    },
    {
      id: "input-digest",
      passed: bundle.brief.artifacts?.input?.digest === authoringProbeDigest(bundle.input)
    },
    {
      id: "output-schema-digest",
      passed: bundle.brief.artifacts?.output_schema?.digest === authoringProbeDigest(bundle.outputSchema)
    },
    {
      id: "validation-schema-digest",
      passed: bundle.brief.artifacts?.validation_schema
        ? bundle.validationSchema !== null
          && bundle.brief.artifacts.validation_schema.digest
            === authoringProbeDigest(bundle.validationSchema)
        : bundle.validationSchema === null
    }
  ];
}

export async function verifyClarificationProbe(packageRoot, {
  stateRoot,
  bundleDirectory
} = {}) {
  const bundle = await readFrozenBundle(bundleDirectory);
  const identityChecks = briefIdentityChecks(bundle);
  const snapshot = await inspectAuthoringWorkspace(packageRoot, { stateDirectory: stateRoot });
  const revision = await computeWorkspaceRevision(packageRoot, stateRoot);
  const subjectChecks = [
    {
      id: "package-draft-current",
      passed: snapshot.package.draft_digest === bundle.brief.subject?.package?.draft_digest
    },
    {
      id: "package-identity-current",
      passed: snapshot.package.id === bundle.brief.subject?.package?.id
        && snapshot.package.digest === bundle.brief.subject?.package?.digest
    },
    {
      id: "workspace-revision-current",
      passed: revision === bundle.brief.subject?.workspace?.revision
    },
    {
      id: "prepared-preflight-ready",
      passed: bundle.brief.preflight?.status === "ready"
    }
  ];
  const checks = [...identityChecks, ...subjectChecks];
  return {
    authoring_probe_preflight_version: "1",
    brief_id: bundle.brief.id,
    ready: checks.every(({ passed }) => passed),
    artifact_identity_valid: identityChecks.every(({ passed }) => passed),
    subject_current: subjectChecks.slice(0, 3).every(({ passed }) => passed),
    checks,
    degraded: bundle.brief.preflight?.degraded ?? [],
    local: { bundle_root: bundle.root }
  };
}

function validateExecution(execution, brief) {
  const details = [];
  if (execution?.authoring_probe_execution_version !== AUTHORING_PROBE_EXECUTION_FORMAT) {
    details.push(`authoring_probe_execution_version must be ${AUTHORING_PROBE_EXECUTION_FORMAT}`);
  }
  if (typeof execution?.run_id !== "string" || !/^run-[a-z0-9-]+$/u.test(execution.run_id)) {
    details.push("run_id must start with run- and contain lowercase letters, numbers, or hyphens");
  }
  if (execution?.brief_id !== brief.id) details.push("execution brief_id does not match the frozen brief");
  if (execution?.provider !== brief.execution?.model?.provider) {
    details.push("execution provider does not match the frozen brief");
  }
  if (execution?.requested_model !== brief.execution?.model?.id) {
    details.push("execution requested_model does not match the frozen brief");
  }
  if (execution?.runner?.id !== brief.execution?.runner?.id) {
    details.push("execution runner does not match the frozen brief");
  }
  if (!['succeeded', 'failed', 'timed-out'].includes(execution?.status)) {
    details.push("execution status must be succeeded, failed, or timed-out");
  }
  if (execution?.attempt !== 1 || execution?.retry !== false) {
    details.push("the first probe run permits one non-retry attempt");
  }
  if (!Array.isArray(execution?.tools) || execution.tools.length !== 0) {
    details.push("the first probe run permits no tools");
  }
  for (const field of ["started_at", "finished_at"]) {
    if (typeof execution?.[field] !== "string" || Number.isNaN(Date.parse(execution[field]))) {
      details.push(`${field} must be an ISO date-time`);
    }
  }
  if (details.length > 0) fail("Invalid probe execution record", "INVALID_AUTHORING_PROBE_EXECUTION", details);
}

async function copyRetainedFiles(bundleRoot, retainedRoot) {
  await mkdir(retainedRoot, { recursive: false });
  const copied = [];
  for (const name of RETAINED_FILES) {
    const source = path.join(bundleRoot, name);
    if (!await pathInfo(source)) continue;
    const destination = path.join(retainedRoot, name);
    await cp(source, destination, { errorOnExist: true, force: false });
    const bytes = await readFile(destination);
    copied.push({
      file: name,
      digest: authoringProbeDigest(bytes),
      bytes: bytes.byteLength
    });
  }
  return copied;
}

export async function recordClarificationProbeRun(packageRoot, {
  stateRoot,
  bundleDirectory,
  expectedRevision = null,
  now = () => new Date().toISOString()
} = {}) {
  const bundle = await readFrozenBundle(bundleDirectory);
  const identityChecks = briefIdentityChecks(bundle);
  if (!identityChecks.every(({ passed }) => passed)) {
    fail("Frozen probe artifact identity does not match", "AUTHORING_PROBE_IDENTITY_MISMATCH", [
      ...identityChecks.filter(({ passed }) => !passed).map(({ id }) => id)
    ]);
  }
  const previousRevision = await computeWorkspaceRevision(packageRoot, stateRoot);
  if (expectedRevision && expectedRevision !== previousRevision) {
    fail("Authoring workspace changed since it was read", "AUTHORING_REVISION_CONFLICT", [
      `expected: ${expectedRevision}`,
      `actual: ${previousRevision}`
    ]);
  }
  const [execution, rawResult, snapshot] = await Promise.all([
    readJson(path.join(bundle.root, "probe-execution.json"), "probe execution"),
    readJson(path.join(bundle.root, "probe-result.json"), "probe result"),
    inspectAuthoringWorkspace(packageRoot, { stateDirectory: stateRoot })
  ]);
  validateExecution(execution, bundle.brief);
  let result = null;
  const validation = { status: "valid", errors: [] };
  try {
    result = validateClarificationProbeResult(rawResult);
  } catch (error) {
    validation.status = "quarantined";
    validation.errors = error.details ?? [error.message];
  }
  const current = snapshot.package.draft_digest === bundle.brief.subject.package.draft_digest
    && snapshot.package.digest === bundle.brief.subject.package.digest
    && previousRevision === bundle.brief.subject.workspace.revision;
  if (!current) {
    validation.status = "quarantined";
    validation.errors.push("the package or authoring workspace changed after the probe was frozen");
  }
  if (execution.status !== "succeeded") {
    validation.status = "quarantined";
    validation.errors.push(`the model execution ended with status ${execution.status}`);
  }
  const includedAnchors = new Set(bundle.brief.visibility.included.map(({ id }) => id));
  if (result) {
    const unknownAnchors = result.source_claims
      .map(({ reference }) => reference)
      .filter((reference) => !includedAnchors.has(reference));
    if (unknownAnchors.length > 0) {
      validation.status = "quarantined";
      validation.errors.push(`source claims use unknown anchors: ${unknownAnchors.join(", ")}`);
    }
  }
  const observedCost = execution.usage?.capture === "provider-reported"
    && typeof execution.usage.cost_usd === "number"
    ? execution.usage.cost_usd
    : null;
  if (observedCost !== null && observedCost > bundle.brief.budget.limits.max_spend_usd) {
    validation.status = "quarantined";
    validation.errors.push("provider-reported cost exceeded the authorized ceiling");
  }
  const probeStatePath = path.join(stateRoot, "probes", "index.yaml");
  const probeState = await readYamlState(probeStatePath, "authoring probe runs", {
    authoring_probe_runs_version: AUTHORING_PROBE_RUN_FORMAT,
    runs: []
  });
  if (!Array.isArray(probeState.runs)) {
    fail("Authoring probe state must contain a runs array", "INVALID_AUTHORING_STATE");
  }
  if (probeState.runs.some(({ id }) => id === execution.run_id)) {
    fail(`Probe run already recorded: ${execution.run_id}`, "AUTHORING_PROBE_RUN_EXISTS");
  }
  const resultDigest = authoringProbeDigest(rawResult);
  const occurrenceId = validation.status === "valid" && result?.outcome === "candidate"
    ? `occurrence-${authoringProbeDigest({
      brief: bundle.brief.id,
      run: execution.run_id,
      result: resultDigest
    }).slice("sha256:".length, "sha256:".length + 24)}`
    : null;
  const candidateStatePath = path.join(stateRoot, "candidates", "index.yaml");
  const candidateState = await readYamlState(candidateStatePath, "authoring candidates", {
    authoring_candidates_version: AUTHORING_CANDIDATE_FORMAT,
    candidates: []
  });
  if (!Array.isArray(candidateState.candidates)) {
    fail("Authoring candidate state must contain a candidates array", "INVALID_AUTHORING_STATE");
  }
  let candidate = null;
  if (occurrenceId) {
    const id = assignAuthoringCandidateId(
      new Set(candidateState.candidates.map(({ id: existingId }) => existingId).filter(Boolean)),
      () => randomUUID()
    );
    candidate = {
      id,
      ...result.candidate,
      pass: bundle.brief.subject.pass.id,
      status: "open",
      package_draft_digest_before: bundle.brief.subject.package.draft_digest,
      workspace_revision_before: bundle.brief.subject.workspace.revision,
      recorded_at: execution.finished_at,
      disposition: null,
      proposal_ids: [],
      occurrence: {
        id: occurrenceId,
        probe_run_id: execution.run_id,
        comparison_group_ids: []
      },
      retention: {
        classification: "local-authoring",
        portable_package: "excluded"
      }
    };
    candidateState.candidates.push(candidate);
  }
  const retainedAt = now();
  const runSummary = {
    id: execution.run_id,
    brief_id: bundle.brief.id,
    brief_digest: bundle.brief.digest,
    pass: bundle.brief.subject.pass.id,
    package_draft_digest: bundle.brief.subject.package.draft_digest,
    workspace_revision: bundle.brief.subject.workspace.revision,
    provider: execution.provider,
    requested_model: execution.requested_model,
    served_model: execution.served_model ?? null,
    runner: execution.runner,
    status: execution.status,
    validation,
    outcome: validation.status === "valid" ? result.outcome : "quarantined",
    author_question: validation.status === "valid" && result.outcome === "candidate"
      ? result.candidate.question
      : null,
    no_action: validation.status === "valid" && result.outcome === "no-action"
      ? result.no_action
      : null,
    occurrence_id: occurrenceId,
    candidate_id: candidate?.id ?? null,
    comparison_group_ids: [],
    usage: execution.usage ?? { capture: "unavailable" },
    limitations: execution.limitations ?? [],
    retained_at: retainedAt,
    retention: bundle.brief.retention
  };
  const retainedRoot = path.join(stateRoot, "probes", "runs", execution.run_id);
  await mkdir(path.dirname(retainedRoot), { recursive: true });
  const artifacts = await copyRetainedFiles(bundle.root, retainedRoot);
  await writeFile(
    path.join(retainedRoot, "run.json"),
    `${JSON.stringify({ ...runSummary, artifacts }, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  probeState.runs.push({ ...runSummary, artifacts });
  await mkdir(path.dirname(probeStatePath), { recursive: true });
  if (candidate) await writeYamlState(candidateStatePath, candidateState);
  await writeYamlState(probeStatePath, probeState);
  const revision = await computeWorkspaceRevision(packageRoot, stateRoot);
  return {
    authoring_probe_operation_version: "2",
    operation: "record-clarification-probe-run",
    applied: true,
    workspace: { revision, previous_revision: previousRevision },
    changed: [
      { kind: "probe-runs", id: execution.run_id },
      ...(candidate ? [{ kind: "candidates", id: candidate.id }] : [])
    ],
    run: runSummary,
    candidate: candidate ? {
      id: candidate.id,
      pass: candidate.pass,
      status: candidate.status,
      issue: candidate.issue,
      disposition: candidate.disposition,
      proposal_ids: candidate.proposal_ids
    } : null,
    local: {
      state_root: stateRoot,
      package_root: packageRoot,
      retained_run_root: retainedRoot
    }
  };
}

export function formatClarificationProbePreparation(result) {
  return [
    `Prepared frozen clarification probe ${result.brief.id}`,
    `Preflight: ${result.brief.preflight.status}`,
    `Model: ${result.brief.execution.model.provider}/${result.brief.execution.model.id}`,
    `Projected maximum: $${result.brief.budget.projected_maximum_usd.toFixed(4)} of $${result.brief.budget.limits.max_spend_usd.toFixed(2)}`,
    `Bundle: ${result.output}`,
    ...(result.brief.preflight.degraded.length > 0
      ? result.brief.preflight.degraded.map((item) => `Limitation: ${item}`)
      : [])
  ].join("\n");
}

export function formatClarificationProbePreflight(result) {
  return [
    `Probe ${result.brief_id}: ${result.ready ? "READY" : "BLOCKED"}`,
    ...result.checks.map(({ id, passed }) => `${passed ? "PASS" : "FAIL"} ${id}`),
    ...result.degraded.map((item) => `LIMITATION ${item}`)
  ].join("\n");
}
