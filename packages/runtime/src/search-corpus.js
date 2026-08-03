import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  protocolDocumentDirectory,
  protocolRelease,
  protocolReleaseDigest
} from "@seedspec/protocol";
import { resolvePackagePath } from "./files.js";
import { createSearchIndex } from "./search.js";

function portablePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

async function markdownFiles(root, declarationPath) {
  const declared = resolvePackagePath(root, declarationPath);
  const info = await stat(declared);
  if (info.isFile()) return declared.endsWith(".md") ? [declared] : [];
  if (!info.isDirectory()) return [];

  const files = [];
  async function visit(directory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(entryPath);
    }
  }
  await visit(declared);
  return files;
}

function sourceKey(source) {
  return `${source.scope}\0${source.package ?? ""}\0${source.path}`;
}

async function addMarkdownSource(sources, seen, record, relativePath, metadata) {
  for (const filePath of await markdownFiles(record.root, relativePath)) {
    const source = {
      ...metadata,
      package: record.manifest.id,
      path: portablePath(record.root, filePath),
      text: await readFile(filePath, "utf8")
    };
    const key = sourceKey(source);
    if (!seen.has(key)) {
      seen.add(key);
      sources.push(source);
    }
  }
}

function addSyntheticSource(sources, seen, source) {
  const key = sourceKey(source);
  if (seen.has(key)) return;
  seen.add(key);
  sources.push(source);
}

function packageRecords(root) {
  const records = [];
  const visited = new Set();
  function visit(record) {
    const key = `${record.manifest.id}\0${record.digest}`;
    if (visited.has(key)) return;
    visited.add(key);
    records.push(record);
    for (const edge of record.composition.includes) visit(edge.record);
  }
  visit(root);
  return records;
}

function profileSummary(profile) {
  const lines = [
    `# ${profile.name}`,
    "",
    `ID: ${profile.id}`,
    "",
    profile.description
  ];
  if (profile.prerequisites?.length) {
    lines.push("", "## Prerequisites", ...profile.prerequisites.map((item) => `- ${item.id}: ${item.statement}`));
  }
  if (profile.blockers?.length) {
    lines.push("", "## Blockers", ...profile.blockers.map((item) => `- ${item.id}: ${item.statement}`));
  }
  if (profile.tradeoffs?.length) lines.push("", "## Tradeoffs", ...profile.tradeoffs.map((item) => `- ${item}`));
  return lines.join("\n");
}

function artifactSummary(artifact) {
  return [
    `# ${artifact.label ?? artifact.id}`,
    "",
    `ID: ${artifact.id}`,
    `Type: ${artifact.type}`,
    `Location: ${artifact.path ?? artifact.url ?? "not declared"}`,
    `Concerns: ${artifact.concerns?.join(", ") ?? "unspecified"}`,
    "",
    artifact.description ?? "No description declared."
  ].join("\n");
}

function contextSummary(module, isPrimary) {
  return [
    `# ${module.id}`,
    "",
    `Role: ${isPrimary ? "primary-intent" : "supporting"}`,
    `Format: ${module.format}`,
    `Entrypoint: ${module.entrypoint}`,
    `Source: ${module.source.kind}`,
    "",
    module.description
  ].join("\n");
}

function resourceSummary(resource) {
  return [
    `# ${resource.declares?.name ?? resource.id}`,
    "",
    `ID: ${resource.id}`,
    `Kind: ${resource.kind}`,
    `Usage: ${resource.usage}`,
    `Version: ${resource.version}`,
    `Entrypoint: ${resource.entrypoint}`,
    "",
    resource.description,
    ...(resource.declares?.description ? ["", resource.declares.description] : [])
  ].join("\n");
}

