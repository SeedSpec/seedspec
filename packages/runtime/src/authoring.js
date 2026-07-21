import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { lintPackage } from "./lint.js";
import { validatePackage } from "./validate.js";

export const AUTHORING_INSTRUCTION_FORMAT = "0.1";
export const AUTHORING_RESULT_FORMAT = "0.1";
export const AUTHORING_STATE_FORMAT = "0.1";

export const AUTHORING_AREAS = Object.freeze([
  "concern-separation",
  "kind-aware-discovery",
  "material-ambiguity",
  "internal-consistency",
  "progressive-hardening",
  "agent-ready-handoff"
]);

const AUTHORING_TARGETS = Object.freeze([
  "capture",
  "shape",
  "harden",
  "compose",
  "package"
]);

const TERMINAL_OUTCOMES = new Set(["completed", "abandoned", "superseded"]);
const RESULT_OUTCOMES = new Set(["in-progress", "needs-author", ...TERMINAL_OUTCOMES]);

const areaTitles = Object.freeze({
  "concern-separation": "Concern separation",
  "kind-aware-discovery": "Kind-aware discovery",
  "material-ambiguity": "Material ambiguity",
  "internal-consistency": "Internal consistency",
  "progressive-hardening": "Progressive hardening",
  "agent-ready-handoff": "Agent-ready handoff"
});

const kindLenses = Object.freeze({
  solution: [
    "the intended compound outcome and its boundary",
    "participants, dependencies, and authority",
    "coordination, state changes, and failure behavior",
    "observable evidence that the overall outcome works"
  ],
  application: [
    "actors, roles, and permission boundaries",
    "domain concepts, rules, state, and lifecycle behavior",
    "primary and exceptional workflows",
    "failure, conflict, and recovery behavior",
    "observable product success"
  ],
  feature: [
    "the host boundary and behavior the feature must not replace",
    "behavior added or changed",
    "required and provided capabilities plus integration expectations",
    "configurable variation and host-safe failure behavior",
    "host-independent observable acceptance"
  ],
  workflow: [
    "participants, responsibilities, and authority",
    "starting conditions, stages, decisions, and handoffs",
    "information passed between participants",
    "interruption, retry, compensation, escalation, and duplicate handling",
    "evidence that the workflow completed faithfully"
  ],
  automation: [
    "trigger, schedule, cadence, and timezone behavior",
    "operational ownership and allowed side effects",
    "processing rules, idempotency, duplicate prevention, and replay",
    "retries, terminal failure, monitoring, alerting, and recovery",
    "evidence for each run's outcome"
  ],
  configuration: [
    "desired state and target boundary",
    "existing-state discovery, access, ownership, and naming",
    "safe reruns, drift, reconciliation, and duplicate prevention",
    "rollback and partial-state recovery",
    "durable verification evidence"
  ],
  integration: [
    "participating systems and cross-system outcome",
    "concept, record, field, and meaning mappings",
    "source authority, directionality, timing, ordering, and reconciliation",
    "authorization, credential ownership, and prohibited access",
    "partial failure, retries, idempotency, duplicates, and verification"
  ]
});

function areaTitle(area) {
  return areaTitles[area] ?? area;
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative));
}

function defaultStateDirectory(packageRoot) {
  return `${packageRoot}.seedspec-authoring`;
}

function resolveStateDirectory(packageRoot, requested) {
  const stateRoot = path.resolve(requested ?? defaultStateDirectory(packageRoot));
  if (isWithin(packageRoot, stateRoot)) {
    throw new SeedSpecError("Authoring state must remain outside the distributable SeedSpec package", {
      code: "AUTHORING_STATE_INSIDE_PACKAGE",
      details: [`package: ${packageRoot}`, `state: ${stateRoot}`]
    });
  }
  return stateRoot;
}

