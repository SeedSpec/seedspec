import { validatePackage } from "./validate.js";

function inspectChild(edge) {
  return {
    id: edge.record.manifest.id,
    name: edge.record.manifest.name,
    version: edge.record.manifest.version,
    digest: edge.record.digest,
    path: edge.declaration.path,
    optional: edge.declaration.optional ?? false,
    capabilities: edge.record.manifest.capabilities ?? {},
    children: edge.record.bundledPackages.map(inspectChild)
  };
}

export async function inspectPackage(inputPath) {
  const record = await validatePackage(inputPath);
  const { manifest } = record;
  const anchoredCriteria = new Set(
    record.provenance.success_anchors.map(({ id }) => id)
  );
  return {
    inspection_version: "0.4",
    id: manifest.id,
    name: manifest.name,
    kind: manifest.kind ?? null,
    description: manifest.description ?? null,
    metadata: manifest.metadata ?? null,
    version: manifest.version,
    target_protocol: manifest.target_protocol ?? null,
    protocol: manifest.target_protocol ?? "0.4",
    digest: record.digest,
    sources: {
      spec: record.specPath,
      base_manifest: record.manifestPath,
      values: record.provenance.sources
    },
    resolved_manifest: manifest,
    overrides: record.provenance.overrides,
    sections: record.provenance.sections,
    success_anchors: record.provenance.success_anchors,
    unanchored_success_criteria: (manifest.success?.criteria ?? [])
      .filter(({ id }) => !anchoredCriteria.has(id))
      .map(({ id }) => id),
    configuration: manifest.configuration ?? null,
    success: manifest.success ?? null,
    tasks: manifest.tasks ?? null,
    capabilities: manifest.capabilities ?? null,
    context_modules: manifest.context_modules ?? [],
    bundled_packages: record.bundledPackages.map(inspectChild),
    extensions: manifest.extensions ?? {}
  };
}

export function formatInspection(inspection) {
  const capabilities = inspection.capabilities?.items ?? [];
  return [
    `${inspection.name} (${inspection.id}@${inspection.version})`,
    `Kind: ${inspection.kind ?? "none"}`,
    `Protocol: ${inspection.protocol}`,
    `Digest: ${inspection.digest}`,
    `SPEC.md: ${inspection.sources.spec}`,
    `Base manifest: ${inspection.sources.base_manifest ?? "none"}`,
    `Overrides: ${inspection.overrides.length}`,
    `Expanded sections: ${inspection.sections.length}`,
    `Configuration variables: ${inspection.configuration?.variables?.length ?? 0}`,
    `Success criteria: ${inspection.success?.criteria?.length ?? 0}`,
    `Success anchors: ${inspection.success_anchors.length}`,
    `Unanchored criteria: ${inspection.unanchored_success_criteria.length}`,
    `Tasks: ${inspection.tasks?.items?.length ?? 0}`,
    `Capabilities: ${capabilities.length ? capabilities.map(({ id }) => id).join(", ") : "none"}`,
    `Context modules: ${inspection.context_modules.length}`,
    `Bundled packages: ${inspection.bundled_packages.length}`
  ].join("\n");
}
