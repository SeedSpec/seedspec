import { mkdir, lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import {
  canonicalJson,
  contentId,
  runPath,
  sha256,
  snapshotDirectory,
  verifyRunContract
} from "./lib/run-contract.mjs";

export const SEMANTIC_DIMENSIONS = [
  "semantic-fidelity",
  "invented-obligations",
  "missed-consequential-decisions",
  "unnecessary-question-burden",
  "implementation-latitude",
  "internal-consistency",
  "packaging-readiness",
  "fresh-agent-usefulness"
];

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!["--run", "--out"].includes(name) || !value) {
      throw new Error("Usage: prepare-semantic-grade.mjs --run <completed-run> --out <new-dir>");
    }
    options[name.slice(2)] = value;
  }
  if (!options.run || !options.out) throw new Error("--run and --out are required");
  return options;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} is required`);
  return value;
}

function requireLevel(value, label) {
  if (!["critical", "material", "minor"].includes(value)) {
    throw new Error(`${label} must be critical, material, or minor`);
  }
  return value;
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of nonempty strings`);
  }
  return value;
}

function exactObject(value, fields, label) {
  const record = requireRecord(value, label);
  const extras = Object.keys(record).filter((field) => !fields.includes(field));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(", ")}`);
  return record;
}

function normalizeReference(referenceInput) {
  const reference = exactObject(referenceInput ?? {}, [
    "meaning",
    "decisions",
    "obligations",
    "permitted_variability",
    "forbidden_inventions",
    "protected_paths"
  ], "subject.reference");
  const ledgers = {
    meaning: reference.meaning ?? [],
    decisions: reference.decisions ?? [],
    obligations: reference.obligations ?? [],
    permitted_variability: reference.permitted_variability ?? [],
    forbidden_inventions: reference.forbidden_inventions ?? [],
    protected_paths: reference.protected_paths ?? []
  };
  for (const [name, entries] of Object.entries(ledgers)) {
    if (!Array.isArray(entries)) throw new Error(`subject.reference.${name} must be an array`);
  }

  ledgers.meaning.forEach((entry, index) => {
    const label = `subject.reference.meaning[${index}]`;
    exactObject(entry, ["id", "description", "source", "authority", "materiality", "expectation"], label);
    requireString(entry.id, `${label}.id`);
    requireString(entry.description, `${label}.description`);
    exactObject(entry.source, ["path"], `${label}.source`);
    requireString(entry.source.path, `${label}.source.path`);
    requireString(entry.authority, `${label}.authority`);
    requireLevel(entry.materiality, `${label}.materiality`);
    requireString(entry.expectation, `${label}.expectation`);
  });
  ledgers.decisions.forEach((entry, index) => {
    const label = `subject.reference.decisions[${index}]`;
    exactObject(entry, ["id", "description", "materiality", "expected_latitude", "acceptable_outcomes"], label);
    requireString(entry.id, `${label}.id`);
    requireString(entry.description, `${label}.description`);
    requireLevel(entry.materiality, `${label}.materiality`);
    requireString(entry.expected_latitude, `${label}.expected_latitude`);
    requireStringArray(entry.acceptable_outcomes, `${label}.acceptable_outcomes`);
  });
  ledgers.obligations.forEach((entry, index) => {
    const label = `subject.reference.obligations[${index}]`;
    exactObject(entry, ["id", "kind", "description", "importance"], label);
    requireString(entry.id, `${label}.id`);
    requireString(entry.kind, `${label}.kind`);
    requireString(entry.description, `${label}.description`);
    requireLevel(entry.importance, `${label}.importance`);
  });
  ledgers.permitted_variability.forEach((entry, index) => {
    const label = `subject.reference.permitted_variability[${index}]`;
    exactObject(entry, ["id", "description", "bounds"], label);
    requireString(entry.id, `${label}.id`);
    requireString(entry.description, `${label}.description`);
    requireString(entry.bounds, `${label}.bounds`);
  });
  ledgers.forbidden_inventions.forEach((entry, index) => {
    const label = `subject.reference.forbidden_inventions[${index}]`;
    exactObject(entry, ["id", "description", "severity"], label);
    requireString(entry.id, `${label}.id`);
    requireString(entry.description, `${label}.description`);
    if (!["critical", "major", "minor"].includes(entry.severity)) {
      throw new Error(`${label}.severity must be critical, major, or minor`);
    }
  });
  ledgers.protected_paths.forEach((entry, index) => {
    const label = `subject.reference.protected_paths[${index}]`;
    exactObject(entry, ["path", "kind"], label);
    requireString(entry.path, `${label}.path`);
    requireString(entry.kind, `${label}.kind`);
  });
  return ledgers;
}

function referenceAxes(reference) {
  const definitions = [
    ["meaning", "meaning", (entry) => entry.id, (entry) => entry.materiality],
    ["decisions", "decision", (entry) => entry.id, (entry) => entry.materiality],
    ["obligations", "obligation", (entry) => entry.id, (entry) => entry.importance],
    ["permitted_variability", "permitted-variability", (entry) => entry.id, () => "material"],
    [
      "forbidden_inventions",
      "forbidden-invention",
      (entry) => entry.id,
      (entry) => entry.severity === "major" ? "material" : entry.severity
    ],
    ["protected_paths", "protected-path", (entry) => entry.path, () => "material"]
  ];
  const axes = definitions.flatMap(([ledger, kind, identifier, level]) => (
    reference[ledger].map((entry) => {
      const referenceId = identifier(entry);
      return {
        axis_id: `${kind}:${referenceId}`,
        reference_kind: kind,
        reference_id: referenceId,
        level: level(entry)
      };
    })
  ));
  const ids = new Set();
  for (const axis of axes) {
    if (ids.has(axis.axis_id)) throw new Error(`Duplicate semantic reference axis: ${axis.axis_id}`);
    ids.add(axis.axis_id);
  }
  return axes;
}

function safeRelative(relativePath, label) {
  requireString(relativePath, label);
  if (path.isAbsolute(relativePath) || relativePath.includes("\\") || relativePath.split("/").includes("..")) {
    throw new Error(`${label} must be a safe relative path`);
  }
  return relativePath.split(path.sep).join("/");
}

async function verifyFileReference(runDirectory, reference, label) {
  const filePath = runPath(runDirectory, safeRelative(reference?.path, `${label}.path`), label);
  const content = await readFile(filePath);
  if (sha256(content) !== reference.digest || content.byteLength !== reference.bytes) {
    throw new Error(`${label} does not match its frozen digest and size`);
  }
  return filePath;
}

async function verifyFinalSnapshot(runDirectory, snapshot, root, label) {
  requireRecord(snapshot, label);
  await verifyFileReference(runDirectory, snapshot.manifest, `${label}.manifest`);
  const current = await snapshotDirectory(root);
  if (current.digest !== snapshot.digest
      || current.file_count !== snapshot.files
      || current.bytes !== snapshot.bytes) {
    throw new Error(`${label} does not match the completed run result`);
  }
}

async function filesUnder(root) {
  const absoluteRoot = path.resolve(root);
  const files = [];
  async function visit(directory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const information = await lstat(absolute);
      const relative = path.relative(absoluteRoot, absolute).split(path.sep).join("/");
      if (information.isSymbolicLink()) throw new Error(`Evidence input contains a symbolic link: ${relative}`);
      if (information.isDirectory()) await visit(absolute);
      else if (information.isFile()) files.push({ absolute, relative });
      else throw new Error(`Evidence input contains a non-file entry: ${relative}`);
    }
  }
  await visit(absoluteRoot);
  return files;
}

async function writeEvidenceFile(outputRoot, relativePath, content, role, files) {
  const safePath = safeRelative(relativePath, "evidence path");
  const destination = path.join(outputRoot, safePath);
  await mkdir(path.dirname(destination), { recursive: true });
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  await writeFile(destination, buffer, { flag: "wx" });
  files.push({ path: safePath, role, digest: sha256(buffer), bytes: buffer.byteLength });
}

async function copyTree(sourceRoot, destinationPrefix, role, outputRoot, files, transform = null) {
  for (const file of await filesUnder(sourceRoot)) {
    const original = await readFile(file.absolute);
    const content = transform ? transform(original, file.relative) : original;
    await writeEvidenceFile(outputRoot, `${destinationPrefix}/${file.relative}`, content, role, files);
  }
}

function identityTokens(contract) {
  return [...new Set([
    contract.execution.runner.id,
    contract.execution.runner.version,
    contract.execution.model.provider,
    contract.execution.model.id,
    contract.execution.model.selector
  ].filter((value) => typeof value === "string" && value !== ""))]
    .sort((left, right) => right.length - left.length);
}

function blindText(value, tokens) {
  return tokens.reduce((text, token) => text.replaceAll(token, "[identity-redacted]"), value);
}

const identityKey = /runner|model|provider|session|thread/iu;

function blindJson(value, tokens) {
  if (Array.isArray(value)) return value.map((item) => blindJson(item, tokens));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !identityKey.test(key))
      .map(([key, item]) => [key, blindJson(item, tokens)]));
  }
  return typeof value === "string" ? blindText(value, tokens) : value;
}

function blindJsonLines(content, label, tokens) {
  const lines = content.toString("utf8").split(/\r?\n/u).filter((line) => line.trim());
  const normalized = lines.map((line, index) => {
    try {
      return JSON.stringify(blindJson(JSON.parse(line), tokens));
    } catch (error) {
      throw new Error(`${label} line ${index + 1} is invalid JSON: ${error.message}`, { cause: error });
    }
  });
  return Buffer.from(`${normalized.join("\n")}\n`, "utf8");
}

function instructions(axes) {
  return `# Semantic grading instructions

