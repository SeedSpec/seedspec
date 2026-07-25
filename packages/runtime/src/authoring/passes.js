// Reading pass records for the operation layer.
//
// Deliberately lenient in the same way `listPasses` is: an operation should be
// able to act on the open pass even when an unrelated historical pass predates
// the current format or was hand-edited into an invalid shape.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const TERMINAL_OUTCOMES = new Set(["reviewed", "completed", "abandoned", "superseded"]);
const OPEN_OUTCOMES = new Set(["in-progress", "needs-author"]);

async function readYamlOrNull(filePath) {
  try {
    return parseYaml(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Guarantees the collections an operation appends to exist, so a record written
// by an older format does not need a migration before it can be appended to.
function withCollections(result) {
  const shaped = { ...result };
  for (const field of ["findings", "contradictions", "inventory", "suggestions", "tooling_feedback"]) {
    if (!Array.isArray(shaped[field])) shaped[field] = [];
  }
  if (!isObject(shaped.questions)) shaped.questions = {};
  for (const field of ["asked", "answered", "declined"]) {
    if (!Array.isArray(shaped.questions[field])) shaped.questions[field] = [];
  }
  if (!isObject(shaped.changes)) shaped.changes = {};
  for (const field of ["applied", "proposed", "rejected"]) {
    if (!Array.isArray(shaped.changes[field])) shaped.changes[field] = [];
  }
  if (!isObject(shaped.validation)) shaped.validation = { protocol_valid: true, commands: [] };
  return shaped;
}

export async function readAuthoringPasses(stateRoot) {
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
    const request = await readYamlOrNull(path.join(root, "request.yaml"));
    const result = await readYamlOrNull(path.join(root, "result.yaml"));
    if (!isObject(request) || !isObject(result)) continue;
    passes.push({
      id: request.pass ?? entry.name,
      root,
      request,
      result: withCollections(result),
      open: OPEN_OUTCOMES.has(result.outcome),
      terminal: TERMINAL_OUTCOMES.has(result.outcome)
    });
  }
  return passes;
}