async function readYaml(filePath, label) {
  try {
    return parseYaml(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new SeedSpecError(`Cannot read ${label}: ${filePath}`, {
      code: "INVALID_AUTHORING_STATE",
      details: [error.message]
    });
  }
}

async function writeIfMissing(filePath, content) {
  try {
    await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}

function assertArea(area) {
  if (!AUTHORING_AREAS.includes(area)) {
    throw new SeedSpecError(`Unknown authoring audit area: ${area}`, {
      code: "INVALID_AUTHORING_AREA",
      details: [`supported: ${AUTHORING_AREAS.join(", ")}`]
    });
  }
}

function assertTarget(target) {
  if (!AUTHORING_TARGETS.includes(target)) {
    throw new SeedSpecError(`Unknown authoring target: ${target}`, {
      code: "INVALID_AUTHORING_TARGET",
      details: [`supported: ${AUTHORING_TARGETS.join(", ")}`]
    });
  }
}

function requiredResultShape(request) {
  return {
    authoring_result_version: AUTHORING_RESULT_FORMAT,
    pass: request.pass,
    area: request.area,
    protocol_version: request.protocol_version,
    tool_version: request.tool_version,
    package_digest_before: request.package_digest_before,
    package_digest_after: request.package_digest_before,
    outcome: "in-progress",
    summary: "",
    findings: [],
    questions: {
      asked: [],
      answered: [],
      deferred: []
    },
    changes: {
      applied: [],
      proposed: [],
      rejected: []
    },
    validation: {
      protocol_valid: true,
      commands: []
    }
  };
}

function validateResult(result, request) {
  const details = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    details.push("result must be a YAML object");
  } else {
    for (const [field, expected] of [
      ["authoring_result_version", AUTHORING_RESULT_FORMAT],
      ["pass", request.pass],
      ["area", request.area],
      ["protocol_version", request.protocol_version],
      ["tool_version", request.tool_version],
      ["package_digest_before", request.package_digest_before]
    ]) {
      if (result[field] !== expected) details.push(`${field} must equal ${JSON.stringify(expected)}`);
    }
    if (!RESULT_OUTCOMES.has(result.outcome)) {
      details.push(`outcome must be one of ${[...RESULT_OUTCOMES].join(", ")}`);
    }
    for (const field of ["findings"]) {
      if (!Array.isArray(result[field])) details.push(`${field} must be an array`);
    }
    for (const [group, fields] of Object.entries({
      questions: ["asked", "answered", "deferred"],
      changes: ["applied", "proposed", "rejected"]
    })) {
      if (!result[group] || typeof result[group] !== "object") {
        details.push(`${group} must be an object`);
      } else {
        for (const field of fields) {
          if (!Array.isArray(result[group][field])) details.push(`${group}.${field} must be an array`);
        }
      }
    }
    if (!result.validation || typeof result.validation !== "object"
      || !Array.isArray(result.validation.commands)) {
      details.push("validation.commands must be an array");
    }
    if (typeof result.package_digest_after !== "string" || !result.package_digest_after.startsWith("sha256:")) {
      details.push("package_digest_after must be a sha256 digest string");
    }
    if (result.outcome === "completed") {
      if (typeof result.summary !== "string" || result.summary.trim() === "") {
        details.push("summary must explain a completed pass");
      }
      if (result.validation?.protocol_valid !== true) {
        details.push("validation.protocol_valid must be true for a completed pass");
      }
      const commands = Array.isArray(result.validation?.commands)
        ? result.validation.commands
        : [];
      for (const operation of ["validate", "lint", "digest"]) {
        const operationPattern = new RegExp(`(?:^|\\s)${operation}(?:\\s|$)`);
        if (!commands.some((command) => operationPattern.test(command))) {
          details.push(`validation.commands must record a ${operation} command`);
        }
      }
    }
  }
  if (details.length > 0) {
    throw new SeedSpecError(`Invalid result for authoring pass ${request.pass}`, {
      code: "INVALID_AUTHORING_RESULT",
      details
    });
  }
  return result;
}

async function listPasses(stateRoot) {
  const passesRoot = path.join(stateRoot, "passes");
  let entries = [];
  try {
    entries = await readdir(passesRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const passes = [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const root = path.join(passesRoot, entry.name);
    const request = await readYaml(path.join(root, "request.yaml"), "authoring pass request");
    const result = await readYaml(path.join(root, "result.yaml"), "authoring pass result");
    if (!request) {
      throw new SeedSpecError(`Authoring pass has no request.yaml: ${entry.name}`, {
        code: "INVALID_AUTHORING_STATE"
      });
    }
    assertArea(request.area);
    passes.push({
      root,
      request,
      result: validateResult(result, request)
    });
  }
  return passes;
}

function areaStatus(area, passes) {
  const relevant = passes.filter((pass) => pass.request.area === area);
  if (relevant.length === 0) return "not-audited";
  const latest = relevant.at(-1);
  return latest.result.outcome;
}

function nextArea(passes) {
  return AUTHORING_AREAS.find((area) => (
    !passes.some((pass) => pass.request.area === area && pass.result.outcome === "completed")
  ));
}

function activePass(passes) {
  return passes.find((pass) => !TERMINAL_OUTCOMES.has(pass.result.outcome));
}

function areaAfterCompletedPass(passes, current) {
  if (!current) return null;
  const completed = passes.map((pass) => (
    pass === current
      ? { ...pass, result: { ...pass.result, outcome: "completed" } }
      : pass
  ));
  return nextArea(completed);
}

function numberedPass(count, area) {
  return `${String(count + 1).padStart(4, "0")}-${area}`;
}

function documentationReference(protocolVersion, area) {
  return {
    bundled: `seedspec docs authoring ${area}`,
    web: `https://github.com/SeedSpec/seedspec/blob/main/docs/authoring.md`,
    protocol_version: protocolVersion
  };
}

function commonInstructions({ pass }) {
  return [
    "Work beside the author on the current SeedSpec package. The package, not the conversation, is the durable source of truth.",
    "Inspect supplied sources and current package content before proposing changes. Do not invent details to make the package appear mature.",
    "Keep consequential agent inference and speculative wording outside the package under `candidates/` in the authoring workspace until the author confirms it.",
    "Apply explicit author decisions, source-supported content, and unambiguous mechanical corrections directly; record their basis in the pass result.",
    "Ask only questions whose answers materially change behavior, authority, data treatment, accounting, portability, or observable success.",
    `Update the standardized pass result at \`passes/${pass}/result.yaml\` in the authoring workspace. Set \`outcome: needs-author\` while blocked on author judgment and \`outcome: completed\` only after validation.`,
    "Before completing the pass, run `seedspec validate <package-path>`, `seedspec lint <package-path>`, and `seedspec digest <package-path>`; record the commands and exact final digest."
  ];
}

function concernSeparationInstructions() {
  return [
    "Classify each consequential statement by the concern it actually serves:",
    "- core intent: behavior or outcomes that should survive legitimate implementation choices;",
    "- configuration: meaningful product behavior that installations may choose differently;",
    "- addition: independently composable behavior that extends or changes the solution;",
    "- implementation profile: a materially different platform, architecture, provider, or realization direction for the same core intent;",
    "- artifact: useful source material preserved in its native format;",
    "- implementation resource: versioned help for an implementing agent;",
    "- acceptance: observable evidence used to judge success.",
    "Identify misplaced or conflated content with its file and heading. Do not move content when the correct concern depends on author intent; explain the alternatives and ask for direction.",
    "Check especially for technology in core intent, implementation choices disguised as configuration, acceptance criteria that prescribe architecture, and optional features folded into the root outcome."
  ];
}

function kindAwareInstructions(kind) {
  const lens = kindLenses[kind] ?? kindLenses.solution;
  return [
    `Apply the \`${kind}\` authoring lens. Determine whether the package establishes:`,
    ...lens.map((item) => `- ${item};`),
    "For every concern, report `established`, `unclear`, `materially missing`, or `not material` with evidence from the package.",
    "A missing topic is not automatically a defect. Recommend refinement only when it matters to this specific outcome, and preserve legitimate provider-specific intent."
  ];
}

function ambiguityInstructions() {
  return [
    "Find statements with two or more plausible interpretations that would lead to materially different realizations.",
    "For each ambiguity, record the source location, competing interpretations, behavioral consequence, reversibility, and whether the package can safely defer the decision.",
    "Rank ambiguities by authority, irreversible data treatment, accounting, safety, portability, and cost of changing the decision after implementation.",
    "Group closely related questions and ask the author no more than three at once. Do not turn ordinary implementation freedom into an authoring question.",
    "Move confirmed answers into the appropriate package concern. Keep deferred questions in `open-questions.yaml`, not in distributable intent as speculative prose."
  ];
}

function consistencyInstructions(lint) {
  const diagnostics = lint.diagnostics.length
    ? lint.diagnostics.map((item) => `- ${item.code} (${item.scope}): ${item.message}`)
    : ["- The deterministic kind-aware lint produced no diagnostics; this is not a semantic consistency certification."];
  return [
    "Use deterministic validation for schema, path, ID, configuration, relationship, and reference checks. Then perform semantic consistency review across the package.",
    "Look for contradictory permissions or state behavior, configuration with no defined effect, acceptance without corresponding intent, profile guidance that changes the product outcome, inconsistent terminology, and capability contracts that disagree with the definition.",
    "Distinguish deterministic errors from agent judgments. Cite both sides of every claimed contradiction and avoid rewriting merely stylistic differences.",
    "Current deterministic diagnostics:",
    ...diagnostics
  ];
}

function hardeningInstructions(target) {
  const targetFocus = {
    capture: "preserve supplied intent honestly and identify consequential unknowns without inventing detail",
    shape: "clarify actors, outcomes, concepts, workflows, meaningful variation, and observable success",
    harden: "clarify permissions, invariants, failures, concurrency, retries, recovery, edge cases, and negative acceptance",
    compose: "clarify capability context, integration boundaries, related artifacts, additions, and implementation profiles",
    package: "remove speculative work, confirm references and resources, verify acceptance coverage, and prepare a distributable package"
  }[target];
  return [
    `Review toward the requested \`${target}\` depth: ${targetFocus}.`,
    "Do not expand product scope, manufacture enterprise requirements, or convert authoring depth into a quality score.",
    "Report material gaps, intentional omissions, and blockers separately. A package may be valid and useful without exhausting every possible detail.",
    "Recommend the smallest refinement that meaningfully reduces implementation risk at the requested depth."
  ];
}

function handoffInstructions() {
  return [
    "Simulate receiving this package as a capable implementing agent with no access to the authoring conversation.",
    "Explain the intended outcome, genuine constraints, configuration choices, unresolved product decisions, implementation profiles, optional artifacts and resources, and observable success conditions.",
    "Identify facts the implementing agent would otherwise guess, instructions that could be misread as authority, important material buried in excessive context, and acceptance criteria that cannot be observed.",
    "Run `seedspec begin <package-path>` and inspect the actual versioned handoff instructions. Review the emitted workflow rather than an idealized reading of source files.",
    "Recommend only changes to the package that improve an independent handoff; do not prescribe architecture or implementation workflow."
  ];
}

function areaInstructions(area, context) {
  switch (area) {
    case "concern-separation": return concernSeparationInstructions();
    case "kind-aware-discovery": return kindAwareInstructions(context.kind);
    case "material-ambiguity": return ambiguityInstructions();
    case "internal-consistency": return consistencyInstructions(context.lint);
    case "progressive-hardening": return hardeningInstructions(context.target);
    case "agent-ready-handoff": return handoffInstructions();
    default: throw new Error(`Unsupported authoring area: ${area}`);
  }
}

function formatInstructionsDocument({ request, record, lint }) {
  const areaIndex = AUTHORING_AREAS.indexOf(request.area) + 1;
  const reference = documentationReference(request.protocol_version, request.area);
  const sections = [
    "# SeedSpec authoring audit instructions",
    "",
    `- Instruction format: \`${AUTHORING_INSTRUCTION_FORMAT}\``,
    `- Tool version: \`${request.tool_version}\``,
    `- Protocol processed: \`${request.protocol_version}\``,
    `- Package: \`${record.manifest.id}@${record.manifest.version}\``,
    `- Kind hint: \`${record.manifest.kind}\``,
    `- Package digest before pass: \`${request.package_digest_before}\``,
    `- Pass: \`${request.pass}\``,
    `- Area: ${areaIndex} of ${AUTHORING_AREAS.length} — ${areaTitle(request.area)}`,
    `- Target depth: \`${request.target}\``,
    "",
    "## Operating contract",
    "",
    ...commonInstructions({ pass: request.pass }).map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Area objective",
    "",
    ...areaInstructions(request.area, {
      kind: record.manifest.kind,
      lint,
      target: request.target
    }),
    "",
    "## Required result",
    "",
    `Update \`passes/${request.pass}/result.yaml\` in the authoring workspace using its existing standardized fields.`,
    "Every finding should include a stable ID, source location, assessment, consequence, recommendation, and status when those values apply.",
    "Every applied or proposed change should include its path, basis (`author-answer`, `source-supported`, `mechanical`, or `agent-proposed`), and concise reason.",
    "Do not mark the pass completed until the package validates and `package_digest_after` matches `seedspec digest`.",
    "",
    "## Audit sequence",
    "",
    ...AUTHORING_AREAS.map((area, index) => `${index + 1}. ${areaTitle(area)}${area === request.area ? " (current)" : ""}`),
    "",
    "When the author is satisfied with this pass, complete the result and rerun the same `seedspec audit` command. The CLI will select the next incomplete area; no `next` command is required.",
    "",
    "## Documentation",
    "",
    `- Bundled guidance: \`${reference.bundled}\``,
    `- Current source documentation: ${reference.web}`
  ];
  return `${sections.join("\n")}\n`;
}

async function initializeWorkspace(stateRoot, record, packageRoot, target, toolVersion) {
  await Promise.all([
    mkdir(path.join(stateRoot, "passes"), { recursive: true }),
    mkdir(path.join(stateRoot, "candidates"), { recursive: true })
  ]);
  const workspacePath = path.join(stateRoot, "workspace.yaml");
  const existing = await readYaml(workspacePath, "authoring workspace");
  if (existing) assertWorkspaceMatches(existing, workspacePath, record, packageRoot);
  const workspace = existing ?? {
    authoring_state_version: AUTHORING_STATE_FORMAT,
    package: {
      path: path.relative(stateRoot, packageRoot) || ".",
      id: record.manifest.id,
      version: record.manifest.version,
      kind: record.manifest.kind
    },
    protocol_version: record.manifest.protocol_version,
    target,
    created_with: toolVersion
  };
  workspace.package.path = path.relative(stateRoot, packageRoot) || ".";
  workspace.package.version = record.manifest.version;
  workspace.package.kind = record.manifest.kind;
  workspace.protocol_version = record.manifest.protocol_version;
  workspace.target = target;
  workspace.last_observed_digest = record.digest;
  await writeFile(workspacePath, stringifyYaml(workspace), "utf8");
  await writeIfMissing(path.join(stateRoot, "sources.yaml"), stringifyYaml({
    authoring_state_version: AUTHORING_STATE_FORMAT,
    sources: []
  }));
  await writeIfMissing(path.join(stateRoot, "open-questions.yaml"), stringifyYaml({
    authoring_state_version: AUTHORING_STATE_FORMAT,
    questions: []
  }));
  return workspace;
}

function assertWorkspaceMatches(workspace, workspacePath, record, packageRoot) {
  const recordedPath = workspace.package?.path;
  const resolvedPath = path.isAbsolute(recordedPath ?? "")
    ? path.resolve(recordedPath)
    : path.resolve(path.dirname(workspacePath), recordedPath ?? "");
  if (workspace.authoring_state_version !== AUTHORING_STATE_FORMAT
    || workspace.package?.id !== record.manifest.id
    || resolvedPath !== packageRoot) {
    throw new SeedSpecError("Authoring workspace does not match this package", {
      code: "AUTHORING_WORKSPACE_MISMATCH",
      details: [`workspace: ${workspacePath}`, `package: ${record.manifest.id}`]
    });
  }
}

async function summarizeQuestions(stateRoot) {
  const questionsPath = path.join(stateRoot, "open-questions.yaml");
  const state = await readYaml(questionsPath, "authoring open questions");
  const questions = state?.questions ?? [];
  if (!Array.isArray(questions)) {
    throw new SeedSpecError("Authoring open-questions.yaml must contain a questions array", {
      code: "INVALID_AUTHORING_STATE",
      details: [questionsPath]
    });
  }
  const resolvedStatuses = new Set(["resolved", "closed", "rejected"]);
  return {
    path: questionsPath,
    total: questions.length,
    open: questions.filter((question) => !resolvedStatuses.has(question.status)).length,
    resolved: questions.filter((question) => resolvedStatuses.has(question.status)).length
  };
}

async function createPass({ stateRoot, record, target, area, toolVersion, passCount, lint }) {
  const pass = numberedPass(passCount, area);
  const passRoot = path.join(stateRoot, "passes", pass);
  await mkdir(passRoot, { recursive: false });
  const request = {
    authoring_instruction_version: AUTHORING_INSTRUCTION_FORMAT,
    pass,
    area,
    target,
    protocol_version: record.manifest.protocol_version,
    tool_version: toolVersion,
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      kind: record.manifest.kind
    },
    package_digest_before: record.digest
  };
  const resultPath = path.join(passRoot, "result.yaml");
  const instructions = formatInstructionsDocument({
    request,
    record,
    lint
  });
  await Promise.all([
    writeFile(path.join(passRoot, "request.yaml"), stringifyYaml(request), "utf8"),
    writeFile(path.join(passRoot, "instructions.md"), instructions, "utf8"),
    writeFile(resultPath, stringifyYaml(requiredResultShape(request)), "utf8")
  ]);
  return {
    root: passRoot,
    request,
    result: requiredResultShape(request),
    instructions
  };
}

function auditSummary({ record, stateRoot, workspace, passes, current, questions, toolVersion }) {
  const followingArea = areaAfterCompletedPass(passes, current);
  return {
    instruction_format: AUTHORING_INSTRUCTION_FORMAT,
    result_format: AUTHORING_RESULT_FORMAT,
    state_format: AUTHORING_STATE_FORMAT,
    tool_version: toolVersion,
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      kind: record.manifest.kind,
      protocol_version: record.manifest.protocol_version,
      digest: record.digest
    },
    target: workspace.target,
    state: stateRoot,
    areas: AUTHORING_AREAS.map((area, index) => ({
      index: index + 1,
      id: area,
      name: areaTitle(area),
      status: areaStatus(area, passes)
    })),
    passes: passes.map((pass) => ({
      id: pass.request.pass,
      area: pass.request.area,
      outcome: pass.result.outcome,
      tool_version: pass.request.tool_version,
      protocol_version: pass.request.protocol_version,
      package_digest_before: pass.request.package_digest_before,
      package_digest_after: pass.result.package_digest_after,
      root: pass.root
    })),
    current: current ? {
      id: current.request.pass,
      area: current.request.area,
      outcome: current.result.outcome,
      root: current.root,
      instructions: current.instructions ?? null,
      result: path.join(current.root, "result.yaml")
    } : null,
    after_current: followingArea ? {
      index: AUTHORING_AREAS.indexOf(followingArea) + 1,
      id: followingArea,
      name: areaTitle(followingArea)
    } : null,
    questions,
    complete: AUTHORING_AREAS.every((area) => areaStatus(area, passes) === "completed")
  };
}

export async function auditPackage(inputPath, {
  area,
  target,
  stateDirectory,
  toolVersion = "unknown",
  statusOnly = false
} = {}) {
  if (area) assertArea(area);
  if (target) assertTarget(target);
  const record = await validatePackage(inputPath);
  const packageRoot = record.root;
  const stateRoot = resolveStateDirectory(packageRoot, stateDirectory);
  const existingWorkspace = await readYaml(path.join(stateRoot, "workspace.yaml"), "authoring workspace");
  const selectedTarget = target ?? existingWorkspace?.target ?? "shape";
  assertTarget(selectedTarget);

  if (statusOnly && !existingWorkspace) {
    return auditSummary({
      record,
      stateRoot,
      workspace: { target: selectedTarget },
      passes: [],
      current: null,
      questions: {
        path: path.join(stateRoot, "open-questions.yaml"),
        total: 0,
        open: 0,
        resolved: 0
      },
      toolVersion
    });
  }

  let workspace;
  if (statusOnly) {
    const workspacePath = path.join(stateRoot, "workspace.yaml");
    assertWorkspaceMatches(existingWorkspace, workspacePath, record, packageRoot);
    workspace = existingWorkspace;
  } else {
    workspace = await initializeWorkspace(
      stateRoot,
      record,
      packageRoot,
      selectedTarget,
      toolVersion
    );
  }
  const passes = await listPasses(stateRoot);
  let current = activePass(passes);

  if (!current) {
    const latest = passes.at(-1);
    if (latest?.result.outcome === "completed"
      && latest.result.package_digest_after !== record.digest) {
      throw new SeedSpecError(`Completed authoring pass ${latest.request.pass} is stale`, {
        code: "STALE_AUTHORING_RESULT",
        details: [
          `recorded digest: ${latest.result.package_digest_after}`,
          `current digest: ${record.digest}`,
          `result: ${path.join(latest.root, "result.yaml")}`
        ]
      });
    }
  }

  if (statusOnly) {
    if (current) {
      current.instructions = await readFile(path.join(current.root, "instructions.md"), "utf8");
    }
    return auditSummary({
      record,
      stateRoot,
      workspace,
      passes,
      current,
      questions: await summarizeQuestions(stateRoot),
      toolVersion
    });
  }

  if (current && area && current.request.area !== area) {
    throw new SeedSpecError(`Authoring pass ${current.request.pass} is still ${current.result.outcome}`, {
      code: "AUTHORING_PASS_ACTIVE",
      details: [
        `current area: ${current.request.area}`,
        `requested area: ${area}`,
        `result: ${path.join(current.root, "result.yaml")}`
      ]
    });
  }

  if (!current) {
    const selectedArea = area ?? nextArea(passes);
    if (selectedArea) {
      const lint = await lintPackage(inputPath);
      current = await createPass({
        stateRoot,
        record,
        target: selectedTarget,
        area: selectedArea,
        toolVersion,
        passCount: passes.length,
        lint
      });
      passes.push(current);
    }
  } else {
    current.instructions = await readFile(path.join(current.root, "instructions.md"), "utf8");
  }

  return auditSummary({
    record,
    stateRoot,
    workspace,
    passes,
    current,
    questions: await summarizeQuestions(stateRoot),
    toolVersion
  });
}

export function formatAuthoringAudit(result, { statusOnly = false } = {}) {
  const lines = [
    "SeedSpec authoring audit",
    `Instruction format: ${result.instruction_format}`,
    `Result format: ${result.result_format}`,
    `Tool version: ${result.tool_version}`,
    `Protocol processed: ${result.package.protocol_version}`,
    `Package: ${result.package.id}@${result.package.version}`,
    `Kind hint: ${result.package.kind}`,
    `Package digest: ${result.package.digest}`,
    `Target depth: ${result.target}`,
    `Authoring state: ${result.state}`,
    `Authoring questions: ${result.questions.open} open, ${result.questions.resolved} resolved`,
    "",
    "Audit sequence:"
  ];
  const passToolVersions = [...new Set(result.passes.map((pass) => pass.tool_version))];
  if (passToolVersions.length > 0) {
    lines.splice(lines.indexOf(""), 0, `Recorded pass tool versions: ${passToolVersions.join(", ")}`);
  }
  for (const area of result.areas) {
    lines.push(`${area.index}. ${area.name} — ${area.status}`);
  }
  if (result.complete) {
    lines.push(
      "",
      "All six authoring audit areas have completed results.",
      "Completed audit areas mean review records exist; they are not a completeness or quality certification."
    );
    if (result.questions.open > 0) {
      lines.push(`The package still has ${result.questions.open} open authoring question(s): ${result.questions.path}`);
    }
    return lines.join("\n");
  }
  if (result.current) {
    lines.push(
      "",
      `Current pass: ${result.current.id}`,
      `Current outcome: ${result.current.outcome}`,
      `Result file: ${result.current.result}`
    );
    if (result.after_current) {
      lines.push(`After this pass is completed: ${result.after_current.index} of ${result.areas.length} — ${result.after_current.name}`);
    } else {
      lines.push("After this pass is completed: all six audit areas will have completed results.");
    }
    if (!statusOnly && result.current.instructions) {
      lines.push("", result.current.instructions.trimEnd());
    } else {
      lines.push("", `Run \`seedspec audit <package-path> --state ${JSON.stringify(result.state)}\` to print the current instructions.`);
    }
  } else if (statusOnly) {
    lines.push("", "No authoring pass exists. Run `seedspec audit <package-path>` to start the first incomplete area.");
  }
  return lines.join("\n");
}

export function formatAuthoringDocumentation(area) {
  if (area) assertArea(area);
  const lines = [
    "SeedSpec authoring guidance",
    `Instruction format: ${AUTHORING_INSTRUCTION_FORMAT}`,
    "",
    "A SeedSpec authoring agent works beside the author on the package. The CLI supplies versioned, kind-aware audit instructions and deterministic checks; the agent interprets source material, asks material questions, edits the package, and records a standardized result.",
    "",
    "Run:",
    "  seedspec audit <package-path>",
    "  seedspec audit <package-path> --area <area>",
    "  seedspec audit <package-path> --status",
    "",
    "Audit areas:"
  ];
  for (const [index, candidate] of AUTHORING_AREAS.entries()) {
    lines.push(`${index + 1}. ${candidate} — ${areaTitle(candidate)}`);
  }
  if (area) {
    lines.push(
      "",
      `${areaTitle(area)} objective:`,
      ...areaInstructions(area, {
        kind: "solution",
        lint: { diagnostics: [] },
        target: "shape"
      })
    );
  }
  lines.push(
    "",
    "Authoring state is stored outside the distributable package. No authoring state is uploaded or exported implicitly."
  );
  return lines.join("\n");
}
