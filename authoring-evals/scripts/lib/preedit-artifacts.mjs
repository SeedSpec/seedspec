import {
  conflictInventoryPrompt,
  validateConflictInventory
} from "./conflict-inventory.mjs";

function nonemptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function sourceReference(value) {
  return nonemptyString(value)
    || (Array.isArray(value) && value.length > 0 && value.every(nonemptyString));
}

function structuredStep(value) {
  if (nonemptyString(value)) return true;
  if (Array.isArray(value)) return value.length > 0 && value.every(nonemptyString);
  return Boolean(value) && typeof value === "object" && Object.keys(value).length > 0;
}

function records(value, minimum, label, issues) {
  if (!Array.isArray(value) || value.length < minimum) {
    issues.push(`${label} must contain at least ${String(minimum)} item(s)`);
    return [];
  }
  if (value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    issues.push(`${label} items must be objects`);
    return [];
  }
  return value;
}

function fields(items, required, label, issues) {
  for (const [index, item] of items.entries()) {
    for (const field of required) {
      const valid = field === "source" ? sourceReference(item[field]) : nonemptyString(item[field]);
      if (!valid) {
        issues.push(`${label}[${String(index)}].${field} must be nonempty`);
      }
    }
  }
}

function stringList(value, minimum, label, issues) {
  if (!Array.isArray(value) || value.length < minimum || value.some((item) => !nonemptyString(item))) {
    issues.push(`${label} must contain at least ${String(minimum)} nonempty string(s)`);
  }
}

function version(inventory, key, issues) {
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    issues.push("artifact must be an object");
    return false;
  }
  if (inventory[key] !== "1") issues.push(`${key} must be 1`);
  return true;
}

function validateDecisionContract(artifact) {
  const issues = [];
  if (!version(artifact, "authoring_eval_decision_contract_version", issues)) return issues;
  const decisions = records(artifact.decisions, 1, "decisions", issues);
  fields(decisions, ["id", "source", "question", "consequence", "resolver", "status"], "decisions", issues);
  for (const [index, decision] of decisions.entries()) {
    stringList(decision.outcome_bounds, 1, `decisions[${String(index)}].outcome_bounds`, issues);
    stringList(decision.blocked_actions, 1, `decisions[${String(index)}].blocked_actions`, issues);
  }
  return issues;
}

function validateIntentRegistry(artifact) {
  const issues = [];
  if (!version(artifact, "authoring_eval_intent_registry_version", issues)) return issues;
  const claims = records(artifact.claims, 2, "claims", issues);
  fields(claims, ["id", "kind", "source", "authority", "statement", "materiality"], "claims", issues);
  for (const [index, claim] of claims.entries()) {
    stringList(claim.package_targets, 1, `claims[${String(index)}].package_targets`, issues);
  }
  const forbidden = records(artifact.forbidden_scope, 1, "forbidden_scope", issues);
  fields(forbidden, ["id", "source", "statement"], "forbidden_scope", issues);
  const latitude = records(artifact.permitted_latitude, 1, "permitted_latitude", issues);
  fields(latitude, ["id", "source", "bounds"], "permitted_latitude", issues);
  return issues;
}

function validateSemanticChangePlan(artifact) {
  const issues = [];
  if (!version(artifact, "authoring_eval_semantic_change_plan_version", issues)) return issues;
  const approved = records(artifact.approved_changes, 1, "approved_changes", issues);
  fields(approved, ["id", "source", "authority", "change"], "approved_changes", issues);
  for (const [index, change] of approved.entries()) {
    stringList(change.package_targets, 1, `approved_changes[${String(index)}].package_targets`, issues);
  }
  const preserved = records(artifact.preserved_invariants, 1, "preserved_invariants", issues);
  fields(preserved, ["id", "source", "statement"], "preserved_invariants", issues);
  const excluded = records(artifact.excluded_ideas, 1, "excluded_ideas", issues);
  fields(excluded, ["id", "source", "reason"], "excluded_ideas", issues);
  const decisions = records(artifact.decision_edges, 1, "decision_edges", issues);
  fields(decisions, ["id", "question", "resolver"], "decision_edges", issues);
  if (!artifact.impact_summary || typeof artifact.impact_summary !== "object"
      || Array.isArray(artifact.impact_summary)) {
    issues.push("impact_summary must be an object");
  } else {
    for (const key of [
      "obligations_added", "obligations_removed", "decisions_reopened",
      "latitude_narrowed", "protected_paths_touched"
    ]) {
      if (!Array.isArray(artifact.impact_summary[key])) {
        issues.push(`impact_summary.${key} must be an array`);
      }
    }
  }
  return issues;
}

function validateAcceptanceContract(artifact) {
  const issues = [];
  if (!version(artifact, "authoring_eval_acceptance_contract_version", issues)) return issues;
  const scenarios = records(artifact.scenarios, 3, "scenarios", issues);
  fields(scenarios, ["id", "source", "when"], "scenarios", issues);
  for (const [index, scenario] of scenarios.entries()) {
    if (!structuredStep(scenario.given)) issues.push(`scenarios[${String(index)}].given must be nonempty`);
    if (!structuredStep(scenario.then)) issues.push(`scenarios[${String(index)}].then must be nonempty`);
    if (!structuredStep(scenario.forbidden)) {
      issues.push(`scenarios[${String(index)}].forbidden must be nonempty`);
    }
  }
  const failures = records(artifact.failure_scenarios, 1, "failure_scenarios", issues);
  fields(failures, ["id", "source", "when"], "failure_scenarios", issues);
  for (const [index, scenario] of failures.entries()) {
    if (!structuredStep(scenario.given)) {
      issues.push(`failure_scenarios[${String(index)}].given must be nonempty`);
    }
    if (!structuredStep(scenario.then)) {
      issues.push(`failure_scenarios[${String(index)}].then must be nonempty`);
    }
  }
  const configuration = records(
    artifact.configuration_invariants,
    1,
    "configuration_invariants",
    issues
  );
  fields(configuration, ["id", "source", "field", "requirement"], "configuration_invariants", issues);
  return issues;
}