Evaluate only the files in this evidence kit. Do not identify the runner or model. Do not use digest equality as semantic evidence.

Copy the subject, CLI baseline, and evidence identity from \`evidence.json\` into the draft.

## Score scale

- 4: Complete alignment. No consequential weakness.
- 3: Aligned. Minor, non-consequential weakness.
- 2: Material weakness. The package remains partly usable.
- 1: Major weakness. Substantial correction is required.
- 0: Critical failure or absence of the required quality.

Higher is better for every dimension. For negative-name dimensions, a higher score means fewer or less consequential defects.

## Exact dimensions

1. \`semantic-fidelity\`: Preserve authoritative meaning, scope, exclusions, and outcomes.
2. \`invented-obligations\`: Avoid unsupported requirements, defaults, tasks, constraints, and implementation commitments.
3. \`missed-consequential-decisions\`: Capture or explicitly preserve every decision that materially changes the package.
4. \`unnecessary-question-burden\`: Ask only questions needed to resolve consequential uncertainty. Do not reward silent guessing.
5. \`implementation-latitude\`: Preserve authorized solution freedom while making product behavior and constraints explicit.
6. \`internal-consistency\`: Keep package documents, configuration, acceptance material, and recorded authoring outcomes mutually consistent.
7. \`packaging-readiness\`: Produce a coherent, validatable package with usable boundaries and observable acceptance material.
8. \`fresh-agent-usefulness\`: Let an uninformed implementation agent act correctly without rediscovering material intent.

For each dimension, provide an integer score from 0 through 4, confidence \`low\`, \`medium\`, or \`high\`, at least one evidence citation, and a rationale. A citation contains a kit-relative path, a locator, and the observation supported by that location.

## Reference-axis assessment

Assess every reference axis from \`evidence.json\` exactly once and in the listed order. Use \`aligned\`, \`within-permitted-variation\`, or \`divergent\`. Use \`within-permitted-variation\` only for a \`permitted-variability\` axis. Set \`permitted_variability_respected\` to false for any assessment that exceeds a frozen bound. Cite evidence for every assessment.

This kit contains ${axes.length} reference axes. A bounded-equivalence comparison is possible only when every critical and material axis aligns, all permitted variability is respected, and no critical divergence exists.

## Arithmetic and output

Keep the eight dimensions in the listed order. Set \`summary.total_score\` to their sum, \`maximum_score\` to 32, and \`mean_score\` to the sum divided by 8. Complete \`reference_summary\` from the axis assessments. Write the draft as JSON using \`grade-template.json\`. Do not add a \`grade_id\`; finalization adds the content address.
`;
}

