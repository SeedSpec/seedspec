import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { inspectPackage } from "./inspect.js";
import { validatePackage } from "./validate.js";

export const TRUSTED_EVIDENCE_RUNNERS = Object.freeze([
  "tool",
  "independent-agent",
  "human"
]);

const UNTRUSTED_EVIDENCE_RUNNERS = Object.freeze(["implementing-agent"]);

function moduleAppliesToCriterion(module, criterionId) {
  const selected = module.applies_to?.success_criteria;
  return !selected || selected.includes(criterionId);
}

function evaluationModulesFor(modules, criterionId) {
  return modules.filter((module) => (
    module.type === "evaluation" && moduleAppliesToCriterion(module, criterionId)
  ));
}

export function coverageFromInspection(inspection) {
  const criteria = inspection.success?.criteria ?? [];
  const capabilities = inspection.capabilities?.items ?? [];
  const tasks = inspection.tasks?.items ?? [];
  const modules = inspection.context_modules ?? [];
  const anchored = new Set(inspection.success_anchors.map(({ id }) => id));
  const evaluationModules = modules.filter(({ type }) => type === "evaluation");

  const criterionRecords = criteria.map((criterion) => {
    const evaluations = evaluationModulesFor(evaluationModules, criterion.id);
    return {
      id: criterion.id,
      description: criterion.description,
      anchored: anchored.has(criterion.id),
      enforceable: evaluations.length > 0,
      evaluation_modules: evaluations.map(({ id }) => id),
      capabilities: capabilities
        .filter((capability) => (capability.success_criteria ?? []).includes(criterion.id))
        .map(({ id }) => id),
      tasks: tasks
        .filter((task) => (task.success_criteria ?? []).includes(criterion.id))
        .map(({ id }) => id)
    };
  });

  return {
    criteria: criterionRecords,
    capabilities: capabilities.map((capability) => ({
      id: capability.id,
      name: capability.name,
      success_criteria: capability.success_criteria ?? [],
      outcomes: (capability.outcomes ?? []).map(({ id, description }) => ({ id, description }))
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      instruction: task.instruction,
      success_criteria: task.success_criteria ?? [],
      capabilities: task.capabilities ?? []
    })),
    evaluation_modules: evaluationModules.map((module) => ({
      id: module.id,
      description: module.description,
      path: module.path,
      success_criteria: module.applies_to?.success_criteria ?? null,
      stages: module.applies_to?.stages ?? []
    })),
    context_modules: modules.map((module) => ({
      id: module.id,
      type: module.type,
      description: module.description,
      path: module.path
    })),
    unanchored_criteria: criterionRecords.filter(({ anchored }) => !anchored).map(({ id }) => id),
    unenforceable_criteria: criterionRecords
      .filter(({ enforceable }) => !enforceable)
      .map(({ id }) => id)
  };
}

function coverageIssues(coverage, { strict = false } = {}) {
  const issues = [];
  if (coverage.criteria.length === 0) {
    issues.push({
      severity: strict ? "error" : "warning",
      code: "NO_SUCCESS_CRITERIA",
      message: "Package declares no success criteria, so nothing is enforceable"
    });
  }
  for (const id of coverage.unanchored_criteria) {
    issues.push({
      severity: strict ? "error" : "warning",
      code: "UNANCHORED_CRITERION",
      message: `Success criterion ${id} is not anchored in SPEC.md`,
      criterion: id
    });
  }
  for (const id of coverage.unenforceable_criteria) {
    issues.push({
      severity: strict ? "error" : "warning",
      code: "UNENFORCEABLE_CRITERION",
      message: `Success criterion ${id} has no evaluation context module`,
      criterion: id
    });
  }
  return issues;
}

