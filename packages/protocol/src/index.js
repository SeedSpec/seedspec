import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const protocolPackageVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;

export const protocolReleasePath = fileURLToPath(
  new URL("../protocol-release.json", import.meta.url)
);
export const conformanceBundlePath = fileURLToPath(
  new URL("../conformance-bundle.json", import.meta.url)
);
const protocolReleaseBytes = readFileSync(protocolReleasePath);
export const protocolRelease = Object.freeze(
  JSON.parse(protocolReleaseBytes.toString("utf8"))
);
export const protocolVersion = protocolRelease.protocol_family;
export const conformanceSuiteVersion = protocolRelease.conformance.suite_version;
export const protocolReleaseDigest = `sha256:${createHash("sha256")
  .update(protocolReleaseBytes)
  .digest("hex")}`;

export const protocolSchemaNames = Object.freeze([
  "seedspec.schema.json",
  "conformance.schema.json",
  "conformance-report.schema.json"
]);

export const schemaDirectory = fileURLToPath(
  new URL("../schemas/v0.4/", import.meta.url)
);
export const protocolDocumentDirectory = fileURLToPath(
  new URL("../documents/", import.meta.url)
);
