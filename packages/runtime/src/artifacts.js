import { readFile } from "node:fs/promises";
import { SeedSpecError } from "./errors.js";
import { pathExists, resolvePackagePath } from "./files.js";
import { validatePackage } from "./validate.js";

export const PRODUCTSPEC_ARTIFACT_TYPE = "org.seedspec.artifact.product-spec";

const productSpecAdapter = Object.freeze({
  id: "org.seedspec.adapter.product-spec",
  artifactType: PRODUCTSPEC_ARTIFACT_TYPE,
  name: "ProductSpec",
  status: "official",
  capabilities: ["inspect", "validate"],
  implementation: "@productspec/parser",
  implementationVersion: "0.26.0",
  supportedFormatVersions: ["0.1"],
  documentation: "https://github.com/gokulrajaram/ProductSpec/blob/97b90b6288bbcd159bbec0f75fac9bf8212d2dc8/SPEC.md"
});

const adapters = Object.freeze([productSpecAdapter]);

function adapterForType(type) {
  return adapters.find((adapter) => adapter.artifactType === type) ?? null;
}

function publicArtifact(artifact, { primary = false } = {}) {
  const adapter = adapterForType(artifact.type);
  return {
    ...artifact,
    ...(primary ? { intent_role: "primary" } : {}),
    location: artifact.path ?? artifact.url,
    adapter: adapter ? {
      id: adapter.id,
      name: adapter.name,
      status: adapter.status,
      capabilities: adapter.capabilities,
      documentation: adapter.documentation
    } : null
  };
}

export function listArtifactAdapters() {
  return adapters.map((adapter) => ({ ...adapter }));
}

export async function listPackageArtifacts(inputPath) {
  const record = await validatePackage(inputPath);
  return {
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    artifacts: (record.manifest.artifacts ?? []).map((artifact) => publicArtifact(artifact, {
      primary: record.manifest.definition.artifact === artifact.id
    })),
    relationships: record.manifest.relationships ?? []
  };
}

async function loadProductSpecParser() {
  try {
    return await import("@productspec/parser");
  } catch (error) {
    throw new SeedSpecError("The ProductSpec adapter is recognized but its parser is unavailable", {
      code: "ADAPTER_UNAVAILABLE",
      details: [
        "Install the optional @productspec/parser dependency to validate ProductSpec artifacts.",
        error.message
      ]
    });
  }
}

function formatProductSpecIssue(issue) {
  return `${issue.code}${issue.path ? ` (${issue.path})` : ""}: ${issue.message}`;
}

async function validateProductSpec(record, artifact, adapter) {
  if (!artifact.path) {
    throw new SeedSpecError("The ProductSpec adapter does not fetch remote artifact URLs", {
      code: "REMOTE_ARTIFACT_NOT_FETCHED",
      details: ["Provide a package-local path or validate the remote source with ProductSpec tooling."]
    });
  }

  const artifactPath = resolvePackagePath(record.root, artifact.path);
  const info = await pathExists(artifactPath);
  if (!info?.isFile()) {
    throw new SeedSpecError(`ProductSpec artifact must reference a file: ${artifact.path}`, {
      code: "INVALID_ARTIFACT_REFERENCE"
    });
  }

  const { validateProductSpecMarkdown } = await loadProductSpecParser();
  const result = validateProductSpecMarkdown(await readFile(artifactPath, "utf8"));
  if (!result.valid) {
    throw new SeedSpecError(`ProductSpec artifact is invalid: ${artifact.id}`, {
      code: "INVALID_ARTIFACT",
      details: result.errors.map(formatProductSpecIssue)
    });
  }

  const frontmatter = result.document.frontmatter;
  if (artifact.format_version && artifact.format_version !== frontmatter.spec_format_version) {
    throw new SeedSpecError(`Artifact metadata disagrees with ProductSpec frontmatter: ${artifact.id}`, {
      code: "ARTIFACT_METADATA_MISMATCH",
      details: [
        `manifest format_version is ${artifact.format_version}`,
        `ProductSpec spec_format_version is ${frontmatter.spec_format_version}`
      ]
    });
  }

  return {
    package: record.manifest.id,
    artifact: publicArtifact(artifact, {
      primary: record.manifest.definition.artifact === artifact.id
    }),
    adapter: { ...adapter },
    valid: true,
    summary: {
      title: frontmatter.title,
      artifactType: frontmatter.artifact_type,
      formatVersion: frontmatter.spec_format_version,
      revision: frontmatter.spec_revision,
      sections: result.document.sections.length
    },
    warnings: result.warnings.map(formatProductSpecIssue)
  };
}

export async function validateArtifact(inputPath, artifactId) {
  const record = await validatePackage(inputPath);
  const artifact = (record.manifest.artifacts ?? []).find((candidate) => candidate.id === artifactId);
  if (!artifact) {
    throw new SeedSpecError(`Artifact is not declared by ${record.manifest.id}: ${artifactId}`, {
      code: "ARTIFACT_NOT_FOUND"
    });
  }

  const adapter = adapterForType(artifact.type);
  if (!adapter) {
    throw new SeedSpecError(`No SeedSpec adapter recognizes artifact type ${artifact.type}`, {
      code: "ADAPTER_NOT_FOUND",
      details: ["The artifact remains valid package input and may be handled by external tooling."]
    });
  }

  if (adapter.id === productSpecAdapter.id) {
    return validateProductSpec(record, artifact, adapter);
  }

  throw new SeedSpecError(`Adapter is recognized but cannot validate artifacts: ${adapter.id}`, {
    code: "ADAPTER_UNAVAILABLE"
  });
}

export function formatArtifactListing(listing) {
  const lines = [`Artifacts in ${listing.package.id}@${listing.package.version}`];
  if (listing.artifacts.length === 0) return `${lines[0]}: none`;

  for (const artifact of listing.artifacts) {
    lines.push(
      `- ${artifact.id}: ${artifact.type}`,
      `  Intent role: ${artifact.intent_role ?? "supporting"}`,
      `  Location: ${artifact.location}`,
      `  Concerns: ${artifact.concerns?.length ? artifact.concerns.join(", ") : "unspecified"}`,
      `  Adapter: ${artifact.adapter ? `${artifact.adapter.name} (${artifact.adapter.id})` : "none registered"}`
    );
  }
  if (listing.relationships.length > 0) {
    lines.push("Relationships:");
    for (const relationship of listing.relationships) {
      lines.push(`- ${relationship.from} --${relationship.type}--> ${relationship.to}`);
    }
  }
  return lines.join("\n");
}

export function formatAdapterListing(adapterList) {
  if (adapterList.length === 0) return "Registered artifact adapters: none";
  return [
    "Registered artifact adapters",
    ...adapterList.map((adapter) => (
      `- ${adapter.name} (${adapter.id})\n`
      + `  Artifact type: ${adapter.artifactType}\n`
      + `  Capabilities: ${adapter.capabilities.join(", ")}\n`
      + `  Documentation: ${adapter.documentation}`
    ))
  ].join("\n");
}

export function formatArtifactValidation(result) {
  const summary = result.summary;
  return [
    `Valid ${result.adapter.name} artifact: ${result.artifact.id}`,
    `Title: ${summary.title}`,
    `Format: ${summary.formatVersion}`,
    `Revision: ${summary.revision}`,
    `Sections: ${summary.sections}`,
    `Warnings: ${result.warnings.length ? result.warnings.join("; ") : "none"}`
  ].join("\n");
}
