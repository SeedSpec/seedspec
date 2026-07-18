import { validatePackage } from "./validate.js";

export async function inspectPackage(inputPath) {
  const record = await validatePackage(inputPath);
  const { manifest } = record;

  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    digest: record.digest,
    protocolVersion: manifest.protocol_version,
    kind: manifest.kind,
    definition: manifest.definition.entrypoint,
    configuration: {
      schema: manifest.configuration.schema,
      example: manifest.configuration.example,
      guide: manifest.configuration.guide ?? null
    },
    requires: manifest.requires?.capabilities ?? [],
    provides: manifest.provides.capabilities,
    conflicts: manifest.conflicts ?? { packages: [], capabilities: [] },
    decisions: manifest.decisions ?? [],
    components: manifest.components ?? {},
    artifacts: manifest.artifacts ?? [],
    relationships: manifest.relationships ?? [],
    compatibility: manifest.compatibility ?? null,
    extensions: manifest.extensions ?? {}
  };
}

export function formatInspection(inspection) {
  const lines = [
    `${inspection.name} (${inspection.id}@${inspection.version})`,
    `Kind: ${inspection.kind}`,
    `Protocol: ${inspection.protocolVersion}`,
    `Digest: ${inspection.digest}`,
    `Definition: ${inspection.definition}`,
    `Configuration: ${inspection.configuration.schema} (example: ${inspection.configuration.example})`,
    `Requires: ${inspection.requires.length ? inspection.requires.map((requirement) => (
      `${requirement.id} (tested against ${requirement.tested_against})`
    )).join(", ") : "none"}`,
    `Provides: ${inspection.provides.length ? inspection.provides.map((capability) => `${capability.id}@${capability.version}`).join(", ") : "none"}`,
    `Components: ${Object.keys(inspection.components).length ? Object.keys(inspection.components).sort().join(", ") : "none"}`,
    `Artifacts: ${inspection.artifacts.length ? inspection.artifacts.map((artifact) => `${artifact.id} (${artifact.type})`).join(", ") : "none"}`,
    `Extensions: ${Object.keys(inspection.extensions).length ? Object.keys(inspection.extensions).sort().join(", ") : "none"}`
  ];

  if (inspection.compatibility) {
    lines.push(`Compatibility: ${inspection.compatibility.scope}`);
  }

  return lines.join("\n");
}
