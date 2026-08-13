const GUIDANCE = Object.freeze({
  ambition: Object.freeze({
    small: "Keep the smallest coherent slice that serves the stated goal. Adjacent capabilities stay out unless the author explicitly adds them.",
    bounded: "Cover the stated deliverable end to end. Do not expand into adjacent product goals.",
    broad: "Cover the stated system and its major seams. Do not invent components, policies, or future features."
  }),
  audience: Object.freeze({
    "close-internal": "Assume readers know local context. State decisions and boundaries without adding background explanation.",
    "fresh-internal": "Write for a capable internal reader without conversation context. Make product terms, decisions, boundaries, and observables explicit; omit tutorials.",
    external: "Write for a capable reader without organizational context. Define sourced product terms and authority boundaries without inventing internal policy."
  }),
  handoff: Object.freeze({
    exploration: "Stop when direction, boundaries, and consequential unknowns are clear enough for continued discovery.",
    planning: "Stop when a fresh planner can plan without guessing product behavior. Keep implementation choices delegated.",
    "implementation-start": "Stop when a fresh implementer can begin and verify stated behavior without rediscovering product decisions. Do not add architecture unless the author decided it."
  }),
  collaboration: Object.freeze({
    brief: "Ask only an author-owned question that blocks the selected handoff. Resolve one question at a time and stop when the handoff condition is met.",
    standard: "Resolve consequential product forks activated by the stated scope. Avoid optional refinements.",
    intensive: "Walk every consequential product fork activated by the stated scope before stopping. Do not turn implementation options into author questions."
  })
});

const ADDITION_RULE = "Add material only when it preserves supplied meaning, records an accepted product decision or explicit delegation, marks a product boundary, or makes stated success observable for the selected handoff. Omit or remove material with no such role.";

const POSTURE_FIELDS = Object.freeze([
  "ambition",
  "audience",
  "handoff",
  "collaboration"
]);

function requireChoice(value, choices, label) {
  if (!choices.includes(value)) {
    throw new Error(`${label} must be one of: ${choices.join(", ")}`);
  }
}

export function validateAuthoringPostureInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("authoring_posture must be an object");
  }
  const extras = Object.keys(input).filter((field) => !POSTURE_FIELDS.includes(field));
  if (extras.length > 0) {
    throw new Error(`authoring_posture has unsupported fields: ${extras.join(", ")}`);
  }
  for (const field of POSTURE_FIELDS) {
    requireChoice(input[field], Object.keys(GUIDANCE[field]), `authoring_posture.${field}`);
  }
  return input;
}

export function validateAuthoringPostureProposal(value) {
  const issues = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["authoring posture proposal must be an object"];
  }
  const expected = [
    "authoring_eval_posture_proposal_version",
    ...POSTURE_FIELDS,
    "rationale"
  ];
  const missing = expected.filter((field) => !Object.hasOwn(value, field));
  const extras = Object.keys(value).filter((field) => !expected.includes(field));
  if (missing.length > 0) issues.push(`authoring posture proposal is missing: ${missing.join(", ")}`);
  if (extras.length > 0) issues.push(`authoring posture proposal has unsupported fields: ${extras.join(", ")}`);
  if (value.authoring_eval_posture_proposal_version !== "1") {
    issues.push("authoring_eval_posture_proposal_version must be 1");
  }
  for (const field of POSTURE_FIELDS) {
    try {
      requireChoice(value[field], Object.keys(GUIDANCE[field]), `authoring posture proposal.${field}`);
    } catch (error) {
      issues.push(error.message);
    }
  }
  if (typeof value.rationale !== "string" || value.rationale.trim() === "") {
    issues.push("authoring posture proposal.rationale must be a nonempty string");
  }
  return issues;
}

export function authoringPostureSelection(value) {
  return Object.fromEntries(POSTURE_FIELDS.map((field) => [field, value[field]]));
}

export function authoringPostureSelectionsMatch(left, right) {
  return POSTURE_FIELDS.every((field) => left?.[field] === right?.[field]);
}

export function validatePostureConfirmationMessage(message, proposal) {
  const issues = [];
  if (typeof message !== "string" || message.trim() === "") {
    return ["the posture recommendation response is empty"];
  }
  const questionMarks = [...message.matchAll(/\?/gu)].length;
  if (questionMarks !== 1) {
    issues.push("the posture recommendation response must ask exactly one question");
  }
  const clean = message.toLocaleLowerCase("en-US");
  for (const field of POSTURE_FIELDS) {
    if (!clean.includes(field) || !clean.includes(String(proposal?.[field] ?? "").toLocaleLowerCase("en-US"))) {
      issues.push(`the posture recommendation response must state ${field} and its proposed value`);
    }
  }
  if (!/\b(?:confirm|correct|change|adjust)\b/iu.test(message)) {
    issues.push("the posture recommendation response must invite confirmation or correction");
  }
  return issues;
}

