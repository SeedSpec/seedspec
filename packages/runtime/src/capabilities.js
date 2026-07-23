import { SeedSpecError } from "./errors.js";

function compareIdsByUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function capabilityMatches(provision, requirement) {
  return provision.id === requirement.id;
}

function parseCapabilityVersion(version) {
  return version.split(".").map((part) => BigInt(part));
}

function compareCapabilityVersions(left, right) {
  const leftParts = parseCapabilityVersion(left);
  const rightParts = parseCapabilityVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

function revisionDifference(left, right) {
  const leftParts = parseCapabilityVersion(left);
  const rightParts = parseCapabilityVersion(right);
  if (leftParts[0] !== rightParts[0]) return "major";
  if (leftParts[1] !== rightParts[1]) return "minor";
  if (leftParts[2] !== rightParts[2]) return "patch";
  return "none";
}

export function classifyCapabilityRevision(testedAgainst, providedVersion) {
  const comparison = compareCapabilityVersions(providedVersion, testedAgainst);
  if (comparison === 0) {
    return {
      revision_status: "tested-revision",
      revision_direction: "exact",
      revision_difference: "none",
      review_severity: "none"
    };
  }

  const direction = comparison > 0 ? "provider-newer" : "provider-older";
  const difference = revisionDifference(testedAgainst, providedVersion);
  let severity = "high";
  if (direction === "provider-newer" && difference === "patch") severity = "low";
  if (direction === "provider-newer" && difference === "minor") severity = "medium";
  if (direction === "provider-older" && difference === "patch") severity = "medium";

  return {
    revision_status: "different-revision",
    revision_direction: direction,
    revision_difference: difference,
    review_severity: severity
  };
}

function declaredChangesBetween(capability, testedAgainst, revision) {
  if (revision.revision_direction === "exact") {
    return { change_evidence: "not-needed", declared_changes: [] };
  }
  if (revision.revision_direction === "provider-older") {
    return { change_evidence: "unavailable", declared_changes: [] };
  }

  const history = capability.change_history ?? [];
  const declaredChanges = [];
  let cursor = testedAgainst;
  while (cursor !== capability.version) {
    const transition = history.find((item) => item.from === cursor);
    if (!transition || compareCapabilityVersions(transition.to, capability.version) > 0) break;
    declaredChanges.push(transition);
    cursor = transition.to;
  }
  if (cursor === capability.version) {
    return { change_evidence: "complete", declared_changes: declaredChanges };
  }
  return {
    change_evidence: declaredChanges.length > 0 ? "partial" : "unavailable",
    declared_changes: declaredChanges
  };
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
  for (const capability of provided) {
    const history = capability.change_history ?? [];
    for (let index = 0; index < history.length; index += 1) {
      const transition = history[index];
      if (compareCapabilityVersions(transition.from, transition.to) >= 0) {
        details.push(`provides.capabilities.${capability.id}.change_history must move from an older revision to a newer revision`);
      }
      if (index > 0 && history[index - 1].to !== transition.from) {
        details.push(`provides.capabilities.${capability.id}.change_history must form a contiguous revision chain`);
      }
      const changeIds = transition.changes.map((change) => change.id);
      if (new Set(changeIds).size !== changeIds.length) {
        details.push(`provides.capabilities.${capability.id}.change_history repeats a change ID between ${transition.from} and ${transition.to}`);
      }
      const difference = revisionDifference(transition.from, transition.to);
      const types = new Set(transition.changes.map((change) => change.type));
      const validClassification = difference === "major"
        ? types.has("breaking")
        : difference === "minor"
          ? !types.has("breaking") && types.has("additive")
          : !types.has("breaking") && !types.has("additive");
      if (!validClassification) {
        details.push(`provides.capabilities.${capability.id}.change_history ${transition.from} to ${transition.to} does not match its breaking/additive/clarifying declarations`);
      }
    }
    if (history.length > 0 && history.at(-1).to !== capability.version) {
      details.push(`provides.capabilities.${capability.id}.change_history must end at the provided revision ${capability.version}`);
    }
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
  if (manifest.definition.artifact) {
    const primaryArtifact = (manifest.artifacts ?? [])
      .find((artifact) => artifact.id === manifest.definition.artifact);
    if (!primaryArtifact) {
      details.push(`definition.artifact references unknown artifact ${manifest.definition.artifact}`);
    } else {
      if (!primaryArtifact.path || primaryArtifact.path !== manifest.definition.entrypoint) {
        details.push("definition.artifact must reference the same package-local path as definition.entrypoint");
      }
      if (!(primaryArtifact.concerns ?? []).includes("org.seedspec.concern.intent")) {
        details.push("definition.artifact must declare org.seedspec.concern.intent");
      }
    }
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
          severity: "high",
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
          severity: "high",
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
        severity: "medium",
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
      provider: lockedPackage(record),
      ...(capability.change_history ? { change_history: capability.change_history } : {}),
      ...(capability.conformance ? { conformance_suite: capability.conformance.suite } : {})
    })))
    .sort(compareCapabilityDeclarations);

  const requirements = records.flatMap((record) => (
    (record.manifest.requires?.capabilities ?? []).map((requirement) => {
      const candidates = (providers.get(requirement.id) ?? [])
        .map((provider) => {
          const revision = classifyCapabilityRevision(
            requirement.tested_against,
            provider.capability.version
          );
          return {
            provider: lockedPackage(provider.record),
            provided_version: provider.capability.version,
            ...revision,
            ...declaredChangesBetween(provider.capability, requirement.tested_against, revision)
          };
        })
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
    requirement.issues.map((issue) => {
      const revisionCandidate = issue === "revision-difference"
        ? requirement.providers.find((provider) => provider.revision_status === "different-revision")
        : undefined;
      const severity = revisionCandidate?.review_severity
        ?? (issue === "no-declared-provider" ? "high" : "medium");
      return {
        code: issue,
        severity,
        packages: uniqueSorted([
          requirement.consumer,
          ...requirement.providers.map((provider) => provider.provider.id)
        ]),
        capability: requirement.capability,
        ...(revisionCandidate ? {
          revision: {
            tested_against: requirement.tested_against,
            provided_version: revisionCandidate.provided_version,
            direction: revisionCandidate.revision_direction,
            difference: revisionCandidate.revision_difference,
            change_evidence: revisionCandidate.change_evidence,
            declared_changes: revisionCandidate.declared_changes
          }
        } : {})
      };
    })
  ));
  const cycleReviews = requirementCycles(root, orderedAdditions, requirements).map((packages) => ({
    code: "declared-requirement-cycle",
    severity: "medium",
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
