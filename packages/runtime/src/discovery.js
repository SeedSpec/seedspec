import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { validatePackage } from "./validate.js";

const ignoredDirectories = new Set([".git", ".seedspec", "node_modules"]);

async function collectManifestPaths(inputPath, manifests) {
  const absolute = path.resolve(inputPath);
  let info;
  try {
    info = await stat(absolute);
  } catch {
    throw new SeedSpecError(`Feature catalog path does not exist: ${inputPath}`, {
      code: "CATALOG_NOT_FOUND"
    });
  }

  if (info.isFile()) {
    if (path.basename(absolute) === "seedspec.yaml") manifests.push(absolute);
    return;
  }
  if (!info.isDirectory()) return;

  const directManifest = path.join(absolute, "seedspec.yaml");
  try {
    if ((await stat(directManifest)).isFile()) manifests.push(directManifest);
  } catch {
    // This directory is a catalog container rather than a package root.
  }

  const entries = await readdir(absolute, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || ignoredDirectories.has(entry.name) || entry.name.startsWith(".")) {
      continue;
    }
    await collectManifestPaths(path.join(absolute, entry.name), manifests);
  }
}

function declaredConcerns(application, feature) {
  const applicationCapabilities = new Set(
    application.manifest.provides.capabilities.map((capability) => capability.id)
  );
  const featureCapabilities = new Set(
    feature.manifest.provides.capabilities.map((capability) => capability.id)
  );

  const concerns = [];
  if ((feature.manifest.conflicts?.packages ?? []).some((item) => item.id === application.manifest.id)) {
    concerns.push(`${feature.manifest.id} declares a package conflict with the application`);
  }
  if ((application.manifest.conflicts?.packages ?? []).some((item) => item.id === feature.manifest.id)) {
    concerns.push(`${application.manifest.id} declares a package conflict with the feature`);
  }
  for (const conflict of feature.manifest.conflicts?.capabilities ?? []) {
    if (applicationCapabilities.has(conflict.id)) {
      concerns.push(`${feature.manifest.id} declares a conflict with capability ${conflict.id}`);
    }
  }
  for (const conflict of application.manifest.conflicts?.capabilities ?? []) {
    if (featureCapabilities.has(conflict.id)) {
      concerns.push(`${application.manifest.id} declares a conflict with capability ${conflict.id}`);
    }
  }
  for (const capability of feature.manifest.provides.capabilities) {
    if (applicationCapabilities.has(capability.id)) {
      concerns.push(`the application and feature both declare provider context for ${capability.id}`);
    }
  }
  return concerns;
}

function scopeAssessment(application, feature) {
  const compatibility = feature.manifest.compatibility;
  if (compatibility.scope === "generic") return null;
  if (compatibility.scope === "application") {
    return compatibility.applications.includes(application.manifest.id)
      ? null
      : "the author's application-scoped compatibility statement does not list this application";
  }
  return `the author's domain scope (${compatibility.domain}) requires mapping to the actual implementation`;
}

function assessFeature(application, feature, providers) {
  const reasons = declaredConcerns(application, feature);
  const scopeReason = scopeAssessment(application, feature);
  if (scopeReason) reasons.push(scopeReason);

  const applicationCapabilities = new Map(
    application.manifest.provides.capabilities.map((capability) => [capability.id, capability])
  );
  const undeclaredCapabilities = (feature.manifest.requires?.capabilities ?? [])
    .map((requirement) => requirement.id)
    .filter((id) => !applicationCapabilities.has(id));
  const dependencyCandidates = Object.fromEntries(
    undeclaredCapabilities.map((id) => [
      id,
      (providers.get(id) ?? []).filter((provider) => provider !== feature.manifest.id)
    ])
  );

  if (undeclaredCapabilities.length > 0) {
    const catalogSuggestions = undeclaredCapabilities.filter(
      (id) => dependencyCandidates[id].length > 0
    );
    const noCatalogDeclaration = undeclaredCapabilities.filter(
      (id) => dependencyCandidates[id].length === 0
    );
    reasons.push(`the application package does not declare: ${undeclaredCapabilities.join(", ")}`);
    if (catalogSuggestions.length > 0) {
      reasons.push(`other catalog packages declare possible context for: ${catalogSuggestions.join(", ")}`);
    }
    if (noCatalogDeclaration.length > 0) {
      reasons.push(`no catalog package declares context for: ${noCatalogDeclaration.join(", ")}`);
    }
  }

  for (const requirement of feature.manifest.requires?.capabilities ?? []) {
    const applicationCapability = applicationCapabilities.get(requirement.id);
    if (applicationCapability && applicationCapability.version !== requirement.tested_against) {
      reasons.push(
        `${requirement.id} was tested at ${requirement.tested_against}; the application package declares ${applicationCapability.version}`
      );
    }
    if (feature.manifest.provides.capabilities.some((capability) => capability.id === requirement.id)) {
      reasons.push(`${feature.manifest.id} both requires and provides ${requirement.id}`);
    }
  }

  return {
    status: reasons.length > 0 ? "review" : "candidate",
    reasons,
    undeclaredCapabilities,
    dependencyCandidates
  };
}