async function packageSources(record, sources, seen) {
  const manifest = record.manifest;
  await addMarkdownSource(sources, seen, record, portablePath(record.root, record.definitionPath), {
    scope: "package",
    role: "product-intent",
    authority: "authoritative",
    identifiers: [manifest.id, manifest.definition.module]
  });

  for (const edge of record.composition.includes) {
    await addMarkdownSource(sources, seen, record, edge.integration, {
      scope: "package",
      role: "composition-integration",
      authority: "authoritative",
      identifiers: [edge.id, edge.package, manifest.id]
    });
  }

  for (const [name, componentPath] of Object.entries(manifest.components ?? {})) {
    await addMarkdownSource(sources, seen, record, componentPath, {
      scope: "package",
      role: name === "acceptance" ? "acceptance" : `component:${name}`,
      authority: "authoritative",
      identifiers: [manifest.id, name]
    });
  }

  if (manifest.configuration.guide) {
    await addMarkdownSource(sources, seen, record, manifest.configuration.guide, {
      scope: "package",
      role: "configuration",
      authority: "authoritative",
      identifiers: [manifest.id, "configuration"]
    });
  }

  for (const capability of manifest.provides.capabilities) {
    await addMarkdownSource(sources, seen, record, capability.contract, {
      scope: "package",
      role: "capability-contract",
      authority: "authoritative",
      identifiers: [manifest.id, capability.id, `${capability.id}@${capability.version}`]
    });
  }

  for (const profile of manifest.implementation_profiles ?? []) {
    addSyntheticSource(sources, seen, {
      scope: "package",
      role: "implementation-profile",
      authority: "guidance",
      package: manifest.id,
      path: `seedspec.yaml#implementation_profiles/${profile.id}`,
      identifiers: [manifest.id, profile.id],
      text: profileSummary(profile)
    });
    if (profile.guidance) {
      await addMarkdownSource(sources, seen, record, profile.guidance, {
        scope: "package",
        role: "implementation-profile",
        authority: "guidance",
        identifiers: [manifest.id, profile.id]
      });
    }
  }

  for (const artifact of manifest.artifacts ?? []) {
    addSyntheticSource(sources, seen, {
      scope: "package",
      role: "artifact-summary",
      authority: "declaration",
      package: manifest.id,
      path: `seedspec.yaml#artifacts/${artifact.id}`,
      identifiers: [manifest.id, artifact.id, artifact.type],
      text: artifactSummary(artifact)
    });
  }

  for (const module of manifest.context.modules) {
    addSyntheticSource(sources, seen, {
      scope: "package",
      role: "context-summary",
      authority: "declaration",
      package: manifest.id,
      path: `seedspec.yaml#context/${module.id}`,
      identifiers: [manifest.id, module.id, module.format],
      text: contextSummary(module, module.id === manifest.definition.module)
    });
  }

  for (const resource of manifest.implementation_resources?.resources ?? []) {
    addSyntheticSource(sources, seen, {
      scope: "package",
      role: "implementation-resource-summary",
      authority: "declaration",
      package: manifest.id,
      path: `seedspec.yaml#implementation_resources/${resource.id}`,
      identifiers: [manifest.id, resource.id, resource.kind],
      text: resourceSummary(resource)
    });
  }
}

async function protocolSources(sources, seen) {
  for (const document of protocolRelease.documents) {
    const filename = document.path.replace(/^documents\//u, "");
    const documentPath = path.join(protocolDocumentDirectory, filename);
    const bytes = await readFile(documentPath);
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (digest !== document.digest) {
      throw new Error(`Protocol document digest does not match release metadata: ${document.path}`);
    }
    addSyntheticSource(sources, seen, {
      scope: "protocol",
      role: "protocol",
      authority: "normative",
      package: null,
      path: `@seedspec/protocol/${document.path}`,
      identifiers: [protocolRelease.release_id, protocolRelease.protocol_family],
      text: bytes.toString("utf8")
    });
  }
}

export async function buildSearchCorpus(record, options = {}) {
  const sources = [];
  const seen = new Set();
  for (const packageRecord of packageRecords(record)) {
    await packageSources(packageRecord, sources, seen);
  }
  await protocolSources(sources, seen);
  if (options.implementingGuide?.text) {
    addSyntheticSource(sources, seen, {
      scope: "implementing",
      role: "implementing-guide",
      authority: "guidance",
      package: null,
      path: options.implementingGuide.path ?? "@seedspec/cli/docs/implementing.md",
      identifiers: [options.implementingGuide.version].filter(Boolean),
      text: options.implementingGuide.text
    });
  }
  const index = createSearchIndex(sources);
  return {
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    protocol: {
      release: protocolRelease.release_id,
      digest: protocolReleaseDigest,
      documents: protocolRelease.documents.map((document) => ({ ...document }))
    },
    source_count: sources.length,
    section_count: index.sections.length,
    sources: sources.map(({ text: _text, ...source }) => ({ ...source })),
    index
  };
}