const definitions = {
  conflict_inventory: {
    file: "conflict-inventory.json",
    prompt: conflictInventoryPrompt,
    validate: validateConflictInventory,
    next: "The conflict inventory is frozen. Read it, the package, and every visible source. Complete the package directly. Preserve every governing control and unresolved authority boundary. Do not select a blocked candidate. Ask one consequential author question if needed; otherwise validate and lint."
  },
  decision_contract: {
    file: "decision-contract.json",
    prompt: `Read HANDOFF.md completely. This turn is analysis only. Do not edit
any file under seedspec/ and do not ask the author a question. Read the package
and every visible source. Create authoring/decision-contract.json with:

- authoring_eval_decision_contract_version: "1"
- decisions: one object for every consequential author choice, with id, source,
  question, consequence, resolver, status, outcome_bounds, and blocked_actions

Use status "unresolved". Do not invent answers. Record the behavioral bounds
that any answer must preserve. Stop after writing the contract.`,
    validate: validateDecisionContract,
    next: "The decision contract is frozen. Ask the author its consequential questions one at a time before editing. The controller records accepted answers in authoring/decision-ledger.json. Apply every recorded answer, preserve all outcome bounds, and complete the package across the required fresh session."
  },
  intent_registry: {
    file: "intent-registry.json",
    prompt: `Read HANDOFF.md completely. This turn is analysis only. Do not edit
any file under seedspec/ and do not ask the author a question. Read the package
and every visible source. Create authoring/intent-registry.json with:

- authoring_eval_intent_registry_version: "1"
- claims: source-backed objects with id, kind, source, authority, statement,
  materiality, and package_targets
- forbidden_scope: objects with id, source, and statement
- permitted_latitude: objects with id, source, and bounds

Cover every governing source. Keep contradictory claims separate. Stop after
writing the registry.`,
    validate: validateIntentRegistry,
    next: "The intent registry is frozen. Complete the package directly. Map every material claim into primary intent and observable acceptance, preserve forbidden scope and permitted latitude, and keep contradictions explicit. Ask one consequential author question if needed; otherwise validate and lint."
  },
  semantic_change_plan: {
    file: "semantic-change-plan.json",
    prompt: `Read HANDOFF.md completely. This turn is analysis only. Do not edit
any file under seedspec/ and do not ask the author a question. Compare the
existing package with every visible source. Create
authoring/semantic-change-plan.json with:

- authoring_eval_semantic_change_plan_version: "1"
- approved_changes: objects with id, source, authority, change, package_targets
- preserved_invariants: objects with id, source, statement
- excluded_ideas: objects with id, source, reason
- decision_edges: objects with id, question, resolver
- impact_summary arrays for obligations_added, obligations_removed,
  decisions_reopened, latitude_narrowed, and protected_paths_touched

Plan only source-authorized changes. Stop after writing the plan.`,
    validate: validateSemanticChangePlan,
    next: "The semantic change plan is frozen. Apply only its approved changes. Preserve every invariant, exclude every unapproved idea, resolve consequential decision edges one at a time, and do not narrow implementation latitude without authority. Then validate and lint."
  },
  acceptance_contract: {
    file: "acceptance-contract.json",
    prompt: `Read HANDOFF.md completely. This turn is analysis only. Do not edit
any file under seedspec/ and do not ask the author a question. Read the package
and every visible source. Create authoring/acceptance-contract.json with:

- authoring_eval_acceptance_contract_version: "1"
- scenarios: at least three objects with id, source, given, when, then, forbidden
- failure_scenarios: objects with id, source, given, when, then
- configuration_invariants: objects with id, source, field, requirement

Make each outcome observable. Include negative behavior and configuration needed
to execute the scenarios. Do not invent implementation technology. Stop after
writing the contract.`,
    validate: validateAcceptanceContract,
    next: "The acceptance contract is frozen. Complete the package directly. Carry every scenario, negative outcome, failure behavior, and configuration invariant into coherent primary intent, configuration, and acceptance material. Ask one consequential author question if needed; otherwise validate and lint."
  }
};

export const isolatedMechanismNames = [
  "decision_ledger",
  "final_review",
  "authoring_posture",
  "posture_confirmation",
  "posture_fused_confirmation",
  "fixed_claim_gate",
  ...Object.keys(definitions)
];

export function preeditArtifact(mechanisms) {
  const name = Object.keys(definitions).find((candidate) => mechanisms[candidate] === true);
  return name ? { name, ...definitions[name] } : null;
}

export function mechanismSelectionSupported(mechanisms) {
  const enabled = isolatedMechanismNames.filter((name) => mechanisms?.[name] === true);
  if (enabled.length <= 1) return true;
  return enabled.length === 2
    && enabled.includes("posture_fused_confirmation")
    && enabled.includes("fixed_claim_gate");
}
