import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SeedSpecError } from "./errors.js";

export const AUTHORING_SCHEMA_FORMAT = "1";

// Authoring state is workspace state, not distributable package content, so
// these schemas deliberately live outside packages/protocol/schemas and are not
// protocol conformance surface.
const AUTHORING_SCHEMAS = Object.freeze({
  result: "authoring-pass-result.schema.json",
  changes: "authoring-change-proposals.schema.json"
});

const schemaDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "schemas",
  "authoring",
  "v1"
);

export function listAuthoringSchemas() {
  return Object.keys(AUTHORING_SCHEMAS);
}

export async function readAuthoringSchema(name) {
  const file = AUTHORING_SCHEMAS[name];
  if (!file) {
    throw new SeedSpecError(`Unknown authoring schema: ${name}`, {
      code: "UNKNOWN_AUTHORING_SCHEMA",
      details: [`available: ${listAuthoringSchemas().join(", ")}`]
    });
  }
  return JSON.parse(await readFile(path.join(schemaDirectory, file), "utf8"));
}
