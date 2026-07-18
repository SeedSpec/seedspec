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

function declaredConflict(application, feature) {
  const applicationCapabilities = new Set(
    application.manifest.provides.capabilities.map((capability) => capability.id)
  );
  const featureCapabilities = new Set(
    feature.manifest.provides.capabilities.map((capability) => capability.id)
  );

  if ((feature.manifest.conflicts?.packages ?? []).some((item) => item.id === application.manifest.id)) {
    return `${feature.manifest.id} declares a conflict with the application`;
  }
  if ((application.manifest.conflicts?.packages ?? []).some((item) => item.id === feature.manifest.id)) {
    return `${application.manifest.id} declares a conflict with the feature`;
  }
  const featureCapabilityConflict = (feature.manifest.conflicts?.capabilities ?? [])
    .find((item) => applicationCapabilities.has(item.id));
  if (featureCapabilityConflict) {
    return `${feature.manifest.id} conflicts with ${featureCapabilityConflict.id}`;
  }
  const applicationCapabilityConflict = (application.manifest.conflicts?.capabilities ?? [])
    .find((item) => featureCapabilities.has(item.id));
  if (applicationCapabilityConflict) {
    return `${application.manifest.id} conflicts with ${applicationCapabilityConflict.id}`;
  }
  const duplicateProvider = feature.manifest.provides.capabilities
    .find((capability) => applicationCapabilities.has(capability.id));
  return duplicateProvider
    ? `the application and feature both provide ${duplicateProvider.id}`
    : null;
}

function scopeAssessment(application, feature) {
  const compatibility = feature.manifest.compatibility;
  if (compatibility.scope === "generic") return { compatible: true };
  if (compatibility.scope === "application") {
    return compatibility.applications.includes(application.manifest.id)
      ? { compatible: true }
      : { compatible: false, reason: "the feature does not list this application as compatible" };
  }
  return {
    compatible: null,
    reason: `domain compatibility (${compatibility.domain}) requires implementation review`
  };
}

function assessFeature(application, feature, providers) {
  const conflict = declaredConflict(application, feature);
  if (conflict) return { status: "conflict", reasons: [conflict], missingCapabilities: [] };

  const scope = scopeAssessment(application, feature);
  if (scope.compatible === false) {
    return { status: "incompatible", reasons: [scope.reason], missingCapabilities: [] };
  }

  const applicationCapabilities = new Set(
    application.manifest.provides.capabilities.map((capability) => capability.id)
  );
  const missingCapabilities = (feature.manifest.requires?.capabilities ?? [])
    .map((requirement) => requirement.id)
    .filter((id) => !applicationCapabilities.has(id));
  const dependencyCandidates = Object.fromEntries(
    missingCapabilities.map((id) => [
      id,
      (providers.get(id) ?? []).filter((provider) => provider !== feature.manifest.id)
    ])
  );

  if (missingCapabilities.length > 0) {
    const noProvider = missingCapabilities.filter((id) => dependencyCandidates[id].length === 0);
    return {
      status: noProvider.length ? "missing-capabilities" : "needs-features",
      reasons: [
        scope.compatible === null ? scope.reason : null,
        noProvider.length
          ? `no catalog feature provides: ${noProvider.join(", ")}`
          : "additional catalog features may satisfy the missing capabilities"
      ].filter(Boolean),
      missingCapabilities,
      dependencyCandidates
    };
  }

  return {
    status: scope.compatible === null ? "review" : "compatible",
    reasons: scope.reason ? [scope.reason] : [],
    missingCapabilities: []
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
    if (candidate.missingCapabilities.length > 0) {
      lines.push(`  Missing: ${candidate.missingCapabilities.join(", ")}`);
    }
    for (const reason of candidate.reasons) lines.push(`  Note: ${reason}`);
  }
  if (result.invalid.length > 0) {
    lines.push(`Skipped invalid packages: ${result.invalid.length}`);
  }
  return lines.join("\n");
}
