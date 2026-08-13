import Ajv2020 from "ajv/dist/2020.js";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, contentId, sha256 } from "./lib/run-contract.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(scriptRoot, "../schemas/semantic-grade.schema.json");
const dimensions = [
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
    if (!["--draft", "--evidence", "--out"].includes(name) || !value) {
      throw new Error(
        "Usage: finalize-semantic-grade.mjs --draft <json> --evidence <kit/evidence.json> [--out <json>]"
      );
    }
    options[name.slice(2)] = value;
  }
  if (!options.draft || !options.evidence) throw new Error("--draft and --evidence are required");
  return options;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${label} fields must be exactly: ${wanted.join(", ")}`);
  }
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function safeEvidencePath(root, relativePath, label) {
  if (typeof relativePath !== "string" || relativePath === "" || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a nonempty relative path`);
  }
  if (relativePath.includes("\\") || relativePath.split("/").includes("..")) {
    throw new Error(`${label} must be a safe portable path`);
  }
  const resolved = path.resolve(root, relativePath);
  const boundary = path.relative(path.resolve(root), resolved);
  if (boundary.startsWith("..") || path.isAbsolute(boundary)) throw new Error(`${label} escapes the evidence kit`);
  return resolved;
}

function validateEvidenceShape(evidence) {
  exactKeys(evidence, [
    "semantic_grade_evidence_version",
    "subject",
    "cli_baseline",
    "dimensions",
    "reference_axes",
    "blinding",
    "files",
    "evidence_id"
  ], "evidence manifest");
  if (evidence.semantic_grade_evidence_version !== "1") {
    throw new Error("semantic_grade_evidence_version must be 1");
  }
  exactKeys(evidence.subject, ["id", "format_version", "digest"], "evidence subject");
  if (typeof evidence.subject.id !== "string" || !evidence.subject.id
      || evidence.subject.format_version !== "2"
      || !/^sha256:[a-f0-9]{64}$/u.test(evidence.subject.digest ?? "")) {
    throw new Error("Evidence subject identity is invalid");
  }
  exactKeys(evidence.cli_baseline, ["version", "protocol_release", "source_digest"], "CLI baseline");
  if (typeof evidence.cli_baseline.version !== "string" || !evidence.cli_baseline.version
      || typeof evidence.cli_baseline.protocol_release !== "string" || !evidence.cli_baseline.protocol_release
      || !/^sha256:[a-f0-9]{64}$/u.test(evidence.cli_baseline.source_digest ?? "")) {
    throw new Error("Evidence CLI baseline is invalid");
  }
  if (!same(evidence.dimensions, dimensions)) throw new Error("Evidence dimensions are not the exact semantic rubric");
  exactKeys(evidence.blinding, [
    "runner_identity",
    "model_identity",
    "usage",
    "raw_evaluation_report"
  ], "evidence blinding declaration");
  if (Object.values(evidence.blinding).some((value) => value !== "excluded")) {
    throw new Error("Evidence blinding exclusions are invalid");
  }
  if (!Array.isArray(evidence.reference_axes)) throw new Error("evidence.reference_axes must be an array");
  const axisIds = new Set();
  for (const [index, axis] of evidence.reference_axes.entries()) {
    exactKeys(axis, ["axis_id", "reference_kind", "reference_id", "level"], `reference axis ${index}`);
    if (typeof axis.axis_id !== "string" || !axis.axis_id
        || typeof axis.reference_id !== "string" || !axis.reference_id
        || ![
          "meaning",
          "decision",
          "obligation",
          "permitted-variability",
          "forbidden-invention",
          "protected-path"
        ].includes(axis.reference_kind)
        || !["critical", "material", "minor"].includes(axis.level)) {
      throw new Error(`Reference axis ${index} is invalid`);
    }
    if (axis.axis_id !== `${axis.reference_kind}:${axis.reference_id}`) {
      throw new Error(`Reference axis ${axis.axis_id} has an invalid content identity`);
    }
    if (axisIds.has(axis.axis_id)) throw new Error(`Duplicate reference axis: ${axis.axis_id}`);
    axisIds.add(axis.axis_id);
  }
  if (!Array.isArray(evidence.files) || evidence.files.length === 0) {
    throw new Error("evidence.files must be a nonempty array");
  }
  const paths = new Set();
  let priorPath = null;
  for (const [index, file] of evidence.files.entries()) {
    exactKeys(file, ["path", "role", "digest", "bytes"], `evidence file ${index}`);
    if (typeof file.path !== "string" || !file.path
        || !["final-package", "source-material", "sanitized-process", "reference-ledgers", "instructions"].includes(file.role)
        || !/^sha256:[a-f0-9]{64}$/u.test(file.digest ?? "")
        || !Number.isInteger(file.bytes) || file.bytes < 0) {
      throw new Error(`Evidence file ${index} is invalid`);
    }
    if (paths.has(file.path)) throw new Error(`Duplicate evidence path: ${file.path}`);
    if (priorPath !== null && priorPath.localeCompare(file.path, "en") >= 0) {
      throw new Error("Evidence files must be sorted by path");
    }
    paths.add(file.path);
    priorPath = file.path;
  }
  const { evidence_id: ignored, ...identityBody } = evidence;
  void ignored;
  const expectedId = contentId("semantic-grade-evidence", identityBody);
  if (evidence.evidence_id !== expectedId) {
    throw new Error(`Evidence content address is invalid; expected ${expectedId}`);
  }
}

