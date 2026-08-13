import Ajv2020 from "ajv/dist/2020.js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, contentId } from "./lib/run-contract.mjs";

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(scriptRoot, "../schemas/semantic-grade.schema.json");

function parseArguments(argv) {
  const options = { grades: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!["--grade", "--out"].includes(name) || !value) {
      throw new Error(
        "Usage: compare-semantic-grades.mjs --grade <json> --grade <json> [--out <json>]"
      );
    }
    if (name === "--grade") options.grades.push(value);
    else options.out = value;
  }
  if (options.grades.length < 2) throw new Error("At least two --grade values are required");
  return options;
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function schemaErrors(validate) {
  return (validate.errors ?? []).map((error) => (
    `${error.instancePath || "/"} ${error.message}`
  )).join("; ");
}

function gradeAxes(grade) {
  return grade.reference_assessments.map(({ axis_id: axisId, reference_kind: kind, reference_id: id, level }) => ({
    axis_id: axisId,
    reference_kind: kind,
    reference_id: id,
    level
  }));
}

function validateGradeSemantics(grade, gradePath) {
  const total = grade.dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  if (grade.summary.total_score !== total
      || grade.summary.maximum_score !== 32
      || grade.summary.mean_score !== total / 8) {
    throw new Error(`Semantic grade arithmetic is invalid: ${gradePath}`);
  }
  const axisIds = new Set();
  for (const assessment of grade.reference_assessments) {
    if (assessment.axis_id !== `${assessment.reference_kind}:${assessment.reference_id}`) {
      throw new Error(`Semantic grade has an invalid reference-axis identity: ${gradePath}`);
    }
    if (axisIds.has(assessment.axis_id)) {
      throw new Error(`Semantic grade has a duplicate reference axis: ${gradePath}`);
    }
    axisIds.add(assessment.axis_id);
    if (assessment.reference_kind === "permitted-variability") {
      if (assessment.permitted_variability_respected !== (assessment.alignment !== "divergent")) {
        throw new Error(`Semantic grade has an inconsistent variability result: ${gradePath}`);
      }
    } else if (assessment.alignment === "within-permitted-variation"
        || !assessment.permitted_variability_respected) {
      throw new Error(`Semantic grade misuses a permitted-variability result: ${gradePath}`);
    }
  }
  const expectedReferenceSummary = {
    axis_count: grade.reference_assessments.length,
    aligned_count: grade.reference_assessments.filter(({ alignment }) => alignment === "aligned").length,
    within_permitted_variation_count: grade.reference_assessments.filter(({ alignment }) => (
      alignment === "within-permitted-variation"
    )).length,
    divergent_count: grade.reference_assessments.filter(({ alignment }) => alignment === "divergent").length,
    critical_divergences: grade.reference_assessments.filter(({ level, alignment }) => (
      level === "critical" && alignment === "divergent"
    )).map(({ axis_id: axisId }) => axisId),
    permitted_variability_respected: grade.reference_assessments.every((assessment) => (
      assessment.permitted_variability_respected
    ))
  };
  if (!same(grade.reference_summary, expectedReferenceSummary)) {
    throw new Error(`Semantic grade reference arithmetic is invalid: ${gradePath}`);
  }
}

const options = parseArguments(process.argv.slice(2));
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const grades = [];
for (const gradeInput of options.grades) {
  const gradePath = path.resolve(gradeInput);
  const grade = JSON.parse(await readFile(gradePath, "utf8"));
  if (!validate(grade)) {
    throw new Error(`Invalid semantic grade ${gradePath}: ${schemaErrors(validate)}`);
  }
  const { grade_id: ignored, ...body } = grade;
  void ignored;
  const expectedId = contentId("semantic-grade", body);
  if (grade.grade_id !== expectedId) {
    throw new Error(`Semantic grade content address is invalid: ${gradePath}`);
  }
  validateGradeSemantics(grade, gradePath);
  grades.push(grade);
}

