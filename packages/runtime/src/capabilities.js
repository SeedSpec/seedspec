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

  const profileIds = new Set();
  const implementationResourceIds = new Set(
    (manifest.implementation_resources?.resources ?? []).map((resource) => resource.id)
  );
  for (const profile of manifest.implementation_profiles ?? []) {
    if (profileIds.has(profile.id)) details.push(`implementation_profiles repeats ${profile.id}`);
    profileIds.add(profile.id);

    const conditionIds = new Set();
    for (const condition of [
      ...(profile.prerequisites ?? []),
      ...(profile.blockers ?? [])
    ]) {
      if (conditionIds.has(condition.id)) {
        details.push(`implementation_profiles.${profile.id} repeats condition ${condition.id}`);
      }
      conditionIds.add(condition.id);
    }
    for (const resourceId of profile.implementation_resources ?? []) {
      if (!implementationResourceIds.has(resourceId)) {
        details.push(`implementation_profiles.${profile.id} references unknown implementation resource ${resourceId}`);
      }
    }
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

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareIdsByUtf8);
}

function compareCapabilityDeclarations(left, right) {
  return compareIdsByUtf8(left.id, right.id)
    || compareIdsByUtf8(left.provider.id, right.provider.id);
}

function compareReviews(left, right) {
  return compareIdsByUtf8(left.code, right.code)
    || compareIdsByUtf8(left.capability ?? "", right.capability ?? "")
    || compareIdsByUtf8(left.packages.join("/"), right.packages.join("/"));
}

function declaredConflictReviews(records, providers) {
  const packageIds = new Set(records.map((record) => record.manifest.id));
  const reviews = [];

  for (const record of records) {
    for (const conflict of record.manifest.conflicts?.packages ?? []) {
      if (packageIds.has(conflict.id)) {
        reviews.push({
          code: "declared-package-conflict",
          packages: uniqueSorted([record.manifest.id, conflict.id]),
          reason: conflict.reason
        });
      }
    }
    for (const conflict of record.manifest.conflicts?.capabilities ?? []) {
      const matchingProviders = (providers.get(conflict.id) ?? [])
        .filter((provider) => provider.record.manifest.id !== record.manifest.id);
      if (matchingProviders.length > 0) {
        reviews.push({
          code: "declared-capability-conflict",
          packages: uniqueSorted([
            record.manifest.id,
            ...matchingProviders.map((provider) => provider.record.manifest.id)
          ]),
          capability: conflict.id,
          reason: conflict.reason
        });
      }
    }
  }

  return reviews;
}

function duplicateProviderReviews(providers) {
  const reviews = [];
  for (const [capability, declarations] of providers) {
    if (declarations.length > 1) {
      reviews.push({
        code: "multiple-declared-providers",
        packages: uniqueSorted(
          declarations.map((declaration) => declaration.record.manifest.id)
        ),
        capability
      });
    }
  }
  return reviews;
}

function requirementCycles(root, additions, requirements) {
  const additionIds = new Set(additions.map((addition) => addition.manifest.id));
  const edges = new Map([...additionIds].map((id) => [id, new Set()]));

  for (const requirement of requirements) {
    if (!additionIds.has(requirement.consumer)) continue;
    const externalAdditionProviders = requirement.providers
      .map((provider) => provider.provider)
      .filter((provider) => additionIds.has(provider.id) && provider.id !== requirement.consumer);
    const rootProviders = requirement.providers
      .filter((provider) => provider.provider.id === root.manifest.id);
    if (rootProviders.length === 0 && externalAdditionProviders.length === 1) {
      edges.get(requirement.consumer).add(externalAdditionProviders[0].id);
    }
  }

  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(id) {
    indexes.set(id, nextIndex);
    lowLinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);

    for (const target of [...edges.get(id)].sort(compareIdsByUtf8)) {
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(id, Math.min(lowLinks.get(id), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(id, Math.min(lowLinks.get(id), indexes.get(target)));
      }
    }

    if (lowLinks.get(id) === indexes.get(id)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== id);
      if (component.length > 1) components.push(component.sort(compareIdsByUtf8));
    }
  }

  for (const id of [...additionIds].sort(compareIdsByUtf8)) {
    if (!indexes.has(id)) visit(id);
  }
  return components.sort((left, right) => compareIdsByUtf8(left[0], right[0]));
}

export function analyzeCapabilityDeclarations(root, additions) {
  const orderedAdditions = [...additions].sort(
    (left, right) => compareIdsByUtf8(left.manifest.id, right.manifest.id)
  );
  const records = [root, ...orderedAdditions];
  const providers = new Map();

  for (const record of records) {
    for (const capability of record.manifest.provides.capabilities) {
      providers.set(capability.id, [
        ...(providers.get(capability.id) ?? []),
        { record, capability }
      ]);
    }
  }

  const capabilities = [...providers.values()]
    .flatMap((declarations) => declarations.map(({ record, capability }) => ({
      id: capability.id,
      version: capability.version,
      provider: lockedPackage(record)
    })))
    .sort(compareCapabilityDeclarations);

  const requirements = records.flatMap((record) => (
    (record.manifest.requires?.capabilities ?? []).map((requirement) => {
      const candidates = (providers.get(requirement.id) ?? [])
        .map((provider) => ({
          provider: lockedPackage(provider.record),
          provided_version: provider.capability.version,
          revision_status: provider.capability.version === requirement.tested_against
            ? "tested-revision"
            : "different-revision"
        }))
        .sort((left, right) => compareIdsByUtf8(left.provider.id, right.provider.id));
      const issues = [];
      if (candidates.length === 0) issues.push("no-declared-provider");
      if (candidates.length > 1) issues.push("multiple-declared-providers");
      if (candidates.some((candidate) => candidate.provider.id === record.manifest.id)) {
        issues.push("self-declared-provider");
      }
      if (candidates.length === 1 && candidates[0].revision_status === "different-revision") {
        issues.push("revision-difference");
      }
      return {
        consumer: record.manifest.id,
        capability: requirement.id,
        tested_against: requirement.tested_against,
        providers: candidates,
        issues,
        status: issues.length === 0 ? "declared-aligned" : "review"
      };
    })
  ));

  const requirementReviews = requirements.flatMap((requirement) => (
    requirement.issues.map((issue) => ({
      code: issue,
      packages: uniqueSorted([
        requirement.consumer,
        ...requirement.providers.map((provider) => provider.provider.id)
      ]),
      capability: requirement.capability
    }))
  ));
  const cycleReviews = requirementCycles(root, orderedAdditions, requirements).map((packages) => ({
    code: "declared-requirement-cycle",
    packages
  }));
  const reviewCandidates = [
    ...requirementReviews,
    ...duplicateProviderReviews(providers),
    ...declaredConflictReviews(records, providers),
    ...cycleReviews
  ];
  const reviews = [...new Map(
    reviewCandidates.map((review) => [JSON.stringify(review), review])
  ).values()].sort(compareReviews);

  return { orderedAdditions, capabilities, requirements, reviews };
}

// Backward-compatible alpha export. The function performs declaration analysis,
// not provider selection or implementation-state resolution.
export const resolveCapabilityGraph = analyzeCapabilityDeclarations;
