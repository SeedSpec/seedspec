// The write half of Decision 0013's operation surface.
//
// Before these existed, every state transition the engine defined was performed
// by a language model hand-editing result.yaml against a schema it could not
// see. That is what made authoring brittle: a single wrong field threw, and the
// questions the brief told the agent to record were written where nothing read
// them.
//
// Each operation validates its own input, writes both sides of a split record
// in one step, and returns the same envelope shape so a caller never needs a
// follow-up read to learn the new state.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "../errors.js";
import { computePackageDigest } from "../integrity.js";
import { lintPackage } from "../lint.js";
import { validatePackage } from "../validate.js";
import {
  AuthoringInputError,
  QUESTION_RESOLUTIONS,
  RESOLVED_QUESTION_STATUSES,
  RESULT_COLLECTION,
  assignEntryId,
  normalizeEntry,
  questionRecord,
  validateEntry
} from "./core/entries.js";

export const AUTHORING_OPERATION_FORMAT = "1";

function fail(message, code, details = []) {
  throw new SeedSpecError(message, { code, details });
}

function toSeedSpecError(error) {
  if (error instanceof AuthoringInputError) {
    fail(error.message, error.code, error.details);
  }
  throw error;
}

async function readState(filePath, label) {
  try {
    return parseYaml(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    fail(`Cannot read ${label}: ${filePath}`, "INVALID_AUTHORING_STATE", [error.message]);
  }
}

async function writeState(filePath, value) {
  await writeFile(filePath, stringifyYaml(value), "utf8");
}

// Resolves the pass the operation applies to. Defaulting to the open pass keeps
// the common call free of bookkeeping the caller would otherwise have to track.
async function resolveActivePass(stateRoot, requested) {
  const { readAuthoringPasses } = await import("./passes.js");
  const passes = await readAuthoringPasses(stateRoot);
  const open = passes.filter(({ open: isOpen }) => isOpen);
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

async function currentRevision(packageRoot, stateRoot) {
  const { computeAuthoringRevision } = await import("./core/revision.js");
  return computeAuthoringRevision(packageRoot, stateRoot);
}

// Optimistic concurrency. Optional locally, where a single agent cannot race
// itself; a hosted store passes it on every call so two browser tabs cannot
// silently overwrite each other.
async function assertRevision(packageRoot, stateRoot, expected) {
  const actual = await currentRevision(packageRoot, stateRoot);
  if (expected && expected !== actual) {
    fail("Authoring workspace changed since it was read", "AUTHORING_REVISION_CONFLICT", [
      `expected: ${expected}`,
      `actual: ${actual}`
    ]);
  }
  return actual;
}

async function envelope({
  operation,
  packageRoot,
  stateRoot,
  previousRevision,
  revisionChecked,
  changed,
  extra = {}
}) {
  const { inspectAuthoringWorkspace } = await import("../authoring-workspace.js");
  return {
    authoring_operation_version: AUTHORING_OPERATION_FORMAT,
    operation,
    applied: true,
    revision_checked: revisionChecked,
    workspace: {
      revision: await currentRevision(packageRoot, stateRoot),
      previous_revision: previousRevision
    },
    changed,
    ...extra,
    snapshot: await inspectAuthoringWorkspace(packageRoot, { stateDirectory: stateRoot }),
    local: {
      state_root: stateRoot,
      package_root: packageRoot
    }
  };
}

/**
 * Record what the review observed. One operation rather than six: they land in
 * the same file in the same conversational beat, and six entry points meant six
 * chances to choose wrong.
 *
 * A `question` entry writes open-questions.yaml *and* the pass-result id index
 * together. The brief used to direct questions into the pass result while every
 * read surface looked at open-questions.yaml, so recorded questions were
 * invisible to `author questions`, `publish-check`, and `prepare`.
 */
export async function recordObservations(packageRoot, {
  stateRoot,
  pass: requestedPass,
  entries,
  expectedRevision = null,
  now = () => new Date().toISOString()
} = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    fail("Provide at least one observation entry", "INVALID_AUTHORING_INPUT");
  }
  const previousRevision = await assertRevision(packageRoot, stateRoot, expectedRevision);
  const active = await resolveActivePass(stateRoot, requestedPass);
  const timestamp = now();

  const questionsPath = path.join(stateRoot, "open-questions.yaml");
  const questionState = (await readState(questionsPath, "authoring open questions")) ?? { questions: [] };
  const questions = Array.isArray(questionState.questions) ? questionState.questions : [];

  const result = active.result;
  const existingIds = new Set([
    ...questions.map(({ id }) => id),
    ...Object.values(RESULT_COLLECTION).flatMap(
      (collection) => (Array.isArray(result[collection]) ? result[collection] : []).map(({ id }) => id)
    )
  ].filter(Boolean));

  const recorded = [];
  entries.forEach((entry, index) => {
    try {
      validateEntry(entry, index);
    } catch (error) {
      toSeedSpecError(error);
    }
    const id = assignEntryId(entry, index, existingIds);
    existingIds.add(id);
    if (entry.type === "question") {
      questions.push(questionRecord(entry, id, active.id, timestamp));
      result.questions.asked = [...new Set([...(result.questions.asked ?? []), id])];
    } else {
      const collection = RESULT_COLLECTION[entry.type];
      result[collection] = [...(result[collection] ?? []), normalizeEntry(entry, id, timestamp)];
    }
    recorded.push({ id, type: entry.type });
  });

  const wroteQuestions = recorded.some(({ type }) => type === "question");
  if (wroteQuestions) {
    await writeState(questionsPath, { ...questionState, questions });
  }
  await writeState(path.join(active.root, "result.yaml"), result);

  return envelope({
    operation: "record-observations",
    packageRoot,
    stateRoot,
    previousRevision,
    revisionChecked: Boolean(expectedRevision),
    changed: [
      { kind: "pass-result", id: active.id },
      ...(wroteQuestions ? [{ kind: "questions" }] : [])
    ],
    extra: { recorded }
  });
}

/**
 * Record the author's answer, or close a question they declined to own.
 *
 * `not-package-decision` and `routed-to-platform` exist because the previous
 * vocabulary forced a false choice: delete the question and lose the audit
 * trail, or mark it resolved and misreport that the author decided package
 * intent.
 */
export async function answerQuestion(packageRoot, {
  stateRoot,
  questionId,
  answer,
  resolution = "resolved",
  expectedRevision = null,
  now = () => new Date().toISOString()
} = {}) {
  if (!questionId) fail("questionId is required", "INVALID_AUTHORING_INPUT");
  if (!QUESTION_RESOLUTIONS.includes(resolution)) {
    fail(`Unknown question resolution: ${resolution}`, "INVALID_AUTHORING_INPUT", [
      `available: ${QUESTION_RESOLUTIONS.join(", ")}`
    ]);
  }
  if (resolution === "resolved" && (typeof answer !== "string" || answer.trim() === "")) {
    fail("A resolved question needs the author's answer", "INVALID_AUTHORING_INPUT");
  }
  const previousRevision = await assertRevision(packageRoot, stateRoot, expectedRevision);

  const questionsPath = path.join(stateRoot, "open-questions.yaml");
  const questionState = await readState(questionsPath, "authoring open questions");
  const questions = Array.isArray(questionState?.questions) ? questionState.questions : [];
  const question = questions.find(({ id }) => id === questionId);
  if (!question) {
    fail(`Unknown authoring question: ${questionId}`, "UNKNOWN_AUTHORING_QUESTION", [
      `open: ${questions.filter((item) => !RESOLVED_QUESTION_STATUSES.has(item.status))
        .map(({ id }) => id).join(", ") || "none"}`
    ]);
  }

  const timestamp = now();
  question.status = resolution;
  question.answer = answer ?? null;
  question.answered_at = timestamp;

  const changed = [{ kind: "questions" }];
  // Route a platform gap into its own record so it stays visible as engine
  // work without becoming a package-author obligation.
  if (resolution === "routed-to-platform") {
    const feedbackPath = path.join(stateRoot, "platform-feedback.yaml");
    const feedbackState = (await readState(feedbackPath, "authoring platform feedback")) ?? { feedback: [] };
    const feedback = Array.isArray(feedbackState.feedback) ? feedbackState.feedback : [];
    feedback.push({
      id: `pf-${questionId}`,
      raised_in: question.raised_in ?? null,
      summary: question.question,
      why: answer ?? null,
      status: "open",
      routed_at: timestamp
    });
    await writeState(feedbackPath, { ...feedbackState, feedback });
    changed.push({ kind: "platform-feedback" });
  }

  await writeState(questionsPath, { ...questionState, questions });

  // Mirror the id into the pass that raised it, when that pass is still open.
  const { readAuthoringPasses } = await import("./passes.js");
  const passes = await readAuthoringPasses(stateRoot);
  const owning = passes.find(({ id, open }) => open && id === question.raised_in);
  if (owning) {
    const bucket = resolution === "resolved" ? "answered" : "declined";
    owning.result.questions[bucket] = [...new Set([...(owning.result.questions[bucket] ?? []), questionId])];
    owning.result.questions.asked = (owning.result.questions.asked ?? [])
      .filter((id) => id !== questionId);
    await writeState(path.join(owning.root, "result.yaml"), owning.result);
    changed.push({ kind: "pass-result", id: owning.id });
  }

  return envelope({
    operation: "answer-question",
    packageRoot,
    stateRoot,
    previousRevision,
    revisionChecked: Boolean(expectedRevision),
    changed,
    extra: { question: { id: questionId, status: resolution } }
  });
}

/**
 * Close a review thread.
 *
 * The engine runs validate, lint, and digest itself. Asking a language model to
 * transcribe a sha256 by hand was the worst instruction in the brief, and the
 * three regexes that policed the transcription only existed to catch it failing.
 */
export async function reviewArea(packageRoot, {
  stateRoot,
  pass: requestedPass,
  summary,
  disposition,
  outcome = "reviewed",
  expectedRevision = null
} = {}) {
  if (typeof summary !== "string" || summary.trim() === "") {
    fail("A reviewed thread needs a summary of what the author confirmed", "INVALID_AUTHORING_INPUT");
  }
  if (!["improved", "good-enough", "not-relevant"].includes(disposition)) {
    fail(`Unknown review disposition: ${disposition}`, "INVALID_AUTHORING_INPUT", [
      "available: improved, good-enough, not-relevant"
    ]);
  }
  if (!["reviewed", "abandoned", "superseded"].includes(outcome)) {
    fail(`Unknown review outcome: ${outcome}`, "INVALID_AUTHORING_INPUT", [
      "available: reviewed, abandoned, superseded"
    ]);
  }
  const previousRevision = await assertRevision(packageRoot, stateRoot, expectedRevision);
  const active = await resolveActivePass(stateRoot, requestedPass);

  const [record, lint] = await Promise.all([
    validatePackage(packageRoot),
    lintPackage(packageRoot)
  ]);
  const digest = await computePackageDigest(packageRoot);

  const result = active.result;
  result.outcome = outcome;
  result.disposition = disposition;
  result.summary = summary.trim();
  result.package_digest_after = digest.digest ?? digest;
  result.validation = {
    protocol_valid: true,
    commands: [
      `seedspec validate ${packageRoot}`,
      `seedspec lint ${packageRoot}`,
      `seedspec digest ${packageRoot}`
    ],
    lint_diagnostics: lint.diagnostics.length
  };
  await writeState(path.join(active.root, "result.yaml"), result);

  return envelope({
    operation: "review-area",
    packageRoot,
    stateRoot,
    previousRevision,
    revisionChecked: Boolean(expectedRevision),
    changed: [{ kind: "pass-result", id: active.id }],
    extra: {
      reviewed: {
        pass: active.id,
        area: active.request.area,
        disposition,
        outcome,
        package: { id: record.manifest.id, digest: result.package_digest_after }
      }
    }
  });
}

/**
 * Attach source material the review may draw findings from.
 *
 * sources.yaml has been read by the brief since the beginning and written by
 * nothing, so declaring a source meant hand-editing a file no command mentioned.
 * Carrying domain knowledge is the largest measured lever in the evaluation
 * corpus; it needed a real on-ramp.
 *
 * This never fetches. `location` is a pointer the author is asserting, and
 * inline `content` is material they supplied.
 */
export async function attachSource(packageRoot, {
  stateRoot,
  source,
  expectedRevision = null,
  now = () => new Date().toISOString()
} = {}) {
  if (!source || typeof source !== "object") {
    fail("source is required", "INVALID_AUTHORING_INPUT");
  }
  for (const field of ["kind", "authority"]) {
    if (typeof source[field] !== "string" || source[field].trim() === "") {
      fail(`source.${field} is required`, "INVALID_AUTHORING_INPUT");
    }
  }
  if (!source.location && !source.content) {
    fail("source needs a location or inline content", "INVALID_AUTHORING_INPUT");
  }
  const previousRevision = await assertRevision(packageRoot, stateRoot, expectedRevision);

  const sourcesPath = path.join(stateRoot, "sources.yaml");
  const state = (await readState(sourcesPath, "authoring sources")) ?? { sources: [] };
  const sources = Array.isArray(state.sources) ? state.sources : [];
  const existing = new Set(sources.map(({ id }) => id).filter(Boolean));
  const id = source.id
    ?? assignEntryId({ type: "source", summary: source.location ?? source.kind }, sources.length, existing);
  if (existing.has(id)) {
    fail(`Source already attached: ${id}`, "AUTHORING_SOURCE_EXISTS");
  }
  sources.push({
    id,
    kind: source.kind,
    authority: source.authority,
    location: source.location ?? null,
    summary: source.summary ?? null,
    content: source.content ?? null,
    status: "active",
    attached_at: now()
  });
  await writeState(sourcesPath, { ...state, sources });

  return envelope({
    operation: "attach-source",
    packageRoot,
    stateRoot,
    previousRevision,
    revisionChecked: Boolean(expectedRevision),
    changed: [{ kind: "sources" }],
    extra: { source: { id, kind: source.kind, authority: source.authority } }
  });
}