const baseline = {
  subject: grades[0].subject,
  cli_baseline: grades[0].cli_baseline
};
for (const grade of grades.slice(1)) {
  if (!same(grade.subject, baseline.subject)) {
    throw new Error("Compared semantic grades must use the same frozen subject");
  }
  if (!same(grade.cli_baseline, baseline.cli_baseline)) {
    throw new Error("Compared semantic grades must use the same CLI baseline");
  }
  if (!same(gradeAxes(grade), gradeAxes(grades[0]))) {
    throw new Error("Compared semantic grades must assess the same frozen reference axes");
  }
}
if (new Set(grades.map(({ grade_id: gradeId }) => gradeId)).size !== grades.length
    || new Set(grades.map(({ evidence_id: evidenceId }) => evidenceId)).size !== grades.length) {
  throw new Error("Semantic comparison requires distinct authoring-result evidence grades");
}

const eligibleAxes = gradeAxes(grades[0]).filter(({ level }) => (
  level === "critical" || level === "material"
));
const eligibleIds = new Set(eligibleAxes.map(({ axis_id: axisId }) => axisId));
const criticalIds = new Set(eligibleAxes.filter(({ level }) => level === "critical")
  .map(({ axis_id: axisId }) => axisId));
const divergentAxes = [...new Set(grades.flatMap((grade) => (
  grade.reference_assessments.filter(({ axis_id: axisId, alignment }) => (
    eligibleIds.has(axisId) && alignment === "divergent"
  )).map(({ axis_id: axisId }) => axisId)
)))];
const criticalDivergences = divergentAxes.filter((axisId) => criticalIds.has(axisId));
const criticalAxesAligned = grades.every((grade) => grade.reference_assessments.every((assessment) => (
  !criticalIds.has(assessment.axis_id) || assessment.alignment !== "divergent"
)));
const materialAxesAligned = grades.every((grade) => grade.reference_assessments.every((assessment) => (
  assessment.level !== "material" || assessment.alignment !== "divergent"
)));
const permittedVariabilityRespected = grades.every((grade) => (
  grade.reference_assessments.every((assessment) => assessment.permitted_variability_respected)
));
const noCriticalDivergence = criticalDivergences.length === 0;
const boundedEquivalenceClaimed = eligibleAxes.length > 0
  && criticalAxesAligned
  && materialAxesAligned
  && permittedVariabilityRespected
  && noCriticalDivergence;

const comparisonBody = {
  semantic_grade_comparison_version: "1",
  subject: baseline.subject,
  cli_baseline: baseline.cli_baseline,
  grades: grades.map((grade) => ({
    grade_id: grade.grade_id,
    evidence_id: grade.evidence_id,
    evaluator_id: grade.evaluator_id,
    dimensions: grade.dimensions,
    summary: grade.summary,
    reference_assessments: grade.reference_assessments,
    reference_summary: grade.reference_summary,
    limitations: grade.limitations
  })),
  bounded_equivalence: {
    claimed: boundedEquivalenceClaimed,
    basis: "frozen-reference-axes",
    eligible_axis_count: eligibleAxes.length,
    critical_axes_aligned: criticalAxesAligned,
    material_axes_aligned: materialAxesAligned,
    permitted_variability_respected: permittedVariabilityRespected,
    no_critical_divergence: noCriticalDivergence,
    divergent_axes: divergentAxes,
    critical_divergences: criticalDivergences,
    digest_equality_used: false
  },
  limitations: [
    "Equivalence is bounded by the frozen subject reference ledgers.",
    "Dimension scores remain independent judgments and are not averaged into equivalence.",
    "Content digest equality is not semantic-equivalence evidence."
  ]
};
const comparison = {
  ...comparisonBody,
  comparison_id: contentId("semantic-grade-comparison", comparisonBody)
};
const serialized = `${JSON.stringify(comparison, null, 2)}\n`;
if (options.out) {
  await writeFile(path.resolve(options.out), serialized, { encoding: "utf8", flag: "wx" });
}
process.stdout.write(serialized);
