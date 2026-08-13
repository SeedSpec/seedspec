import { execFile, spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { canonicalJson, contentId, sha256 } from "./lib/run-contract.mjs";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const prepareScript = path.join(scriptRoot, "prepare-semantic-grade.mjs");
const finalizeScript = path.join(scriptRoot, "finalize-semantic-grade.mjs");

function parseArguments(argv) {
  const options = {
    executable: "codex",
    model: "gpt-5.6-sol",
    reasoning_effort: "high",
    max_duration_ms: 1_800_000,
    prepare_only: false,
    confirm: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--prepare-only") options.prepare_only = true;
    else if (name === "--confirm-model-execution") options.confirm = true;
    else if ([
      "--run",
      "--out",
      "--executable",
      "--model",
      "--reasoning-effort",
      "--max-duration-ms"
    ].includes(name) && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      options[name.slice(2).replaceAll("-", "_")] = argv[index + 1];
      index += 1;
    } else {
      throw new Error(
        "Usage: run-semantic-grade.mjs --run <completed-run> --out <directory> "
        + "[--prepare-only | --confirm-model-execution] [--model gpt-5.6-sol]"
      );
    }
  }
  if (!options.run || !options.out) throw new Error("--run and --out are required");
  if (options.prepare_only && options.confirm) {
    throw new Error("Use either --prepare-only or --confirm-model-execution");
  }
  if (!options.prepare_only && !options.confirm) {
    throw new Error("Judge execution requires --confirm-model-execution");
  }
  options.max_duration_ms = Number(options.max_duration_ms);
  if (!Number.isInteger(options.max_duration_ms) || options.max_duration_ms <= 0) {
    throw new Error("--max-duration-ms must be a positive integer");
  }
  if (options.model !== "gpt-5.6-sol") throw new Error("The frozen semantic judge must be gpt-5.6-sol");
  return options;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function nextJudgeCapturePaths(outputRoot) {
  for (let attempt = 1; ; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-attempt-${String(attempt)}`;
    const events = path.join(outputRoot, `judge-events${suffix}.jsonl`);
    const stderr = path.join(outputRoot, `judge-stderr${suffix}.log`);
    if (!(await exists(events)) && !(await exists(stderr))) {
      return { events, stderr };
    }
  }
}

function exactObject(properties) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties
  };
}

function stringValue() {
  return { type: "string", minLength: 1 };
}

function citationSchema() {
  return exactObject({
    path: stringValue(),
    locator: stringValue(),
    observation: stringValue()
  });
}

function dimensionSchema(ids) {
  return exactObject({
    id: { type: "string", enum: ids },
    score: { type: "integer", minimum: 0, maximum: 4 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    citations: { type: "array", minItems: 1, items: citationSchema() },
    rationale: stringValue()
  });
}

function axisSchema(axes) {
  return exactObject({
    axis_id: { type: "string", enum: axes.map(({ axis_id: axisId }) => axisId) },
    reference_kind: {
      type: "string",
      enum: [...new Set(axes.map(({ reference_kind: referenceKind }) => referenceKind))]
    },
    reference_id: {
      type: "string",
      enum: [...new Set(axes.map(({ reference_id: referenceId }) => referenceId))]
    },
    level: { type: "string", enum: [...new Set(axes.map(({ level }) => level))] },
    alignment: { type: "string", enum: ["aligned", "within-permitted-variation", "divergent"] },
    permitted_variability_respected: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    citations: { type: "array", minItems: 1, items: citationSchema() },
    rationale: stringValue()
  });
}

function judgeOutputSchema(evidence, evaluatorId) {
  const dimension = dimensionSchema(evidence.dimensions);
  const assessment = axisSchema(evidence.reference_axes);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "SeedSpec semantic grade draft",
    ...exactObject({
      semantic_grade_version: { type: "string", const: "1" },
      evidence_id: { type: "string", const: evidence.evidence_id },
      subject: exactObject({
        id: { type: "string", const: evidence.subject.id },
        format_version: { type: "string", const: evidence.subject.format_version },
        digest: { type: "string", const: evidence.subject.digest }
      }),
      cli_baseline: exactObject({
        version: { type: "string", const: evidence.cli_baseline.version },
        protocol_release: { type: "string", const: evidence.cli_baseline.protocol_release },
        source_digest: { type: "string", const: evidence.cli_baseline.source_digest }
      }),
      evaluator_id: { type: "string", const: evaluatorId },
      dimensions: {
        type: "array",
        minItems: evidence.dimensions.length,
        maxItems: evidence.dimensions.length,
        items: dimension
      },
      reference_assessments: {
        type: "array",
        minItems: evidence.reference_axes.length,
        maxItems: evidence.reference_axes.length,
        items: assessment
      },
      summary: exactObject({
        total_score: { type: "integer", minimum: 0, maximum: 32 },
        maximum_score: { type: "integer", const: 32 },
        mean_score: { type: "number", minimum: 0, maximum: 4 }
      }),
      reference_summary: exactObject({
        axis_count: { type: "integer", minimum: 0 },
        aligned_count: { type: "integer", minimum: 0 },
        within_permitted_variation_count: { type: "integer", minimum: 0 },
        divergent_count: { type: "integer", minimum: 0 },
        critical_divergences: {
          type: "array",
          items: stringValue()
        },
        permitted_variability_respected: { type: "boolean" }
      }),
      limitations: { type: "array", items: stringValue() }
    })
  };
}

function sanitizeEvent(value, redactions) {
  if (Array.isArray(value)) return value.map((item) => sanitizeEvent(item, redactions));
  if (!value || typeof value !== "object") return value;
  if (["thinking", "redacted_thinking", "reasoning"].includes(value.type)) {
    redactions.count += 1;
    return { type: "reasoning-redacted" };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeEvent(item, redactions)])
  );
}

function sanitizeEvents(source) {
  const lines = [];
  const redactions = { count: 0 };
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      lines.push(JSON.stringify(sanitizeEvent(JSON.parse(line), redactions)));
    } catch (error) {
      throw new Error(`Judge event ${index + 1} is invalid JSON: ${error.message}`, { cause: error });
    }
  }
  return { content: `${lines.join("\n")}\n`, redactions: redactions.count };
}

async function execute(executable, args, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exit_code: code ?? 1,
        timed_out: timedOut
      });
    });
  });
}

async function runNode(script, args) {
  return execFileAsync(process.execPath, [script, ...args], { maxBuffer: 50 * 1024 * 1024 });
}

async function normalizeDraft(draftPath, normalizedPath) {
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  const assessments = draft.reference_assessments.map((assessment) => ({
    ...assessment,
    permitted_variability_respected: assessment.reference_kind === "permitted-variability"
      ? assessment.alignment !== "divergent"
      : true
  }));
  const total = draft.dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  const normalized = {
    ...draft,
    reference_assessments: assessments,
    summary: {
      total_score: total,
      maximum_score: 32,
      mean_score: total / draft.dimensions.length
    },
    reference_summary: {
      axis_count: assessments.length,
      aligned_count: assessments.filter(({ alignment }) => alignment === "aligned").length,
      within_permitted_variation_count: assessments.filter(({ alignment }) => (
        alignment === "within-permitted-variation"
      )).length,
      divergent_count: assessments.filter(({ alignment }) => alignment === "divergent").length,
      critical_divergences: assessments.filter(({ level, alignment }) => (
        level === "critical" && alignment === "divergent"
      )).map(({ axis_id: axisId }) => axisId),
      permitted_variability_respected: assessments.every(({ permitted_variability_respected: respected }) => (
        respected
      ))
    }
  };
  const content = `${JSON.stringify(normalized, null, 2)}\n`;
  if (await exists(normalizedPath)) {
    if (await readFile(normalizedPath, "utf8") !== content) {
      throw new Error("Existing normalized semantic draft does not match the judge output");
    }
  } else {
    await writeFile(normalizedPath, content, { encoding: "utf8", flag: "wx" });
  }
}

const options = parseArguments(process.argv.slice(2));
const runDirectory = path.resolve(options.run);
const outputRoot = path.resolve(options.out);
const kitRoot = path.join(outputRoot, "evidence-kit");
const evidencePath = path.join(kitRoot, "evidence.json");
await mkdir(outputRoot, { recursive: true });
if (!(await exists(evidencePath))) {
  await runNode(prepareScript, ["--run", runDirectory, "--out", kitRoot]);
}
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
const runnerVersion = (await execFileAsync(options.executable, ["--version"], {
  maxBuffer: 1024 * 1024
})).stdout.trim();
const planPath = path.join(outputRoot, "judge-plan.json");
const planBody = {
  semantic_judge_plan_version: "1",
  evidence_id: evidence.evidence_id,
  evaluator_id: options.model,
  runner: { executable: options.executable, version: runnerVersion },
  model: options.model,
  reasoning_effort: options.reasoning_effort,
  max_duration_ms: options.max_duration_ms
};
const judgePlan = { ...planBody, judge_plan_id: contentId("semantic-judge-plan", planBody) };
if (await exists(planPath)) {
  const existing = JSON.parse(await readFile(planPath, "utf8"));
  if (canonicalJson(existing) !== canonicalJson(judgePlan)) {
    throw new Error("Existing semantic judge plan does not match this execution request");
  }
} else {
  await writeFile(planPath, `${JSON.stringify(judgePlan, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

const gradePath = path.join(outputRoot, "grade.json");
const draftSchemaPath = path.join(outputRoot, "draft-output-schema.json");
const draftPath = path.join(outputRoot, "grade-draft.json");
const normalizedDraftPath = path.join(outputRoot, "grade-normalized-draft.json");
if (options.prepare_only || await exists(gradePath)) {
  process.stdout.write(`${JSON.stringify({
    status: options.prepare_only ? "prepared" : "completed",
    reused: await exists(gradePath),
    evidence_id: evidence.evidence_id,
    judge_plan_id: judgePlan.judge_plan_id,
    output: outputRoot,
    grade: await exists(gradePath) ? gradePath : null
  }, null, 2)}\n`);
} else {
  if (!(await exists(draftSchemaPath))) {
    await writeFile(
      draftSchemaPath,
      `${JSON.stringify(judgeOutputSchema(evidence, options.model), null, 2)}\n`,
      { encoding: "utf8", flag: "wx" }
    );
  }
  const startedAt = new Date().toISOString();
  const reusedModelOutput = await exists(draftPath);
  let execution = { exit_code: 0, timed_out: false };
  let reasoningRedactions = 0;
  if (!reusedModelOutput) {
    const capturePaths = await nextJudgeCapturePaths(outputRoot);
    execution = await execute(options.executable, [
      "exec",
      "--json",
      "--model", options.model,
      "-c", `model_reasoning_effort=${JSON.stringify(options.reasoning_effort)}`,
      "--sandbox", "read-only",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--cd", kitRoot,
      "--output-schema", draftSchemaPath,
      "--output-last-message", draftPath,
      "Read INSTRUCTIONS.md completely. Inspect only this evidence kit. Produce the exact JSON semantic grade draft. Set evaluator_id to gpt-5.6-sol."
    ], { cwd: kitRoot, timeoutMs: options.max_duration_ms });
    const sanitized = sanitizeEvents(execution.stdout);
    reasoningRedactions = sanitized.redactions;
    await Promise.all([
      writeFile(capturePaths.events, sanitized.content, { encoding: "utf8", flag: "wx" }),
      writeFile(capturePaths.stderr, execution.stderr, { encoding: "utf8", flag: "wx" })
    ]);
    if (execution.exit_code !== 0 || execution.timed_out) {
      throw new Error(
        `Semantic judge failed with exit ${execution.exit_code}${execution.timed_out ? " after timeout" : ""}`
      );
    }
  }
  await normalizeDraft(draftPath, normalizedDraftPath);
  await runNode(finalizeScript, [
    "--draft", normalizedDraftPath,
    "--evidence", evidencePath,
    "--out", gradePath
  ]);
  const grade = await readFile(gradePath);
  const resultBody = {
    semantic_judge_result_version: "1",
    judge_plan_id: judgePlan.judge_plan_id,
    evidence_id: evidence.evidence_id,
    evaluator_id: options.model,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: execution.exit_code,
    timed_out: execution.timed_out,
    reasoning_redactions: reasoningRedactions,
    model_output_reused: reusedModelOutput,
    grade: { path: "grade.json", digest: sha256(grade), bytes: grade.byteLength }
  };
  const result = { ...resultBody, judge_result_id: contentId("semantic-judge-result", resultBody) };
  await writeFile(
    path.join(outputRoot, "judge-result.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  process.stdout.write(`${JSON.stringify({
    status: "completed",
    evidence_id: evidence.evidence_id,
    judge_plan_id: judgePlan.judge_plan_id,
    judge_result_id: result.judge_result_id,
    grade: gradePath,
    output: outputRoot
  }, null, 2)}\n`);
}