function gradeTemplate(subject, cliBaseline, axes) {
  return {
    semantic_grade_version: "1",
    evidence_id: "copy-from-evidence.json",
    subject,
    cli_baseline: cliBaseline,
    evaluator_id: "replace-with-independent-evaluator-id",
    dimensions: SEMANTIC_DIMENSIONS.map((id) => ({
      id,
      score: 0,
      confidence: "low",
      citations: [{ path: "replace-with-kit-relative-path", locator: "replace-with-location", observation: "replace-with-observation" }],
      rationale: "replace-with-rationale"
    })),
    reference_assessments: axes.map((axis) => ({
      ...axis,
      alignment: "aligned",
      permitted_variability_respected: true,
      confidence: "low",
      citations: [{ path: "replace-with-kit-relative-path", locator: "replace-with-location", observation: "replace-with-observation" }],
      rationale: "replace-with-rationale"
    })),
    summary: { total_score: 0, maximum_score: 32, mean_score: 0 },
    reference_summary: {
      axis_count: axes.length,
      aligned_count: axes.length,
      within_permitted_variation_count: 0,
      divergent_count: 0,
      critical_divergences: [],
      permitted_variability_respected: true
    },
    limitations: []
  };
}

const options = parseArguments(process.argv.slice(2));
const runDirectory = path.resolve(options.run);
const outputRoot = path.resolve(options.out);
const contract = await verifyRunContract(runDirectory);
const resultContent = await readFile(path.join(runDirectory, "run-result.json"), "utf8");
const result = JSON.parse(resultContent);
if (result.outcome !== "completed") throw new Error("Semantic grading requires a completed run");
if (result.contract_id !== contract.contract_id || result.run_id !== contract.run_id) {
  throw new Error("Run result identity does not match the frozen contract");
}
const { run_result_id: ignoredResultId, ...resultBody } = result;
void ignoredResultId;
const expectedResultId = contentId("run-result", resultBody);
if (result.run_result_id !== expectedResultId) throw new Error("Run result content address is invalid");
if (contract.subject.format_version !== "2") throw new Error("Semantic grading requires subject format version 2");

