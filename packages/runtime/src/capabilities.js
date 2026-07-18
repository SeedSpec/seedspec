import { SeedSpecError } from "./errors.js";

function compareIdsByUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function capabilityMatches(provision, requirement) {
  return provision.id === requirement.id;
}

function duplicateIds(items) {
  const seen = new Set();
  return items
    .map((item) => item.id)
    .filter((id) => seen.has(id) || !seen.add(id));
}

export function validateManifestSemantics(manifest) {
  const details = [];
  const required = manifest.requires?.capabilities ?? [];
  const provided = manifest.provides.capabilities;

  for (const id of new Set(duplicateIds(required))) {
    details.push(`requires.capabilities repeats ${id}`);
  }
  for (const id of new Set(duplicateIds(provided))) {
    details.push(`provides.capabilities repeats ${id}`);
  }
  const decisionIds = new Set();
  for (const decision of manifest.decisions ?? []) {
    if (decisionIds.has(decision.id)) details.push(`decisions repeats ${decision.id}`);
    decisionIds.add(decision.id);
  }

  const artifactIds = new Set();
  for (const artifact of manifest.artifacts ?? []) {
    if (artifactIds.has(artifact.id)) details.push(`artifacts repeats ${artifact.id}`);
    artifactIds.add(artifact.id);
  }
  for (const relationship of manifest.relationships ?? []) {
    if (!artifactIds.has(relationship.from)) {
      details.push(`relationships references unknown source artifact ${relationship.from}`);
    }
    if (!artifactIds.has(relationship.to)) {
      details.push(`relationships references unknown target artifact ${relationship.to}`);
    }
  }

  const selectedPackageConflicts = manifest.conflicts?.packages ?? [];
  if (selectedPackageConflicts.some((conflict) => conflict.id === manifest.id)) {
    details.push("a package cannot conflict with itself");
  }
  for (const id of new Set(duplicateIds(selectedPackageConflicts))) {
    details.push(`conflicts.packages repeats ${id}`);
  }
  for (const id of new Set(duplicateIds(manifest.conflicts?.capabilities ?? []))) {
    details.push(`conflicts.capabilities repeats ${id}`);
  }

  if (details.length > 0) {
    throw new SeedSpecError(`SeedSpec manifest has invalid protocol semantics: ${manifest.id}`, {
      code: "INVALID_MANIFEST_SEMANTICS",
      details
    });
  }
}

function lockedPackage(record) {
  return {
    id: record.manifest.id,
    version: record.manifest.version,
    kind: record.manifest.kind,
    digest: record.digest
  };
}

function assertNoDeclaredConflicts(records, providers) {
  const packageIds = new Set(records.map((record) => record.manifest.id));
  const details = [];

  for (const record of records) {
    for (const conflict of record.manifest.conflicts?.packages ?? []) {
      if (packageIds.has(conflict.id)) {
        details.push(`${record.manifest.id} conflicts with package ${conflict.id}: ${conflict.reason}`);
      }
    }
    for (const conflict of record.manifest.conflicts?.capabilities ?? []) {
      const provider = providers.get(conflict.id);
      if (provider && provider.record.manifest.id !== record.manifest.id) {
        details.push(`${record.manifest.id} conflicts with capability ${conflict.id}: ${conflict.reason}`);
      }
    }
  }

  if (details.length > 0) {
    throw new SeedSpecError("Selected SeedSpec packages declare composition conflicts", {
      code: "DECLARED_CONFLICT",
      details
    });
  }
}

export function resolveCapabilityGraph(application, features) {
  const records = [application, ...features];
  const providers = new Map();

  for (const record of records) {
    for (const capability of record.manifest.provides.capabilities) {
      const existing = providers.get(capability.id);
      if (existing) {
        throw new SeedSpecError(`Multiple selected packages provide ${capability.id}`, {
          code: "AMBIGUOUS_CAPABILITY_PROVIDER",
          details: [existing.record.manifest.id, record.manifest.id]
        });
      }
      providers.set(capability.id, { record, capability });
    }
  }

  assertNoDeclaredConflicts(records, providers);

  const applicationRequirements = application.manifest.requires?.capabilities ?? [];
  if (applicationRequirements.length > 0) {
    throw new SeedSpecError("Root application packages cannot require capabilities in capability-graph-v1", {
      code: "APPLICATION_REQUIREMENTS_UNSUPPORTED",
      details: applicationRequirements.map((requirement) => requirement.id)
    });
  }

  const available = new Map(
    application.manifest.provides.capabilities.map((capability) => [capability.id, capability])
  );
  const remaining = new Map(features.map((feature) => [feature.manifest.id, feature]));
  const orderedFeatures = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((feature) => (feature.manifest.requires?.capabilities ?? []).every((requirement) => {
        const provision = available.get(requirement.id);
        return provision && capabilityMatches(provision, requirement);
      }))
      .sort((left, right) => compareIdsByUtf8(left.manifest.id, right.manifest.id));

    if (ready.length === 0) {
      const missing = [];
      const waiting = [];

      for (const feature of remaining.values()) {
        for (const requirement of feature.manifest.requires?.capabilities ?? []) {
          const availableProvision = available.get(requirement.id);
          if (availableProvision && capabilityMatches(availableProvision, requirement)) continue;

          const provider = providers.get(requirement.id);
          if (!provider) {
            missing.push(`${feature.manifest.id} requires ${requirement.id}`);
          } else {
            waiting.push(`${feature.manifest.id} waits for ${provider.record.manifest.id}`);
          }
        }
      }

      if (missing.length > 0) {
        throw new SeedSpecError("Selected features require capabilities with no provider", {
          code: "MISSING_CAPABILITIES",
          details: [...new Set(missing)]
        });
      }
      throw new SeedSpecError("Selected features contain a capability dependency cycle", {
        code: "CAPABILITY_CYCLE",
        details: [...new Set(waiting)]
      });
    }

    for (const feature of ready) {
      remaining.delete(feature.manifest.id);
      orderedFeatures.push(feature);
      for (const capability of feature.manifest.provides.capabilities) {
        available.set(capability.id, capability);
      }
    }
  }

  const capabilities = [...providers.values()]
    .map(({ record, capability }) => ({
      id: capability.id,
      version: capability.version,
      provider: lockedPackage(record)
    }))
    .sort((left, right) => compareIdsByUtf8(left.id, right.id));

  const requirements = orderedFeatures.flatMap((feature) => (
    (feature.manifest.requires?.capabilities ?? []).map((requirement) => {
      const provider = providers.get(requirement.id);
      return {
        consumer: feature.manifest.id,
        capability: requirement.id,
        tested_against: requirement.tested_against,
        provider: lockedPackage(provider.record),
        provided_version: provider.capability.version,
        status: provider.capability.version === requirement.tested_against ? "aligned" : "review"
      };
    })
  ));

  return { orderedFeatures, capabilities, requirements };
}
