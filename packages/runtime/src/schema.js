import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { protocolSchemaNames, schemaDirectory } from "@seedspec/protocol";

function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

export async function loadProtocolSchema(name) {
  return JSON.parse(await readFile(path.join(schemaDirectory, name), "utf8"));
}

export async function compileProtocolSchema(name) {
  const ajv = createAjv();
  const schemas = await Promise.all(protocolSchemaNames.map(loadProtocolSchema));
  for (const schema of schemas) ajv.addSchema(schema);

  const selected = schemas[protocolSchemaNames.indexOf(name)];
  if (!selected) throw new Error(`Unknown protocol schema: ${name}`);
  return ajv.getSchema(selected.$id);
}

export function compileConfigurationSchema(schema) {
  return createAjv().compile(schema);
}

export function formatSchemaErrors(errors) {
  return (errors ?? []).map((error) => {
    const location = error.instancePath || "/";
    const extra = error.params?.additionalProperty
      ? ` (${error.params.additionalProperty})`
      : "";
    return `${location} ${error.message}${extra}`;
  });
}