const subjectRoot = runPath(runDirectory, "control/subject", "control subject path");
const subject = parseYaml(await readFile(path.join(subjectRoot, "subject.yaml"), "utf8"));
if (subject.authoring_eval_subject_version !== "2" || subject.id !== contract.subject.id) {
  throw new Error("Frozen subject-v2 identity does not match the run contract");
}
const reference = normalizeReference(subject.reference);
const axes = referenceAxes(reference);
const packageRoot = runPath(runDirectory, contract.workspace.package, "final package path");
const authoringStateRoot = runPath(runDirectory, contract.workspace.state, "final authoring state path");
await verifyFinalSnapshot(runDirectory, result.final_snapshots?.package, packageRoot, "final package snapshot");
await verifyFinalSnapshot(
  runDirectory,
  result.final_snapshots?.authoring_state,
  authoringStateRoot,
  "final authoring state snapshot"
);

await mkdir(outputRoot);
const files = [];
await copyTree(packageRoot, "final-package", "final-package", outputRoot, files);
const declaredSources = subject.starter?.sources ?? [];
if (!Array.isArray(declaredSources)) throw new Error("subject.starter.sources must be an array");
const declaredSourcePaths = new Set(declaredSources.map((source, index) => (
  safeRelative(source?.path, `subject.starter.sources[${index}].path`)
)));
for (const entry of reference.meaning) {
  if (!declaredSourcePaths.has(safeRelative(entry.source.path, `reference meaning ${entry.id} source path`))) {
    throw new Error(`Reference meaning ${entry.id} cites source material outside subject.starter.sources`);
  }
}
for (const [index, source] of declaredSources.entries()) {
  const sourceRelative = safeRelative(source.path, `subject.starter.sources[${index}].path`);
  const sourcePath = path.resolve(subjectRoot, sourceRelative);
  const boundary = path.relative(subjectRoot, sourcePath);
  if (boundary.startsWith("..") || path.isAbsolute(boundary)) throw new Error("Declared source escapes the frozen subject");
  const information = await lstat(sourcePath);
  if (!information.isFile() || information.isSymbolicLink()) throw new Error(`Declared source is not a regular file: ${sourceRelative}`);
  await writeEvidenceFile(
    outputRoot,
    `source-material/${sourceRelative}`,
    await readFile(sourcePath),
    "source-material",
    files
  );
}

