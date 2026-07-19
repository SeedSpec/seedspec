import { fileURLToPath } from "node:url";

export const protocolVersion = "0.1";

export const protocolSchemaNames = Object.freeze([
  "seedspec.schema.json",
  "application.schema.json",
  "feature.schema.json",
  "project.schema.json",
  "component-index.schema.json",
  "artifact-index.schema.json",
  "artifact-selections.schema.json",
  "configuration-selections.schema.json",
  "technical-preferences.schema.json",
  "lock.schema.json",
  "resolved-config.schema.json",
  "conformance.schema.json"
]);

export const schemaDirectory = fileURLToPath(
  new URL("../schemas/v0.1/", import.meta.url)
);
