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
    description: manifest.description ?? null,
    metadata: manifest.metadata ?? {},
    definition: {
      entrypoint: manifest.definition.entrypoint,
      artifact: manifest.definition.artifact ?? null
    },
    configuration: {
      schema: manifest.configuration.schema,
      example: manifest.configuration.example,
      guide: manifest.configuration.guide ?? null
    },
    requires: manifest.requires?.capabilities ?? [],
    provides: manifest.provides.capabilities,
    conflicts: manifest.conflicts ?? { packages: [], capabilities: [] },
    decisions: manifest.decisions ?? [],
    implementationProfiles: manifest.implementation_profiles ?? [],
    components: manifest.components ?? {},
    artifacts: manifest.artifacts ?? [],
    relationships: manifest.relationships ?? [],
    tasks: record.taskRunbook
      ? { path: manifest.tasks, items: record.taskRunbook.tasks }
      : null,
    implementationResources: manifest.implementation_resources ?? null,
    compatibility: manifest.compatibility ?? null,
    extensions: manifest.extensions ?? {}
  };
}

export function formatInspection(inspection) {
  const lines = [
    `${inspection.name} (${inspection.id}@${inspection.version})`,
    `Kind hint: ${inspection.kind}`,
    `Protocol: ${inspection.protocolVersion}`,
    `Digest: ${inspection.digest}`,
    `Description: ${inspection.description ?? "not declared"}`,
    `Metadata: ${Object.keys(inspection.metadata).length ? Object.keys(inspection.metadata).sort().join(", ") : "none"}`,
    `Definition: ${inspection.definition.entrypoint}${inspection.definition.artifact ? ` (primary intent artifact: ${inspection.definition.artifact})` : " (native SeedSpec intent)"}`,
    `Configuration: ${inspection.configuration.schema} (example: ${inspection.configuration.example})`,
    `Requires: ${inspection.requires.length ? inspection.requires.map((requirement) => (
      `${requirement.id} (tested against ${requirement.tested_against})`
    )).join(", ") : "none"}`,
    `Provides: ${inspection.provides.length ? inspection.provides.map((capability) => `${capability.id}@${capability.version}${capability.change_history?.length ? ` (${capability.change_history.length} revision transition(s))` : ""}${capability.conformance ? ` (conformance: ${capability.conformance.suite})` : ""}`).join(", ") : "none"}`,
    `Components: ${Object.keys(inspection.components).length ? Object.keys(inspection.components).sort().join(", ") : "none"}`,
    `Artifacts: ${inspection.artifacts.length ? inspection.artifacts.map((artifact) => `${artifact.id} (${artifact.type})`).join(", ") : "none"}`,
    `Tasks: ${inspection.tasks ? `${inspection.tasks.items.length} ordered task(s) at ${inspection.tasks.path}` : "none"}`,
    `Implementation profiles: ${inspection.implementationProfiles.length
      ? inspection.implementationProfiles.map((profile) => `${profile.id} (${profile.name})`).join(", ")
      : "none"}`,
    `Implementation resources: ${inspection.implementationResources?.resources.length
      ? inspection.implementationResources.resources.map((resource) => `${resource.id} (${resource.kind}; ${resource.usage})`).join(", ")
      : "none"}`,
    `Additional guidance: ${inspection.implementationResources?.additional_guidance ?? "unspecified"}`,
    `Extensions: ${Object.keys(inspection.extensions).length ? Object.keys(inspection.extensions).sort().join(", ") : "none"}`
  ];

  if (inspection.compatibility) {
    lines.push(`Compatibility: ${inspection.compatibility.scope}`);
  }

  return lines.join("\n");
}
