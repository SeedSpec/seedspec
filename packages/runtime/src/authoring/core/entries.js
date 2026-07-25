// Pure shaping and validation for authoring observations. No filesystem, no
// clock, no randomness: everything the operations need to decide *what* a
// record becomes, so the same logic runs over a local workspace and a hosted
// store without a second implementation.

export const OBSERVATION_TYPES = Object.freeze([
  "finding",
  "inventory",
  "contradiction",
  "suggestion",
  "question",
  "tooling-feedback"
]);

// Where each observation type is stored inside a pass result. `question` is
// absent on purpose: question content is canonical in open-questions.yaml and
// the pass result keeps only an id index.
export const RESULT_COLLECTION = Object.freeze({
  finding: "findings",
  inventory: "inventory",
  contradiction: "contradictions",
  suggestion: "suggestions",
  "tooling-feedback": "tooling_feedback"
});

export const QUESTION_RESOLUTIONS = Object.freeze([
  "resolved",
  "closed",
  "rejected",
  // A question the author answered by saying it is not theirs to answer. Without
  // these two, the only options were deleting the question and losing the audit
  // trail, or marking it resolved and misreporting that the author decided
  // package intent.
  "not-package-decision",
  "routed-to-platform"
]);

export const RESOLVED_QUESTION_STATUSES = Object.freeze(new Set(QUESTION_RESOLUTIONS));

const REQUIRED_FIELDS = Object.freeze({
  finding: ["source", "assessment"],
  inventory: ["item"],
  contradiction: ["claim_a", "claim_b"],
  suggestion: ["summary"],
  question: ["question"],
  "tooling-feedback": ["summary"]
});

export class AuthoringInputError extends Error {
  constructor(message, details = []) {
    super(message);
    this.code = "INVALID_AUTHORING_INPUT";
    this.details = details;
  }
}

function slug(value, fallback) {
  const base = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 40);
  return base || fallback;
}

// Ids are engine-assigned when omitted. Making the caller invent stable,
// unique, cross-referenceable ids was a reliable source of collisions.
export function assignEntryId(entry, index, existingIds) {
  if (entry.id) return String(entry.id);
  const seed = entry.type === "inventory" ? entry.item
    : entry.type === "question" ? entry.question
      : entry.type === "contradiction" ? entry.claim_a
        : entry.summary ?? entry.assessment;
  const base = `${entry.type}-${slug(seed, String(index + 1))}`;
  let candidate = base;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function validateEntry(entry, index) {
  const details = [];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new AuthoringInputError(`entries[${index}] must be an object`);
  }
  if (!OBSERVATION_TYPES.includes(entry.type)) {
    details.push(`entries[${index}].type must be one of ${OBSERVATION_TYPES.join(", ")}`);
  } else {
    for (const field of REQUIRED_FIELDS[entry.type]) {
      const value = entry[field];
      if (typeof value !== "string" || value.trim() === "") {
        details.push(`entries[${index}].${field} is required for a ${entry.type}`);
      }
    }
  }
  if (details.length > 0) {
    throw new AuthoringInputError("Invalid authoring observation", details);
  }
  return entry;
}

// A finding must cite what triggered it. This is the source-bound rule made
// structural rather than left to a prompt the model may drift from.
export function normalizeEntry(entry, id, now) {
  const { type, ...rest } = entry;
  return { id, ...rest, recorded_at: now };
}

export function questionRecord(entry, id, pass, now) {
  return {
    id,
    question: entry.question,
    status: "open",
    source: entry.source ?? null,
    reason: entry.reason ?? null,
    priority: entry.priority ?? "material",
    raised_in: pass,
    raised_at: now
  };
}