function authoringSurvey(coverage) {
  const prompts = [];
  if (coverage.unenforceable_criteria.length > 0) {
    prompts.push({
      id: "evaluation-coverage",
      prompt: "These claims cannot be enforced until they have an evaluation module. Add one, or say they are intentionally unenforceable.",
      items: coverage.unenforceable_criteria
    });
  }
  if (coverage.unanchored_criteria.length > 0) {
    prompts.push({
      id: "success-anchors",
      prompt: "These claims are not connected to specification prose. Anchor them with [success:<id>], or leave them as structured-only claims.",
      items: coverage.unanchored_criteria
    });
  }
  if (!coverage.context_modules.some(({ type }) => type === "implementation-profile")) {
    prompts.push({
      id: "hosting-profile",
      prompt: "No implementation profile is declared. Do you care where this is hosted, or is that an adopter choice?"
    });
  }
  if (!coverage.context_modules.some(({ type }) => type === "skill")) {
    prompts.push({
      id: "implementation-skill",
      prompt: "No skill module is attached. Do you want a design system, security baseline, or other implementation skill, or do you not care how it is built?"
    });
  }
  if (!coverage.context_modules.some(({ type }) => type === "policy")) {
    prompts.push({
      id: "policy",
      prompt: "No policy module is attached. Are there brand, security, or compliance constraints that should travel with the spec?"
    });
  }
  return prompts;
}

function objectValue(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseEvidenceDocument(raw, label = "Evidence") {
  const document = typeof raw === "string" ? parseYaml(raw) : raw;
  if (!objectValue(document)) {
    throw new SeedSpecError(`${label} must contain a mapping`, {
      code: "INVALID_EVIDENCE"
    });
  }
  const checks = document.checks;
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new SeedSpecError(`${label} must include a non-empty checks array`, {
      code: "INVALID_EVIDENCE"
    });
  }
  const runner = objectValue(document.runner) ? document.runner : {};
  return {
    evidence_version: document.evidence_version ?? "0.4",
    package_id: document.package_id ?? null,
    package_digest: document.package_digest ?? null,
    runner: {
      id: typeof runner.id === "string" && runner.id ? runner.id : "unspecified",
      kind: typeof runner.kind === "string" && runner.kind ? runner.kind : "implementing-agent"
    },
    recorded_at: document.recorded_at ?? null,
    checks: checks.map((check, index) => {
      if (!objectValue(check) || typeof check.id !== "string" || !check.id) {
        throw new SeedSpecError(`${label} check ${index} is missing id`, {
          code: "INVALID_EVIDENCE"
        });
      }
      return {
        id: check.id,
        criterion: typeof check.criterion === "string" && check.criterion
          ? check.criterion
          : check.id,
        description: typeof check.description === "string" ? check.description : null,
        passed: check.passed === true,
        error: typeof check.error === "string" ? check.error : null
      };
    })
  };
}

export function evidenceFromEvaluation(inspection, evaluation, runner = {}) {
  const checks = Array.isArray(evaluation?.checks) ? evaluation.checks : [];
  if (checks.length === 0) {
    throw new SeedSpecError("Evaluator produced no checks", {
      code: "INVALID_EVALUATION"
    });
  }
  return parseEvidenceDocument({
    evidence_version: "0.4",
    package_id: inspection.id,
    package_digest: inspection.digest,
    runner: {
      id: runner.id ?? "external-evaluator",
      kind: runner.kind ?? "tool"
    },
    recorded_at: new Date().toISOString(),
    checks
  });
}

function trustedRunner(kind) {
  return TRUSTED_EVIDENCE_RUNNERS.includes(kind);
}