async function verifyEvidenceFiles(evidencePath, evidence) {
  const root = path.dirname(path.resolve(evidencePath));
  for (const file of evidence.files) {
    const absolute = safeEvidencePath(root, file.path, `evidence file ${file.path}`);
    const information = await lstat(absolute);
    if (!information.isFile() || information.isSymbolicLink()) {
      throw new Error(`Evidence path is not a regular file: ${file.path}`);
    }
    const content = await readFile(absolute);
    if (content.byteLength !== file.bytes || sha256(content) !== file.digest) {
      throw new Error(`Evidence file identity changed: ${file.path}`);
    }
  }
}

function schemaErrors(validate) {
  return (validate.errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message}`;
  }).join("; ");
}

function validateCitations(grade, evidence) {
  const evidenceByPath = new Map(evidence.files.map((file) => [file.path, file]));
  const citedItems = [...grade.dimensions, ...grade.reference_assessments];
  for (const item of citedItems) {
    for (const citation of item.citations) {
      const file = evidenceByPath.get(citation.path);
      if (!file) throw new Error(`Citation names evidence outside the frozen kit: ${citation.path}`);
      if (file.role === "instructions") throw new Error(`Citation cannot use grading instructions: ${citation.path}`);
    }
  }
}

function validateArithmetic(grade) {
  const total = grade.dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  if (grade.summary.total_score !== total
      || grade.summary.maximum_score !== 32
      || grade.summary.mean_score !== total / dimensions.length) {
    throw new Error(`Grade arithmetic is invalid; expected total ${total}, maximum 32, and mean ${total / 8}`);
  }
  const assessments = grade.reference_assessments;
  const expectedReferenceSummary = {
    axis_count: assessments.length,
    aligned_count: assessments.filter(({ alignment }) => alignment === "aligned").length,
    within_permitted_variation_count: assessments.filter(({ alignment }) => (
      alignment === "within-permitted-variation"
    )).length,
    divergent_count: assessments.filter(({ alignment }) => alignment === "divergent").length,
    critical_divergences: assessments.filter(({ level, alignment }) => (
      level === "critical" && alignment === "divergent"
    )).map(({ axis_id: axisId }) => axisId),
    permitted_variability_respected: assessments.every(({ permitted_variability_respected: respected }) => respected)
  };
  if (!same(grade.reference_summary, expectedReferenceSummary)) {
    throw new Error(`Reference-summary arithmetic is invalid; expected ${canonicalJson(expectedReferenceSummary)}`);
  }
}

function validateReferenceAssessments(grade, evidence) {
  if (grade.reference_assessments.length !== evidence.reference_axes.length) {
    throw new Error("Grade must assess every frozen reference axis exactly once");
  }
  grade.reference_assessments.forEach((assessment, index) => {
    const expected = evidence.reference_axes[index];
    const identity = {
      axis_id: assessment.axis_id,
      reference_kind: assessment.reference_kind,
      reference_id: assessment.reference_id,
      level: assessment.level
    };
    if (!same(identity, expected)) {
      throw new Error(`Reference assessment ${index} does not match frozen axis ${expected.axis_id}`);
    }
    if (assessment.reference_kind === "permitted-variability") {
      const respectsBound = assessment.alignment !== "divergent";
      if (assessment.permitted_variability_respected !== respectsBound) {
        throw new Error(`Permitted-variability result is inconsistent for ${assessment.axis_id}`);
      }
    } else {
      if (assessment.alignment === "within-permitted-variation") {
        throw new Error(`Only permitted-variability axes can use within-permitted-variation: ${assessment.axis_id}`);
      }
      if (!assessment.permitted_variability_respected) {
        throw new Error(`Non-variability axis cannot declare a variability violation: ${assessment.axis_id}`);
      }
    }
  });
}

const options = parseArguments(process.argv.slice(2));
const evidencePath = path.resolve(options.evidence);
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
validateEvidenceShape(evidence);
await verifyEvidenceFiles(evidencePath, evidence);
const draft = JSON.parse(await readFile(path.resolve(options.draft), "utf8"));
if (!isRecord(draft)) throw new Error("Semantic grade draft must be an object");
if (Object.hasOwn(draft, "grade_id")) throw new Error("Semantic grade draft must not contain grade_id");
if (draft.evidence_id !== evidence.evidence_id
    || !same(draft.subject, evidence.subject)
    || !same(draft.cli_baseline, evidence.cli_baseline)) {
  throw new Error("Grade evidence identity does not match the frozen evidence kit");
}
if (!same(draft.dimensions?.map(({ id }) => id), dimensions)) {
  throw new Error("Grade must contain the eight exact dimensions in rubric order");
}
const grade = { ...draft, grade_id: contentId("semantic-grade", draft) };
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
if (!validate(grade)) throw new Error(`Semantic grade schema validation failed: ${schemaErrors(validate)}`);
validateReferenceAssessments(grade, evidence);
validateCitations(grade, evidence);
validateArithmetic(grade);
const serialized = `${JSON.stringify(grade, null, 2)}\n`;
if (options.out) {
  await writeFile(path.resolve(options.out), serialized, { encoding: "utf8", flag: "wx" });
}
process.stdout.write(serialized);
