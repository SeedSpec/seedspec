import { validatePackage } from "./validate.js";

function publicArtifact(artifact) {
  return {
    ...artifact,
    location: artifact.path ?? artifact.url
  };
}

export async function listPackageArtifacts(inputPath) {
  const record = await validatePackage(inputPath);
  return {
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    artifacts: (record.manifest.artifacts ?? []).map(publicArtifact),
    relationships: record.manifest.relationships ?? []
  };
}

export function formatArtifactListing(listing) {
  const lines = [`Artifacts in ${listing.package.id}@${listing.package.version}`];
  if (listing.artifacts.length === 0) return `${lines[0]}: none`;

  for (const artifact of listing.artifacts) {
    lines.push(
      `- ${artifact.id}: ${artifact.type}`,
      `  Location: ${artifact.location}`,
      `  Concerns: ${artifact.concerns?.length ? artifact.concerns.join(", ") : "unspecified"}`
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
