// Pure shaping and validation for authoring clarification candidates. Candidate
// state stays outside the package. A candidate records model interpretation;
// it never becomes package-author intent without a separate author decision and
// revision-bound document proposal.

export const AUTHORING_CANDIDATE_FORMAT = "1";

export const AUTHORING_CANDIDATE_KINDS = Object.freeze([
  "clarification"
]);

export const AUTHORING_CANDIDATE_MATERIALITY = Object.freeze([
  "critical",
  "material"
]);

export const AUTHORING_CANDIDATE_AFFECTED_CONCERNS = Object.freeze([
  "outcome",
  "architecture",
  "configuration",
  "authority",
  "resources",
  "completion-scope",
  "verification",
  "cost",
  "operational-ownership",
  "feasibility"
]);

export const AUTHORING_CANDIDATE_RECOMMENDATIONS = Object.freeze([
  "ask",
  "delegate",
  "retain-ambient",
  "no-action"
]);

export const AUTHORING_CANDIDATE_DECISIONS = Object.freeze([
  "accept",
  "decline",
  "delegate",
  "defer",
  "retain-ambient"
]);

export const AUTHORING_CANDIDATE_STATUSES = Object.freeze([
  "open",
  "accepted",
  "declined",
  "delegated",
  "deferred",
  "retained-ambient"
]);

const DECISION_STATUS = Object.freeze({
  accept: "accepted",
  decline: "declined",
  delegate: "delegated",
  defer: "deferred",
  "retain-ambient": "retained-ambient"
});

const MEANING_REQUIRED = new Set(["accept", "delegate", "retain-ambient"]);

export class AuthoringCandidateInputError extends Error {
  constructor(message, details = []) {
    super(message);
    this.code = "INVALID_AUTHORING_INPUT";
    this.details = details;
  }
}

function requiredText(value, field, details) {
  if (typeof value !== "string" || value.trim() === "") {
    details.push(`${field} is required`);
  }
}

function uniqueTextArray(value, field, details, { minimum = 0 } = {}) {
  if (!Array.isArray(value)) {
    details.push(`${field} must be an array`);
    return [];
  }
  const normalized = value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (normalized.length !== value.length) {
    details.push(`${field} must contain non-empty strings`);
  }
  const unique = [...new Set(normalized)];
  if (unique.length !== normalized.length) {
    details.push(`${field} must not repeat values`);
  }
  if (unique.length < minimum) {
    details.push(`${field} must contain at least ${minimum} values`);
  }
  return unique;
}

export function assignAuthoringCandidateId(existingIds, createOpaqueId) {
  let id;
  do {
    id = `candidate-${createOpaqueId()}`;
  } while (existingIds.has(id));
  return id;
}

export function validateAuthoringCandidateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AuthoringCandidateInputError("A clarification candidate is required");
  }
  const details = [];
  const kind = input.kind ?? "clarification";
  if (!AUTHORING_CANDIDATE_KINDS.includes(kind)) {
    details.push(`kind must be one of ${AUTHORING_CANDIDATE_KINDS.join(", ")}`);
  }
  requiredText(input.issue, "issue", details);
  const alternatives = uniqueTextArray(input.alternatives, "alternatives", details, { minimum: 2 });
  if (!input.basis || typeof input.basis !== "object" || Array.isArray(input.basis)) {
    details.push("basis is required");
  }
  const actor = input.basis?.actor ?? "authoring-agent";
  if (!["authoring-agent", "receiving-model"].includes(actor)) {
    details.push("basis.actor must be authoring-agent or receiving-model");
  }
  const sourceClaims = Array.isArray(input.basis?.source_claims)
    ? input.basis.source_claims
    : [];
  if (!Array.isArray(input.basis?.source_claims)) {
    details.push("basis.source_claims must be an array");
  }
  if (sourceClaims.length === 0) {
    details.push("basis.source_claims must identify at least one authored claim");
  }
  const shapedClaims = [];
  sourceClaims.forEach((claim, index) => {
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
      details.push(`basis.source_claims[${index}] must be an object`);
      return;
    }
    requiredText(claim.reference, `basis.source_claims[${index}].reference`, details);
    requiredText(claim.statement, `basis.source_claims[${index}].statement`, details);
    if (typeof claim.reference === "string" && claim.reference.trim()
      && typeof claim.statement === "string" && claim.statement.trim()) {
      shapedClaims.push({
        reference: claim.reference.trim(),
        statement: claim.statement.trim()
      });
    }
  });
  requiredText(input.basis?.inference, "basis.inference", details);
  const materiality = input.materiality ?? "material";
  if (!AUTHORING_CANDIDATE_MATERIALITY.includes(materiality)) {
    details.push(`materiality must be one of ${AUTHORING_CANDIDATE_MATERIALITY.join(", ")}`);
  }
  const affected = input.affected === undefined
    ? []
    : uniqueTextArray(input.affected, "affected", details);
  for (const concern of affected) {
    if (!AUTHORING_CANDIDATE_AFFECTED_CONCERNS.includes(concern)) {
      details.push(
        `affected contains unsupported concern: ${concern}; supported: ${AUTHORING_CANDIDATE_AFFECTED_CONCERNS.join(", ")}`
      );
    }
  }
  const recommendedDisposition = input.recommended_disposition ?? "ask";
  if (!AUTHORING_CANDIDATE_RECOMMENDATIONS.includes(recommendedDisposition)) {
    details.push(
      `recommended_disposition must be one of ${AUTHORING_CANDIDATE_RECOMMENDATIONS.join(", ")}`
    );
  }
  if (input.assumed_default !== undefined && input.assumed_default !== null
    && (typeof input.assumed_default !== "string" || input.assumed_default.trim() === "")) {
    details.push("assumed_default must be null or a non-empty string");
  }
  if (details.length > 0) {
    throw new AuthoringCandidateInputError("Invalid clarification candidate", details);
  }
  return {
    kind,
    issue: input.issue.trim(),
    alternatives,
    assumed_default: input.assumed_default?.trim() || null,
    basis: {
      actor,
      source_claims: shapedClaims,
      inference: input.basis.inference.trim()
    },
    materiality,
    affected,
    recommended_disposition: recommendedDisposition
  };
}

export function validateAuthoringCandidateDecisionInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AuthoringCandidateInputError("A candidate decision is required");
  }
  const details = [];
  requiredText(input.candidateId, "candidateId", details);
  if (!AUTHORING_CANDIDATE_DECISIONS.includes(input.decision)) {
    details.push(`decision must be one of ${AUTHORING_CANDIDATE_DECISIONS.join(", ")}`);
  }
  if (input.decidedBy !== undefined && input.decidedBy !== "author") {
    details.push("decidedBy must be author");
  }
  if (MEANING_REQUIRED.has(input.decision)) {
    requiredText(input.meaning, "meaning", details);
  } else if (input.meaning !== undefined && input.meaning !== null
    && typeof input.meaning !== "string") {
    details.push("meaning must be a string or null");
  }
  if (input.rationale !== undefined && input.rationale !== null
    && typeof input.rationale !== "string") {
    details.push("rationale must be a string or null");
  }
  if (details.length > 0) {
    throw new AuthoringCandidateInputError("Invalid candidate decision", details);
  }
  return {
    candidateId: input.candidateId.trim(),
    decision: input.decision,
    status: DECISION_STATUS[input.decision],
    decidedBy: "author",
    meaning: input.meaning?.trim() || null,
    rationale: input.rationale?.trim() || null
  };
}