export function verifyEvidence(inspection, coverage, evidence) {
  const issues = [];
  if (evidence.package_digest && evidence.package_digest !== inspection.digest) {
    issues.push({
      severity: "error",
      code: "EVIDENCE_DIGEST_MISMATCH",
      message: `Evidence is bound to ${evidence.package_digest}, not ${inspection.digest}`
    });
  }
  if (evidence.package_id && evidence.package_id !== inspection.id) {
    issues.push({
      severity: "error",
      code: "EVIDENCE_PACKAGE_MISMATCH",
      message: `Evidence is bound to package ${evidence.package_id}, not ${inspection.id}`
    });
  }
  if (!trustedRunner(evidence.runner.kind)) {
    issues.push({
      severity: "error",
      code: UNTRUSTED_EVIDENCE_RUNNERS.includes(evidence.runner.kind)
        ? "UNTRUSTED_EVIDENCE_RUNNER"
        : "UNKNOWN_EVIDENCE_RUNNER",
      message: `Runner kind ${evidence.runner.kind} cannot certify verification. Use ${TRUSTED_EVIDENCE_RUNNERS.join(", ")}.`
    });
  }

  const knownCriteria = new Set(coverage.criteria.map(({ id }) => id));
  const trusted = trustedRunner(evidence.runner.kind);
  const byCriterion = new Map();
  for (const check of evidence.checks) {
    if (!knownCriteria.has(check.criterion)) {
      issues.push({
        severity: "warning",
        code: "UNKNOWN_EVIDENCE_CRITERION",
        message: `Evidence check ${check.id} references unknown criterion ${check.criterion}`,
        criterion: check.criterion
      });
      continue;
    }
    const current = byCriterion.get(check.criterion) ?? [];
    current.push(check);
    byCriterion.set(check.criterion, current);
  }

  const criterion_results = coverage.criteria.map((criterion) => {
    const checks = byCriterion.get(criterion.id) ?? [];
    const passed = trusted && checks.length > 0 && checks.every(({ passed: value }) => value);
    if (criterion.enforceable && checks.length === 0) {
      issues.push({
        severity: "error",
        code: "MISSING_EVIDENCE",
        message: `No evidence for enforceable criterion ${criterion.id}`,
        criterion: criterion.id
      });
    } else if (criterion.enforceable && !passed) {
      issues.push({
        severity: "error",
        code: "FAILED_EVIDENCE",
        message: `Evidence failed for criterion ${criterion.id}`,
        criterion: criterion.id
      });
    }
    return {
      id: criterion.id,
      enforceable: criterion.enforceable,
      passed,
      checks: checks.map(({ id, passed: value, error }) => ({ id, passed: value, error }))
    };
  });

  const passed = criterion_results.filter(({ passed: value }) => value).length;
  const required = coverage.criteria.filter(({ enforceable }) => enforceable).length;
  return {
    runner: evidence.runner,
    package_digest: evidence.package_digest,
    trusted,
    passed,
    required,
    criterion_results,
    issues
  };
}

function decideStatus({ coverageIssues: issues, verification, strict }) {
  const errors = [
    ...issues,
    ...(verification?.issues ?? [])
  ].filter(({ severity }) => severity === "error");
  if (errors.length > 0) return "fail";
  if (verification) return "pass";
  if (strict) return "pass";
  if (issues.length > 0) return "review";
  return "pass";
}

export async function loadEvidenceFile(filePath) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch {
    throw new SeedSpecError(`Evidence file is not readable: ${filePath}`, {
      code: "EVIDENCE_NOT_FOUND"
    });
  }
  return parseEvidenceDocument(source, filePath);
}

export async function runEvaluator(scriptPath, workspace, { timeout = 60000 } = {}) {
  const script = path.resolve(scriptPath);
  const cwd = path.resolve(workspace);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, cwd], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), timeout);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
  let document;
  try {
    document = JSON.parse(result.stdout);
  } catch {
    throw new SeedSpecError(`Evaluator did not print JSON: ${script}`, {
      code: "INVALID_EVALUATION",
      details: [result.stderr, result.stdout].filter(Boolean)
    });
  }
  if (!objectValue(document) || !Array.isArray(document.checks)) {
    throw new SeedSpecError(`Evaluator JSON must include a checks array: ${script}`, {
      code: "INVALID_EVALUATION"
    });
  }
  return document;
}