export function isPostureConfirmationQuestion(message) {
  if (typeof message !== "string") return false;
  const questionEnd = message.indexOf("?");
  if (questionEnd === -1) return false;
  const prefix = message.slice(0, questionEnd);
  const questionStart = Math.max(
    prefix.lastIndexOf("\n"),
    prefix.lastIndexOf("."),
    prefix.lastIndexOf("!")
  );
  const clean = message.slice(questionStart + 1, questionEnd + 1).toLocaleLowerCase("en-US");
  const questionLike = clean.includes("?")
    || /\b(?:can you confirm|should i use|would you change|is this posture)\b/u.test(clean);
  const postureFields = POSTURE_FIELDS.filter((field) => clean.includes(field)).length;
  return questionLike && (clean.includes("authoring posture") || postureFields >= 2);
}

export function authoringPostureFusedPrompt() {
  return `Read HANDOFF.md completely. This turn is a private authoring-intent
and decision preflight only. Read the starter package and every visible source.
Do not edit any file under seedspec/.

Recommend the authoring posture that best fits the author's request and sources:

- ambition: small (smallest coherent slice), bounded (stated deliverable end to
  end), or broad (stated system and major seams)
- audience: close-internal (local context is known), fresh-internal (capable
  internal reader lacks conversation context), or external (reader lacks
  organizational context)
- handoff: exploration (continued discovery), planning (fresh planning without
  guessing product behavior), or implementation-start (a fresh implementer can
  begin and verify stated behavior)
- collaboration: brief (one or a few known handoff-blocking choices), standard
  (several consequential product forks need author input), or intensive (the
  request calls for walking every consequential product fork in scope)

Create authoring/posture-proposal.json with exactly these fields:

- authoring_eval_posture_proposal_version: "1"
- ambition
- audience
- handoff
- collaboration
- rationale: one short source-grounded explanation

Do not create authoring/posture.json. In your final response, state all four
labels and selected values. Say that the author can correct any selection in
their next response. Then ask exactly one consequential product question that
blocks the selected handoff. Do not ask a separate posture-confirmation
question. Stop after the product question.`;
}

export function authoringPostureProposalPrompt() {
  return `Read HANDOFF.md completely. This turn is a private authoring-intent
preflight only. Read the starter package and every visible source. Do not edit
any file under seedspec/ and do not ask a product question.

Recommend the authoring posture that best fits the author's request and sources:

- ambition: small (smallest coherent slice), bounded (stated deliverable end to
  end), or broad (stated system and major seams)
- audience: close-internal (local context is known), fresh-internal (capable
  internal reader lacks conversation context), or external (reader lacks
  organizational context)
- handoff: exploration (continued discovery), planning (fresh planning without
  guessing product behavior), or implementation-start (a fresh implementer can
  begin and verify stated behavior)
- collaboration: brief (only handoff-blocking author choices), standard
  (consequential product forks in scope), or intensive (every consequential
  product fork in scope)

Create authoring/posture-proposal.json with exactly these fields:

- authoring_eval_posture_proposal_version: "1"
- ambition
- audience
- handoff
- collaboration
- rationale: one short source-grounded explanation

Do not create authoring/posture.json. In your final response, state all four
labels and selected values, then ask exactly one combined question asking the
author to confirm or correct the recommendation. Stop after that question.`;
}

export function createAuthoringPosture(input) {
  const posture = validateAuthoringPostureInput(input);
  return {
    authoring_eval_posture_version: "1",
    ambition: posture.ambition,
    audience: posture.audience,
    handoff: posture.handoff,
    collaboration: posture.collaboration,
    guidance: [
      GUIDANCE.ambition[posture.ambition],
      GUIDANCE.audience[posture.audience],
      GUIDANCE.handoff[posture.handoff],
      GUIDANCE.collaboration[posture.collaboration]
    ],
    addition_rule: ADDITION_RULE
  };
}

export function validateAuthoringPosture(value, expectedInput) {
  let expected;
  try {
    expected = createAuthoringPosture(expectedInput);
  } catch (error) {
    return [error.message];
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["authoring posture must be an object"];
  }
  return JSON.stringify(value) === JSON.stringify(expected)
    ? []
    : ["authoring posture does not match the controller-derived posture"];
}

export function authoringPostureHandoff() {
  return `
The author completed a private authoring-intent preflight. Read
\`authoring/posture.json\` before editing and use it to allocate attention.
The posture controls authoring depth; it is not product intent. Do not copy its
labels or guidance into the package unless visible product sources independently
support the same meaning. Decide how much detail and questioning the selected
handoff requires. Before finishing, apply its addition rule and stop condition.
`;
}