export async function discoverFeatures(applicationPath, catalogPaths) {
  const application = await validatePackage(applicationPath);
  if (application.manifest.kind !== "application") {
    throw new SeedSpecError(`Feature discovery requires an application package: ${application.manifest.id}`, {
      code: "EXPECTED_APPLICATION"
    });
  }
  if (!catalogPaths?.length) {
    throw new SeedSpecError("Feature discovery requires at least one catalog path", {
      code: "CATALOG_REQUIRED"
    });
  }

  const manifestPaths = [];
  for (const catalogPath of catalogPaths) await collectManifestPaths(catalogPath, manifestPaths);

  const uniquePaths = [...new Set(manifestPaths)].sort();
  const features = [];
  const invalid = [];
  for (const manifestPath of uniquePaths) {
    try {
      const record = await validatePackage(manifestPath);
      if (record.manifest.kind === "feature") features.push(record);
    } catch (error) {
      invalid.push({
        path: path.dirname(manifestPath),
        code: error.code ?? "INVALID_PACKAGE",
        message: error.message
      });
    }
  }

  const providers = new Map();
  for (const feature of features) {
    for (const capability of feature.manifest.provides.capabilities) {
      providers.set(capability.id, [
        ...(providers.get(capability.id) ?? []),
        feature.manifest.id
      ]);
    }
  }

  const candidates = features.map((feature) => ({
    id: feature.manifest.id,
    name: feature.manifest.name,
    version: feature.manifest.version,
    description: feature.manifest.description ?? null,
    path: feature.root,
    digest: feature.digest,
    compatibility: feature.manifest.compatibility,
    requires: feature.manifest.requires?.capabilities ?? [],
    provides: feature.manifest.provides.capabilities,
    ...assessFeature(application, feature, providers)
  })).sort((left, right) => (
    left.id.localeCompare(right.id) || left.version.localeCompare(right.version) || left.path.localeCompare(right.path)
  ));

  return {
    application: {
      id: application.manifest.id,
      version: application.manifest.version,
      digest: application.digest
    },
    catalogs: catalogPaths.map((catalogPath) => path.resolve(catalogPath)),
    candidates,
    invalid
  };
}

export function formatFeatureDiscovery(result) {
  const lines = [`Feature candidates for ${result.application.id}@${result.application.version}`];
  if (result.candidates.length === 0) lines.push("- none found");
  for (const candidate of result.candidates) {
    lines.push(
      `- ${candidate.name} (${candidate.id}@${candidate.version}) — ${candidate.status}`,
      `  Path: ${candidate.path}`
    );
    if (candidate.undeclaredCapabilities.length > 0) {
      lines.push(`  Not declared by application package: ${candidate.undeclaredCapabilities.join(", ")}`);
    }
    for (const reason of candidate.reasons) lines.push(`  Note: ${reason}`);
  }
  if (result.invalid.length > 0) {
    lines.push(`Skipped invalid packages: ${result.invalid.length}`);
  }
  return lines.join("\n");
}
