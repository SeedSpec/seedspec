function nonemptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function objectItems(value, minimum, label, issues) {
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

function requireFields(items, fields, label, issues) {
  for (const [index, item] of items.entries()) {
    for (const field of fields) {
      if (!nonemptyString(item[field])) {
        issues.push(`${label}[${String(index)}].${field} must be a nonempty string`);
      }
    }
  }
}

export function validateConflictInventory(inventory) {
  const issues = [];
  if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) {
    return ["conflict inventory must be an object"];
  }
  if (inventory.authoring_eval_conflict_inventory_version !== "1") {
    issues.push("authoring_eval_conflict_inventory_version must be 1");
  }

  const controls = objectItems(inventory.governing_controls, 2, "governing_controls", issues);
  requireFields(controls, ["id", "source", "requirement"], "governing_controls", issues);

  const conflicts = objectItems(inventory.conflicts, 1, "conflicts", issues);
  requireFields(conflicts, ["id", "description"], "conflicts", issues);
  for (const [index, conflict] of conflicts.entries()) {
    if (!Array.isArray(conflict.control_ids) || conflict.control_ids.length === 0
        || conflict.control_ids.some((id) => !nonemptyString(id))) {
      issues.push(`conflicts[${String(index)}].control_ids must be nonempty`);
    }
  }
  if (conflicts.length > 0 && !conflicts.some(({ control_ids: controlIds }) => (
    Array.isArray(controlIds) && controlIds.length >= 2
  ))) {
    issues.push("at least one conflict must connect two or more governing controls");
  }

  const boundaries = objectItems(
    inventory.authority_boundaries,
    1,
    "authority_boundaries",
    issues
  );
  requireFields(boundaries, ["id", "source", "authority"], "authority_boundaries", issues);

  const decisions = objectItems(inventory.unresolved_decisions, 1, "unresolved_decisions", issues);
  requireFields(decisions, ["id", "question", "resolver"], "unresolved_decisions", issues);
  for (const [index, decision] of decisions.entries()) {
    if (!Array.isArray(decision.blocked_actions) || decision.blocked_actions.length === 0
        || decision.blocked_actions.some((action) => !nonemptyString(action))) {
      issues.push(`unresolved_decisions[${String(index)}].blocked_actions must be nonempty`);
    }
  }

  const candidates = objectItems(inventory.candidates, 1, "candidates", issues);
  requireFields(candidates, ["id", "selection_status"], "candidates", issues);
  for (const [index, candidate] of candidates.entries()) {
    const compatibility = candidate.control_compatibility;
    const validString = nonemptyString(compatibility);
    const validArray = Array.isArray(compatibility)
      && compatibility.length > 0
      && compatibility.every(nonemptyString);
    const validObject = compatibility
      && typeof compatibility === "object"
      && !Array.isArray(compatibility)
      && Object.keys(compatibility).length > 0
      && Object.entries(compatibility).every(([controlId, assessment]) => (
        nonemptyString(controlId) && nonemptyString(assessment)
      ));
    if (!validString && !validArray && !validObject) {
      issues.push(`candidates[${String(index)}].control_compatibility must be nonempty`);
    }
  }
  return issues;
}

export const conflictInventoryPrompt = `Read HANDOFF.md completely. This turn is
analysis only. Do not edit any file under seedspec/ and do not ask the author a
question. Read the existing package and every visible source. Create
authoring/conflict-inventory.json with these exact top-level fields:

- authoring_eval_conflict_inventory_version: "1"
- governing_controls: at least two objects with id, source, and requirement
- conflicts: objects with id, control_ids, and description
- authority_boundaries: objects with id, source, and authority
- unresolved_decisions: objects with id, question, resolver, and blocked_actions
- candidates: objects with id, control_compatibility, and selection_status

Ground every entry in the visible sources. Preserve contradictions and
unresolved decisions. Do not choose a winner or invent a resolution. Stop after
writing the inventory.`;