export async function checkPackage(inputPath, options = {}) {
  const record = await validatePackage(inputPath);
  const inspection = await inspectPackage(inputPath);
  const coverage = coverageFromInspection(inspection);
  const issues = coverageIssues(coverage, { strict: options.strict === true });
  let evaluation = null;
  let evidence = null;
  if (options.evaluate) {
    if (!options.workspace) {
      throw new SeedSpecError("seedspec check --evaluate requires --workspace", {
        code: "MISSING_OPTION_VALUE"
      });
    }
    evaluation = await runEvaluator(options.evaluate, options.workspace, {
      timeout: options.timeout
    });
    evidence = evidenceFromEvaluation(inspection, evaluation, options.runner);
  } else if (options.evidence) {
    evidence = typeof options.evidence === "string"
      ? await loadEvidenceFile(options.evidence)
      : parseEvidenceDocument(options.evidence);
  }
  const verification = evidence
    ? verifyEvidence(inspection, coverage, evidence)
    : null;
  const allIssues = [...issues, ...(verification?.issues ?? [])];
  return {
    check_version: "0.4",
    status: decideStatus({
      coverageIssues: issues,
      verification,
      strict: options.strict === true
    }),
    package: {
      id: record.manifest.id,
      name: record.manifest.name,
      kind: record.manifest.kind ?? null,
      version: record.manifest.version,
      digest: record.digest
    },
    coverage,
    verification,
    evaluation: evaluation
      ? {
          passed: evaluation.passed ?? null,
          total: evaluation.total ?? evaluation.checks.length,
          checks: evaluation.checks
        }
      : null,
    survey: authoringSurvey(coverage),
    issues: allIssues
  };
}

export function formatCheck(report) {
  const mark = {
    pass: "PASS",
    fail: "FAIL",
    review: "REVIEW"
  }[report.status] ?? report.status.toUpperCase();
  const lines = [
    `${mark} ${report.package.name} (${report.package.id}@${report.package.version})`,
    `Digest: ${report.package.digest}`,
    `Criteria: ${report.coverage.criteria.length}`,
    `Anchored: ${report.coverage.criteria.length - report.coverage.unanchored_criteria.length}`,
    `Enforceable: ${report.coverage.criteria.length - report.coverage.unenforceable_criteria.length}`,
    `Unanchored: ${report.coverage.unanchored_criteria.length}`,
    `Unenforceable: ${report.coverage.unenforceable_criteria.length}`,
    `Evaluation modules: ${report.coverage.evaluation_modules.length}`
  ];
  if (report.verification) {
    lines.push(
      `Evidence runner: ${report.verification.runner.kind}/${report.verification.runner.id}`,
      `Trusted evidence: ${report.verification.trusted ? "yes" : "no"}`,
      `Verified criteria: ${report.verification.passed}/${report.verification.required}`
    );
  }
  if (report.coverage.criteria.length > 0) {
    lines.push("", "Criteria:");
    for (const criterion of report.coverage.criteria) {
      const result = report.verification?.criterion_results
        .find(({ id }) => id === criterion.id);
      const state = result
        ? result.passed ? "pass" : "fail"
        : criterion.enforceable ? "enforceable" : "unenforceable";
      const anchored = criterion.anchored ? "anchored" : "unanchored";
      lines.push(`  [${state}] ${criterion.id} (${anchored})`);
    }
  }
  const notable = report.issues.filter(({ severity }) => (
    report.status === "fail" ? severity === "error" : true
  ));
  if (notable.length > 0) {
    lines.push("", "Issues:");
    for (const issue of notable) {
      lines.push(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
    }
  }
  if (report.survey.length > 0 && !report.verification) {
    lines.push("", "Authoring survey:");
    for (const item of report.survey) {
      lines.push(`  - ${item.prompt}`);
      if (item.items?.length) lines.push(`    ${item.items.join(", ")}`);
    }
  }
  return lines.join("\n");
}