const tokens = identityTokens(contract);
await copyTree(
  authoringStateRoot,
  "process/authoring-state",
  "sanitized-process",
  outputRoot,
  files,
  (content) => Buffer.from(blindText(content.toString("utf8"), tokens), "utf8")
);
for (const [field, destination, jsonLines] of [
  ["transcript", "process/transcript.jsonl", true],
  ["commands", "process/command-trace.jsonl", true],
  ["final_message", "process/final-message.md", false]
]) {
  const evidenceReference = result.evidence?.[field];
  if (!evidenceReference) {
    if (field === "final_message") continue;
    throw new Error(`Completed run has no ${field} evidence`);
  }
  const sourcePath = await verifyFileReference(runDirectory, evidenceReference, `${field} evidence`);
  const content = await readFile(sourcePath);
  const blinded = jsonLines
    ? blindJsonLines(content, `${field} evidence`, tokens)
    : Buffer.from(blindText(content.toString("utf8"), tokens), "utf8");
  await writeEvidenceFile(outputRoot, destination, blinded, "sanitized-process", files);
}
const referenceContent = `${JSON.stringify({ semantic_reference_version: "1", ...reference }, null, 2)}\n`;
await writeEvidenceFile(
  outputRoot,
  "reference-ledgers.json",
  referenceContent,
  "reference-ledgers",
  files
);

const subjectIdentity = {
  id: contract.subject.id,
  format_version: "2",
  digest: contract.snapshots.subject.digest
};
const cliBaseline = {
  version: contract.cli.version,
  protocol_release: contract.cli.protocol_release,
  source_digest: contract.snapshots.cli_source.digest
};
files.sort((left, right) => left.path.localeCompare(right.path, "en"));
const evidenceBody = {
  semantic_grade_evidence_version: "1",
  subject: subjectIdentity,
  cli_baseline: cliBaseline,
  dimensions: SEMANTIC_DIMENSIONS,
  reference_axes: axes,
  blinding: {
    runner_identity: "excluded",
    model_identity: "excluded",
    usage: "excluded",
    raw_evaluation_report: "excluded"
  },
  files
};
await writeEvidenceFile(
  outputRoot,
  "INSTRUCTIONS.md",
  instructions(axes),
  "instructions",
  files
);
await writeEvidenceFile(
  outputRoot,
  "grade-template.json",
  `${JSON.stringify(gradeTemplate(subjectIdentity, cliBaseline, axes), null, 2)}\n`,
  "instructions",
  files
);
files.sort((left, right) => left.path.localeCompare(right.path, "en"));

const evidenceIdentityBody = { ...evidenceBody, files };
const evidenceId = contentId("semantic-grade-evidence", evidenceIdentityBody);
const evidence = {
  ...evidenceBody,
  files,
  evidence_id: evidenceId
};
await writeFile(
  path.join(outputRoot, "evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" }
);
process.stdout.write(`${JSON.stringify({
  evidence_id: evidenceId,
  subject: subjectIdentity,
  cli_baseline: cliBaseline,
  files: files.length,
  reference_axes: axes.length,
  output: outputRoot,
  canonical_identity: sha256(canonicalJson(evidenceIdentityBody))
}, null, 2)}\n`);
