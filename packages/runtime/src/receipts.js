import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  protocolRelease,
  protocolReleaseDigest
} from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import {
  computeFileDigest,
  computeSelectedDirectoryDigest
} from "./integrity.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";

const runtimeVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;

const PROTOCOL_OWNED_RESOLUTION_PATHS = Object.freeze([
  "project.yaml",
  "dependencies.lock.yaml",
  "resolved-config.yaml",
  "resolved-intent.yaml",
  "completion-scope.yaml",
  "tasks.yaml",
  "task-references",
  "components.yaml",
  "components",
  "artifacts.yaml",
  "artifacts",
  "implementation-profile-state.yaml",
  "implementation-profiles",
  "implementation-resources.yaml",
  "agent-guide.md",
  "resolved-spec.md",
  "additions"
]);

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])])
    );
  }
  return value;
}

function canonicalDigest(value) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)), "utf8")
    .digest("hex")}`;
}

async function inputDigests(inputs) {
  const fields = [
    ["configuration_selections", inputs.configurationSelectionsPath],
    ["applied_intent", inputs.appliedIntentPath],
    ["completion_scope", inputs.completionScopePath],
    ["technical_preferences", inputs.technicalPreferencesPath],
    ["artifact_selections", inputs.artifactSelectionsPath],
    ["decisions", inputs.decisionsPath]
  ];
  return Object.fromEntries(await Promise.all(
    fields
      .filter(([, filePath]) => filePath)
      .map(async ([name, filePath]) => [
        name,
        await computeFileDigest(path.resolve(filePath))
      ])
  ));
}

function receiptPackage(record) {
  return {
    id: record.manifest.id,
    version: record.manifest.version,
    digest: record.digest
  };
}

export async function createResolutionReceipt({
  workspace,
  root,
  additions,
  projectStatus,
  implementationProfiles,
  inputs
}) {
  const subject = {
    operation: "resolve",
    protocol_release: {
      id: protocolRelease.release_id,
      digest: protocolReleaseDigest
    },
    packages: {
      root: receiptPackage(root),
      additions: additions.map(receiptPackage)
    },
    inputs: {
      ...await inputDigests(inputs),
      ...(implementationProfiles.length > 0
        ? { implementation_profiles: implementationProfiles }
        : {})
    },
    result: {
      status: projectStatus,
      output_digest: await computeSelectedDirectoryDigest(
        workspace,
        PROTOCOL_OWNED_RESOLUTION_PATHS
      )
    }
  };
  const receipt = {
    receipt_version: "1",
    receipt_id: canonicalDigest(subject),
    subject,
    producer: {
      name: "@seedspec/runtime",
      version: runtimeVersion
    }
  };
  const validate = await compileProtocolSchema("resolution-receipt.schema.json");
  if (!validate(receipt)) {
    throw new SeedSpecError("Resolution produced an invalid receipt", {
      code: "INVALID_RESOLUTION_RECEIPT",
      details: formatSchemaErrors(validate.errors)
    });
  }
  await writeFile(
    path.join(workspace, "resolution-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    "utf8"
  );
  return receipt;
}

export { PROTOCOL_OWNED_RESOLUTION_PATHS };
