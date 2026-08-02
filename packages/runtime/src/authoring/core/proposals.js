// Pure shaping and validation for authoring document proposals. This module is
// intentionally free of filesystem and Node imports so local and hosted stores
// can share one contract.

export const AUTHORING_CHANGE_PROPOSAL_FORMAT = "1";

export const AUTHORING_CHANGE_BASIS_KINDS = Object.freeze([
  "author-answer",
  "supplied-source",
  "agent-proposal",
  "mechanical"
]);

export const AUTHORING_CHANGE_DECISIONS = Object.freeze([
  "accept",
  "reject"
]);

export const AUTHORING_CHANGE_STATUSES = Object.freeze([
  "proposed",
  "accepted",
  "rejected",
  "applied"
]);

export class AuthoringProposalInputError extends Error {
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

export function normalizeAuthoringDocumentPath(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AuthoringProposalInputError("A document path is required");
  }
  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/")
    || normalized.endsWith("/")
    || normalized.split("/").some((part) => part === "" || part === "." || part === "..")
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u.test(normalized)
  ) {
    throw new AuthoringProposalInputError("Document path must be portable and package-relative", [
      `path: ${value}`
    ]);
  }
  return normalized;
}

export function validateAuthoringChangeProposalInput(input) {
  const details = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AuthoringProposalInputError("A change proposal is required");
  }
  let documentPath;
  try {
    documentPath = normalizeAuthoringDocumentPath(input.path);
  } catch (error) {
    if (error instanceof AuthoringProposalInputError) details.push(error.message, ...error.details);
    else throw error;
  }
  requiredText(input.summary, "summary", details);
  if (typeof input.content !== "string") details.push("content must be a string");
  if (!input.basis || typeof input.basis !== "object" || Array.isArray(input.basis)) {
    details.push("basis is required");
  } else if (!AUTHORING_CHANGE_BASIS_KINDS.includes(input.basis.kind)) {
    details.push(`basis.kind must be one of ${AUTHORING_CHANGE_BASIS_KINDS.join(", ")}`);
  }
  if (
    input.basis?.references !== undefined
    && (!Array.isArray(input.basis.references)
      || input.basis.references.some((reference) => typeof reference !== "string" || reference.trim() === ""))
  ) {
    details.push("basis.references must contain non-empty strings");
  }
  if (details.length > 0) {
    throw new AuthoringProposalInputError("Invalid authoring change proposal", details);
  }
  return {
    path: documentPath,
    summary: input.summary.trim(),
    content: input.content,
    basis: {
      kind: input.basis.kind,
      references: [...new Set(input.basis.references ?? [])]
    }
  };
}

export function validateAuthoringChangeDecisionInput(input) {
  const details = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AuthoringProposalInputError("A change decision is required");
  }
  requiredText(input.proposalId, "proposalId", details);
  if (!AUTHORING_CHANGE_DECISIONS.includes(input.decision)) {
    details.push(`decision must be one of ${AUTHORING_CHANGE_DECISIONS.join(", ")}`);
  }
  if (input.decidedBy !== undefined && input.decidedBy !== "author") {
    details.push("decidedBy must be author");
  }
  if (input.rationale !== undefined && typeof input.rationale !== "string") {
    details.push("rationale must be a string");
  }
  if (details.length > 0) {
    throw new AuthoringProposalInputError("Invalid authoring change decision", details);
  }
  return {
    proposalId: input.proposalId.trim(),
    decision: input.decision,
    decidedBy: "author",
    rationale: input.rationale?.trim() || null
  };
}

function slug(value, fallback) {
  const base = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48);
  return base || fallback;
}

export function assignAuthoringProposalId(proposal, existingIds) {
  const base = `change-${slug(proposal.path, "document")}`;
  let candidate = base;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
