import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import {
  buildAgentGuide,
  conditionVerificationSummary,
  hostConceptExpectations,
  intentContributionLines,
  requirementKey,
  requirementSummary,
  reviewKey,
  reviewRevisionSummary
} from "./agent-guide.js";
import { analyzeCapabilityDeclarations } from "./capabilities.js";
import { createInitialVerificationState, resolveCompletionScope } from "./completion.js";
import { protocolVersion } from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { lexicalCompare } from "./integrity.js";
import { pathExists, portablePath, readMarkdownComponent, readYamlFile, resolvePackagePath } from "./files.js";
import { compileConfigurationSchema, compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { artifactReview, componentReview } from "./guidance.js";
import { resolveAppliedIntent } from "./intent.js";
import { createResolutionReceipt } from "./receipts.js";
import {
  formatContextInventory,
  materializeContextIndex
} from "./context.js";
import {
  materializeImplementationResources,
  reconcileImplementationResourceState
} from "./resources.js";
import { materializeTasks } from "./tasks.js";
import { validatePackage } from "./validate.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSelectedConfiguration(packageRecord, configuration) {
  if (!isPlainObject(configuration)) {
    throw new SeedSpecError(`Selected configuration must be an object for ${packageRecord.manifest.id}`, {
      code: "INVALID_CONFIGURATION"
    });
  }
  const validate = compileConfigurationSchema(packageRecord.configurationSchema);
  if (!validate(configuration)) {
    throw new SeedSpecError(`Selected configuration is invalid for ${packageRecord.manifest.id}`, {
      code: "INVALID_CONFIGURATION",
      details: formatSchemaErrors(validate.errors)
    });
  }
}

async function readConfigurationSelections(selectionsPath, records) {
  if (!selectionsPath) {
    return {
      status: "review",
      selections: new Map(records.map((record) => [record.manifest.id, {
        selection: "example-unreviewed",
        values: record.exampleConfiguration
      }]))
    };
  }

  const input = await readYamlFile(
    path.resolve(selectionsPath),
    "Configuration selections"
  );
  const validate = await compileProtocolSchema("configuration-selections.schema.json");
  if (!validate(input)) {
    throw new SeedSpecError("Configuration selections are invalid", {
      code: "INVALID_CONFIGURATION_SELECTIONS",
      details: formatSchemaErrors(validate.errors)
    });
  }

  const packages = new Map(records.map((record) => [record.manifest.id, record]));
  const selections = new Map();
  for (const selection of input.packages) {
    const record = packages.get(selection.package);
    if (!record) {
      throw new SeedSpecError(
        `Configuration selection references an unselected package: ${selection.package}`,
        { code: "INVALID_CONFIGURATION_SELECTIONS" }
      );
    }
    if (selections.has(selection.package)) {
      throw new SeedSpecError(
        `Configuration selection appears more than once: ${selection.package}`,
        { code: "INVALID_CONFIGURATION_SELECTIONS" }
      );
    }

    const values = selection.selection === "example"
      ? record.exampleConfiguration
      : selection.values;
    validateSelectedConfiguration(record, values);
    selections.set(selection.package, {
      selection: selection.selection,
      values
    });
  }

  const missing = records
    .map((record) => record.manifest.id)
    .filter((id) => !selections.has(id));
  if (missing.length > 0) {
    throw new SeedSpecError("Configuration selections do not cover every selected package", {
      code: "MISSING_CONFIGURATION_SELECTION",
      details: missing
    });
  }

  return { status: "selected", selections };
}

function packageReference(record) {
  return {
    id: record.manifest.id,
    version: record.manifest.version,
    digest: record.digest
  };
}

function lockedPackage(record) {
  return {
    id: record.manifest.id,
    version: record.manifest.version,
    kind: record.manifest.kind,
    digest: record.digest
  };
}

function assertSamePackageIdentity(existing, candidate) {
  if (
    existing.manifest.version !== candidate.manifest.version
    || existing.digest !== candidate.digest
  ) {
    throw new SeedSpecError(
      `Selected composition contains conflicting identities for ${candidate.manifest.id}`,
      {
        code: "COMPOSITION_IDENTITY_COLLISION",
        details: [
          `${existing.manifest.version} ${existing.digest} at ${existing.root}`,
          `${candidate.manifest.version} ${candidate.digest} at ${candidate.root}`
        ]
      }
    );
  }
}

function collectSelectedComposition(application, explicitAdditions) {
  const recordsById = new Map([[application.manifest.id, application]]);
  for (const addition of explicitAdditions) {
    if (recordsById.has(addition.manifest.id)) {
      throw new SeedSpecError(`Package selected more than once: ${addition.manifest.id}`, {
        code: "DUPLICATE_ADDITION"
      });
    }
    recordsById.set(addition.manifest.id, addition);
  }

  const edges = [];
  const visited = new Set();
  const visit = (record) => {
    const recordKey = `${record.manifest.id}\0${record.digest}`;
    if (visited.has(recordKey)) return;
    visited.add(recordKey);

    for (const declaration of record.composition.includes) {
      const child = declaration.record;
      const existing = recordsById.get(child.manifest.id);
      if (existing) {
        assertSamePackageIdentity(existing, child);
      } else {
        recordsById.set(child.manifest.id, child);
      }
      edges.push({
        id: declaration.id,
        parent: record,
        child,
        integration: declaration.integration
      });
      visit(child);
    }
  };

  visit(application);
  for (const addition of [...explicitAdditions].sort((left, right) => (
    lexicalCompare(left.manifest.id, right.manifest.id)
  ))) {
    visit(addition);
  }

  edges.sort((left, right) => (
    lexicalCompare(left.parent.manifest.id, right.parent.manifest.id)
    || lexicalCompare(left.id, right.id)
    || lexicalCompare(left.child.manifest.id, right.child.manifest.id)
  ));

  return {
    additions: [...recordsById.values()].filter(
      (record) => record.manifest.id !== application.manifest.id
    ),
    edges
  };
}

function featureDirectoryName(id) {
  return id.replace(/[^a-zA-Z0-9.-]/g, "-");
}

function artifactKey(packageId, artifactId) {
  return `${packageId}/${artifactId}`;
}

async function readArtifactSelections(selectionsPath, records) {
  if (!selectionsPath) return new Map();

  const input = await readYamlFile(path.resolve(selectionsPath), "Artifact selections");
  const validate = await compileProtocolSchema("artifact-selections.schema.json");
  if (!validate(input)) {
    throw new SeedSpecError("Artifact selections are invalid", {
      code: "INVALID_ARTIFACT_SELECTIONS",
      details: formatSchemaErrors(validate.errors)
    });
  }

  const packages = new Map(records.map((record) => [record.manifest.id, record]));
  const selections = new Map();
  for (const selection of input.artifacts) {
    const key = artifactKey(selection.package, selection.id);
    if (selections.has(key)) {
      throw new SeedSpecError(`Artifact selection appears more than once: ${key}`, {
        code: "INVALID_ARTIFACT_SELECTIONS"
      });
    }

    const record = packages.get(selection.package);
    if (!record) {
      throw new SeedSpecError(`Artifact selection references an unselected package: ${selection.package}`, {
        code: "INVALID_ARTIFACT_SELECTIONS"
      });
    }
    if (!(record.manifest.artifacts ?? []).some((artifact) => artifact.id === selection.id)) {
      throw new SeedSpecError(`Artifact selection references an unknown artifact: ${key}`, {
        code: "INVALID_ARTIFACT_SELECTIONS"
      });
    }
    selections.set(key, selection);
  }
  return selections;
}

async function validateTechnicalPreferences(technicalPreferences, records, artifactSelections) {
  const validate = await compileProtocolSchema("technical-preferences.schema.json");
  if (!validate(technicalPreferences)) {
    throw new SeedSpecError("Technical preferences are invalid", {
      code: "INVALID_TECHNICAL_PREFERENCES",
      details: formatSchemaErrors(validate.errors)
    });
  }

  const packages = new Map(records.map((record) => [record.manifest.id, record]));
  const targetIds = new Set();
  for (const target of technicalPreferences.implementation_targets ?? []) {
    if (targetIds.has(target.id)) {
      throw new SeedSpecError(`Implementation target appears more than once: ${target.id}`, {
        code: "INVALID_IMPLEMENTATION_TARGET"
      });
    }
    targetIds.add(target.id);

    for (const reference of target.guidance) {
      const record = packages.get(reference.package);
      if (!record) {
        throw new SeedSpecError(`Implementation target ${target.id} references an unselected package: ${reference.package}`, {
          code: "INVALID_IMPLEMENTATION_TARGET"
        });
      }

      if (reference.artifact) {
        const key = artifactKey(reference.package, reference.artifact);
        if (!(record.manifest.artifacts ?? []).some((artifact) => artifact.id === reference.artifact)) {
          throw new SeedSpecError(`Implementation target ${target.id} references an unknown artifact: ${key}`, {
            code: "INVALID_IMPLEMENTATION_TARGET"
          });
        }
        if (artifactSelections.get(key)?.disposition !== "selected") {
          throw new SeedSpecError(`Implementation target ${target.id} requires selected artifact guidance: ${key}`, {
            code: "INVALID_IMPLEMENTATION_TARGET",
            details: ["Record the artifact with disposition selected in --artifact-selections."]
          });
        }
      } else if (reference.resource) {
        if (!(record.manifest.implementation_resources?.resources ?? []).some(
          (resource) => resource.id === reference.resource
        )) {
          throw new SeedSpecError(
            `Implementation target ${target.id} references an unknown implementation resource: ${reference.package}/${reference.resource}`,
            { code: "INVALID_IMPLEMENTATION_TARGET" }
          );
        }
      } else if (!(reference.component in (record.manifest.components ?? {}))) {
        throw new SeedSpecError(
          `Implementation target ${target.id} references an unknown component: ${reference.package}/${reference.component}`,
          { code: "INVALID_IMPLEMENTATION_TARGET" }
        );
      }
    }
  }
}

async function materializeArtifacts(records, workspace, selections) {
  const artifactDirectory = path.join(workspace, "artifacts");
  await rm(artifactDirectory, { recursive: true, force: true });
  await mkdir(artifactDirectory, { recursive: true });

  const artifactIndex = {
    protocol_version: protocolVersion,
    artifacts: [],
    relationships: []
  };

  for (const record of records) {
    const packageDirectory = featureDirectoryName(record.manifest.id);
    for (const artifact of record.manifest.artifacts ?? []) {
      const selection = selections.get(artifactKey(record.manifest.id, artifact.id));
      const review = artifactReview(artifact);
      const resolved = {
        package: record.manifest.id,
        id: artifact.id,
        type: artifact.type,
        review,
        disposition: selection?.disposition ?? "unreviewed",
        ...(selection?.note ? { selection_note: selection.note } : {}),
        ...(review === "before-activation"
          ? { activation: "requires-specific-user-direction" }
          : {}),
        ...(artifact.label ? { label: artifact.label } : {}),
        ...(artifact.description ? { description: artifact.description } : {}),
        ...(artifact.media_type ? { media_type: artifact.media_type } : {}),
        ...(artifact.format_version ? { format_version: artifact.format_version } : {}),
        ...(artifact.conforms_to ? { conforms_to: artifact.conforms_to } : {}),
        ...(artifact.concerns ? { concerns: artifact.concerns } : {}),
        ...(artifact.evidence_for ? { evidence_for: artifact.evidence_for } : {})
      };

      if (artifact.url) {
        resolved.url = artifact.url;
      } else {
        const source = resolvePackagePath(record.root, artifact.path);
        const destinationName = path.basename(artifact.path.replace(/\/$/u, ""));
        const relativeDestination = portablePath(
          "artifacts",
          packageDirectory,
          artifact.id,
          destinationName
        );
        const destination = path.join(workspace, ...relativeDestination.split("/"));
        await mkdir(path.dirname(destination), { recursive: true });
        await cp(source, destination, { recursive: true });
        resolved.path = relativeDestination;
        resolved.source_path = artifact.path;
      }
      artifactIndex.artifacts.push(resolved);
    }

    for (const relationship of record.manifest.relationships ?? []) {
      artifactIndex.relationships.push({
        package: record.manifest.id,
        ...relationship
      });
    }
  }

  return artifactIndex;
}

async function materializeComponents(records, workspace) {
  const componentDirectory = path.join(workspace, "components");
  await rm(componentDirectory, { recursive: true, force: true });
  await mkdir(componentDirectory, { recursive: true });

  const componentIndex = {
    protocol_version: protocolVersion,
    components: []
  };

  for (const record of records) {
    const packageDirectory = featureDirectoryName(record.manifest.id);
    const declaredComponents = Object.entries(record.manifest.components ?? {})
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    for (const [name, sourcePath] of declaredComponents) {
      const source = resolvePackagePath(record.root, sourcePath);
      const info = await pathExists(source);
      const relativeBase = portablePath("components", packageDirectory, name);
      const destinationBase = path.join(workspace, ...relativeBase.split("/"));
      let relativeDestination;

      if (info?.isDirectory()) {
        await cp(source, destinationBase, { recursive: true });
        relativeDestination = `${relativeBase}/`;
      } else {
        await mkdir(destinationBase, { recursive: true });
        const filename = path.basename(sourcePath);
        await cp(source, path.join(destinationBase, filename));
        relativeDestination = portablePath(relativeBase, filename);
      }

      componentIndex.components.push({
        package: record.manifest.id,
        name,
        source_path: sourcePath,
        path: relativeDestination,
        review: componentReview(name)
      });
    }
  }

  return componentIndex;
}

function resolveCompositionEdges(edges, componentIndex) {
  return edges.map((edge) => {
    const integrationComponent = componentIndex.components.find((component) => (
      component.package === edge.parent.manifest.id
      && component.name === "integration"
    ));
    if (!integrationComponent) {
      throw new SeedSpecError(
        `Resolved composition is missing integration material for ${edge.parent.manifest.id}/${edge.id}`,
        { code: "INVALID_COMPOSITION" }
      );
    }

    const sourceBase = integrationComponent.source_path.replace(/\/$/u, "");
    const relativeWithinComponent = path.posix.relative(
      sourceBase,
      edge.integration
    );
    const resolvedPath = integrationComponent.path.endsWith("/")
      ? portablePath(
        integrationComponent.path.replace(/\/$/u, ""),
        relativeWithinComponent
      )
      : integrationComponent.path;

    return {
      id: edge.id,
      parent: packageReference(edge.parent),
      child: packageReference(edge.child),
      integration: {
        source_path: edge.integration,
        resolved_path: resolvedPath
      }
    };
  });
}

function yamlBlock(value) {
  return `\`\`\`yaml\n${stringifyYaml(value).trimEnd()}\n\`\`\``;
}

function implementationSelectionTarget(selection, rootRecord) {
  const separator = selection.lastIndexOf("/");
  if (separator === -1) {
    return { packageId: rootRecord.manifest.id, profileId: selection };
  }
  return {
    packageId: selection.slice(0, separator),
    profileId: selection.slice(separator + 1)
  };
}

async function materializeImplementationProfileState(records, selections, workspace) {
  const rootRecord = records[0];
  const recordsById = new Map(records.map((record) => [record.manifest.id, record]));
  const preferredByPackage = new Map();

  for (const rawSelection of selections) {
    const { packageId, profileId } = implementationSelectionTarget(rawSelection, rootRecord);
    const record = recordsById.get(packageId);
    if (!record) {
      throw new SeedSpecError(`Implementation preference references an unselected package: ${packageId}`, {
        code: "INVALID_IMPLEMENTATION_PROFILE"
      });
    }
    if (preferredByPackage.has(packageId)) {
      throw new SeedSpecError(`Implementation preference appears more than once for ${packageId}`, {
        code: "INVALID_IMPLEMENTATION_PROFILE"
      });
    }
    const profile = (record.manifest.implementation_profiles ?? [])
      .find((candidate) => candidate.id === profileId);
    if (!profile) {
      throw new SeedSpecError(`Unknown implementation profile: ${packageId}/${profileId}`, {
        code: "INVALID_IMPLEMENTATION_PROFILE"
      });
    }
    preferredByPackage.set(packageId, profileId);
  }

  const profilesDirectory = path.join(workspace, "implementation-profiles");
  await rm(profilesDirectory, { recursive: true, force: true });
  const packages = [];

  for (const record of records) {
    const declared = record.manifest.implementation_profiles ?? [];
    const preferredProfile = preferredByPackage.get(record.manifest.id);
    const selection = declared.length === 0
      ? "none"
      : preferredProfile
        ? "preferred"
        : declared.length > 1
          ? "review"
          : "available";
    const profiles = [];

    for (const profile of declared) {
      const resolved = {
        id: profile.id,
        name: profile.name,
        description: profile.description,
        prerequisites: profile.prerequisites ?? [],
        blockers: profile.blockers ?? [],
        tradeoffs: profile.tradeoffs ?? [],
        implementation_resources: profile.implementation_resources ?? []
      };
      if (profile.guidance) {
        const relativeGuidance = portablePath(
          "implementation-profiles",
          featureDirectoryName(record.manifest.id),
          profile.id,
          path.basename(profile.guidance)
        );
        const destination = path.join(workspace, ...relativeGuidance.split("/"));
        await mkdir(path.dirname(destination), { recursive: true });
        await cp(resolvePackagePath(record.root, profile.guidance), destination);
        resolved.guidance = relativeGuidance;
      }
      profiles.push(resolved);
    }

    packages.push({
      package: record.manifest.id,
      kind: record.manifest.kind,
      selection,
      ...(preferredProfile ? { preferred_profile: preferredProfile } : {}),
      profiles
    });
  }

  const state = {
    protocol_version: protocolVersion,
    scope: "project",
    status: packages.some((item) => item.selection === "review")
      ? "review"
      : packages.some((item) => item.selection !== "none")
        ? "recorded"
        : "not-declared",
    packages
  };
  const validate = await compileProtocolSchema("implementation-profile-state.schema.json");
  if (!validate(state)) {
    throw new SeedSpecError("Resolved implementation profile state is invalid", {
      code: "INVALID_IMPLEMENTATION_PROFILE_STATE",
      details: formatSchemaErrors(validate.errors)
    });
  }
  return state;
}

async function writeFileIfMissing(filePath, contents) {
  if (!await pathExists(filePath)) {
    await writeFile(filePath, contents, "utf8");
  }
}


const initialImplementationNotes = `# SeedSpec implementation notes

Keep this as a concise current-state record for future implementing agents. It is not required to be an exhaustive changelog.

## Local terminology and concept mappings

- None recorded yet.

## Material behavioral deviations

- None recorded yet.

## Architecture and integration choices

- None recorded yet.

## External resources and configured state

- None recorded yet. Record stable identifiers, target accounts or workspaces,
  and whether each resource was created, updated, reused, skipped, or partially
  realized. Never record credentials or sensitive customer data here.

## Known limitations and follow-up

- None recorded yet.
`;

const initialVerificationReport = `# SeedSpec verification report

Status: not started

## Realized use cases

- None recorded yet.

## Realization and outcome evidence

| SeedSpec criterion | Subject | Result | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Add criteria as they are implemented | realization or outcome | not run | — | — |

## Manual checks

- None recorded yet.

Evidence may include tests, known-data queries, external resource identifiers,
permission checks, delivered messages, screenshots, or platform audit records.
Label each item by the realization or outcome claim it supports. Package and
baseline evidence belong to their own protocol locations and do not prove
completion.

## Remaining gaps

- Implementation has not yet been verified.
`;

const rootAgentInstructions = `# SeedSpec project guidance

Read \`.seedspec/agent-guide.md\` before planning or realizing SeedSpec work. Start from the context-module inventory when present, and prepare only modules relevant to the current purpose, audience, and scope. Prefer a supported native adapter; otherwise consult the linked bridge Skill. Discovery does not activate a module, and preparation does not authorize scripts, remote access, tools, or external changes. A bridge explains how to use a format but cannot redefine its module. Resolve declared implementation resources through the SeedSpec CLI and report every bundled fallback. Preserve local behavior and terminology, record material deviations and external resource identifiers in \`.seedspec/implementation-notes.md\`, record detailed realization and outcome evidence in \`.seedspec/verification-report.md\`, and keep \`.seedspec/verification-state.yaml\` aligned with the exact completion scope and evidence subjects.
`;

function normalizeDecisionAnswers(records, suppliedAnswers) {
  if (!isPlainObject(suppliedAnswers)) {
    throw new SeedSpecError("Decision answers must be a YAML object keyed by package ID", {
      code: "INVALID_DECISIONS"
    });
  }

  const packages = new Map(records.map((record) => [record.manifest.id, record]));
  const resolved = [];
  const unresolved = [];

  for (const packageId of Object.keys(suppliedAnswers)) {
    if (!packages.has(packageId)) {
      throw new SeedSpecError(`Decision answers supplied for an unselected package: ${packageId}`, {
        code: "UNKNOWN_DECISION"
      });
    }
    if (!isPlainObject(suppliedAnswers[packageId])) {
      throw new SeedSpecError(`Decision answers for ${packageId} must be an object`, {
        code: "INVALID_DECISIONS"
      });
    }
  }

  for (const record of records) {
    const declarations = new Map(
      (record.manifest.decisions ?? []).map((decision) => [decision.id, decision])
    );
    const packageAnswers = suppliedAnswers[record.manifest.id] ?? {};

    for (const decisionId of Object.keys(packageAnswers)) {
      if (!declarations.has(decisionId)) {
        throw new SeedSpecError(`Unknown decision ${record.manifest.id}/${decisionId}`, {
          code: "UNKNOWN_DECISION"
        });
      }
    }

    for (const decision of declarations.values()) {
      if (Object.hasOwn(packageAnswers, decision.id)) {
        const answer = packageAnswers[decision.id];
        if (typeof answer !== "string" || answer.length === 0) {
          throw new SeedSpecError(`Decision ${record.manifest.id}/${decision.id} requires a non-empty string answer`, {
            code: "INVALID_DECISIONS"
          });
        }
        if (decision.options && !decision.options.includes(answer)) {
          throw new SeedSpecError(`Decision ${record.manifest.id}/${decision.id} has an unsupported answer`, {
            code: "INVALID_DECISIONS",
            details: [`Expected one of: ${decision.options.join(", ")}`]
          });
        }
        resolved.push({ package: record.manifest.id, id: decision.id, answer });
      } else {
        unresolved.push({
          package: record.manifest.id,
          id: decision.id,
          question: decision.question,
          required: decision.required,
          ...(decision.options ? { options: decision.options } : {})
        });
      }
    }
  }

  return { resolved, unresolved };
}

async function buildResolvedSpecification({
  application,
  applicationConfiguration,
  applicationConfigurationSelection,
  resolvedIntent,
  completionScope,
  features,
  composition,
  implementationProfileState,
  technicalPreferences,
  capabilities,
  requirements,
  reviews,
  resolvedDecisions,
  unresolvedDecisions,
  components,
  artifacts,
  taskIndex,
  implementationResources,
  contextModules
}) {
  const specAbsent = [];
  const lines = [
    `# Resolved SeedSpec: ${application.manifest.name}`,
    "",
    "> This file records resolved solution intent. It is an input to planning and implementation, not executable instructions or a generated realization.",
    "",
    "## Project summary",
    "",
    `- Root package: ${application.manifest.id}@${application.manifest.version}`,
    `- Root package digest: ${application.digest}`,
    `- Root kind hint: ${application.manifest.kind}`,
    `- Additions: ${features.length ? features.map(({ record }) => `${record.manifest.id}@${record.manifest.version}`).join(", ") : "none"}`,
    `- Bundled composition edges: ${composition.length}`,
    `- Protocol: ${application.manifest.protocol_version}`,
    `- Applied intent: ${resolvedIntent.status}`,
    `- Context modules: ${contextModules.modules.length}`,
    "",
    "## Applied intent and provenance",
    "",
    "Package definitions below are package-author intent. Project-local contributions are end-user intent or explicitly labeled agent proposals; format alone does not determine authority.",
    "",
    ...resolvedIntent.packages.map((source) => (
      `- ${source.package}: ${source.use}; module \`${source.module}\` in format \`${source.format.id}\` at \`${source.entrypoint}\`${source.note ? ` — ${source.note}` : ""}`
    )),
    ...(resolvedIntent.contributions.length ? [
      "",
      ...resolvedIntent.contributions.flatMap(intentContributionLines)
    ] : []),
    ...(resolvedIntent.unresolved.length ? [
      "",
      "Unresolved applied intent:",
      "",
      ...resolvedIntent.unresolved.map((item) => `- ${item}`)
    ] : []),
    "",
    "## Solution configuration",
    "",
    `### ${application.manifest.name} (${applicationConfigurationSelection})`,
    "",
    yamlBlock(applicationConfiguration),
    "",
    "## Root definition",
    "",
    application.definition.trim()
  ];

  if (contextModules.modules.length > 0) {
    lines.push(
      "",
      "## Context modules",
      "",
      "Context modules remain separate semantic inputs. Their discovery does not activate native workflows, bridge Skills, scripts, tools, or remote sources.",
      "",
      formatContextInventory(contextModules)
    );
  } else {
    specAbsent.push("context modules");
  }

  if (composition.length > 0) {
    lines.push(
      "",
      "## Bundled composition seams",
      "",
      "These Markdown files describe the author-intended relationship at each parent-to-child edge. They are semantic guidance, not structured compatibility claims.",
      "",
      ...composition.map((edge) => (
        `- \`${edge.parent.id}/${edge.id}\` → ${edge.child.id}: \`${edge.integration.resolved_path}\``
      ))
    );
  }

  const applicationAcceptance = await readMarkdownComponent(application, "acceptance");
  if (applicationAcceptance) {
    lines.push("", "## Root acceptance", "", applicationAcceptance.trim());
  }

  for (const { record, configuration, configurationSelection } of features) {
    lines.push(
      "",
      `## Addition: ${record.manifest.name}`,
      "",
      `Package: ${record.manifest.id}@${record.manifest.version}`,
      "",
      `Digest: ${record.digest}`,
      "",
      `### Addition configuration (${configurationSelection})`,
      "",
      yamlBlock(configuration),
      "",
      "### Addition definition",
      "",
      record.definition.trim()
    );

    const integration = await readMarkdownComponent(record, "integration");
    if (integration) lines.push("", "### Integration requirements", "", integration.trim());

    const acceptance = await readMarkdownComponent(record, "acceptance");
    if (acceptance) lines.push("", "### Feature acceptance", "", acceptance.trim());
  }

  if (implementationProfileState.status === "not-declared") {
    specAbsent.push("implementation profiles");
  } else {
    lines.push("", "## Implementation profile state", "");
    lines.push(`Selection status: ${implementationProfileState.status}.`, "");
    for (const packageState of implementationProfileState.packages.filter((item) => item.profiles.length > 0)) {
      lines.push(`### ${packageState.package}`, "");
      for (const profile of packageState.profiles) {
        const preferred = packageState.preferred_profile === profile.id ? " — preferred" : "";
        lines.push(`- **${profile.name}** (\`${profile.id}\`)${preferred}: ${profile.description}`);
        if (profile.guidance) lines.push(`  - Preserved guidance: \`${profile.guidance}\``);
        for (const condition of profile.prerequisites) {
          lines.push(`  - Prerequisite [${conditionVerificationSummary(condition)}]: ${condition.statement}`);
          if (condition.verification.guidance) lines.push(`    - ${condition.verification.guidance}`);
        }
        for (const condition of profile.blockers) {
          lines.push(`  - Blocker check [${conditionVerificationSummary(condition)}]: ${condition.statement}`);
          if (condition.verification.guidance) lines.push(`    - ${condition.verification.guidance}`);
        }
      }
      lines.push("");
    }
  }

  lines.push("", "## Completion scope", "");
  if (completionScope.status === "review") {
    lines.push(
      `Review required. No completion scope covers: ${completionScope.uncovered_packages.join(", ")}.`
    );
  } else {
    lines.push(...completionScope.items.map((item) => {
      const verification = item.verification
        ? `; prove ${item.verification.subject} by ${item.verification.method} at ${item.verification.timing}`
        : "";
      if (item.kind === "criterion") return `- ${item.id} (${item.disposition}): ${item.statement}${verification}`;
      if (item.selection === "all") return `- ${item.id}: all of ${item.package}/${item.component}${verification}`;
      return `- ${item.id}: ${item.package}/${item.component} references ${(item.included_references ?? []).join(", ")}${verification}`;
    }));
  }

  if (Object.keys(technicalPreferences).length === 0) {
    specAbsent.push("technical preferences");
  } else {
    lines.push("", "## Technical preferences", "");
    lines.push(yamlBlock(technicalPreferences));
  }

  if (taskIndex.packages.length === 0) {
    specAbsent.push("package-authored task sequences");
  } else {
    lines.push("", "## Package-authored task sequences", "");
    lines.push(
      "These are ordered implementation reminders, not product requirements or conformance evidence. Resolved reference paths point to copied package context.",
      ""
    );
    for (const packageTasks of taskIndex.packages) {
      lines.push(`### ${packageTasks.package}`, "");
      for (const task of packageTasks.tasks) {
        lines.push(`- \`${task.id}\`: ${task.instruction}`);
        if (task.references.length > 0) {
          lines.push(`  - References: ${task.references.map((reference) => `\`${reference.path}\``).join(", ")}`);
        }
      }
      lines.push("");
    }
  }

  if (components.length === 0) {
    specAbsent.push("optional components");
  } else {
    lines.push("", "## Preserved components", "");
    lines.push(...components.map((component) => (
      `- ${component.package}/${component.name}: ${component.path} — review ${component.review}`
    )));
  }

  if (artifacts.length === 0) {
    specAbsent.push("optional artifacts");
  } else {
    lines.push("", "## Discovered artifacts", "");
    lines.push(
      "These artifacts are preserved inputs, not automatically activated workflows:",
      "",
      ...artifacts.map((artifact) => (
        `- ${artifact.package}/${artifact.id}: ${artifact.type} — ${artifact.path ?? artifact.url} — disposition ${artifact.disposition}; review ${artifact.review}`
      ))
    );
  }

  if (implementationResources.resources.length === 0) {
    specAbsent.push("implementation resources");
  } else {
    lines.push("", "## Author-declared implementation resources", "");
    lines.push(
      "These resources express author guidance and discovery policy. They do not prove implementation capability or authorize tool execution:",
      "",
      ...implementationResources.resources.map((resource) => (
        `- ${resource.package}/${resource.id}@${resource.version}: ${resource.kind}; ${resource.usage}; ${resource.update_policy}`
      ))
    );
  }

  if (resolvedDecisions.length === 0) {
    specAbsent.push("answered decisions");
  } else {
    lines.push("", "## Resolved decisions", "");
    lines.push(...resolvedDecisions.map((decision) => (
      `- ${decision.package}/${decision.id}: ${decision.answer}`
    )));
  }

  const specHostExpectations = hostConceptExpectations(reviews, requirements);
  const specConcerns = reviews.filter(
    (review) => !specHostExpectations.codes.has(reviewKey(review))
  );
  const specRequirements = requirements.filter(
    (requirement) => !specHostExpectations.requirements.has(requirementKey(requirement))
  );

  if (capabilities.length > 0) {
    lines.push(
      "",
      "## Declared capabilities",
      "",
      ...capabilities.map((capability) => (
        `- ${capability.id}@${capability.version} — ${capability.provider.id}@${capability.provider.version}${capability.conformance_suite ? `; conformance suite: \`${capability.conformance_suite}\`` : ""}${capability.change_history?.length ? `; ${capability.change_history.length} structured revision transition(s)` : ""}`
      ))
    );
  }

  if (specHostExpectations.items.length > 0) {
    lines.push(
      "",
      "## Host concepts this package expects",
      "",
      "Map each concept to its local equivalent before implementing. The host decides its own names for these.",
      "",
      ...specHostExpectations.items.map((item) => (
        `- \`${item.capability}\` — expected by ${item.consumer}, tested against ${item.tested_against}`
      ))
    );
  }

  if (specRequirements.length > 0 || specConcerns.length > 0) {
    lines.push("", "## Capability and composition declaration review", "");
    lines.push(...specRequirements.length > 0
      ? specRequirements.map((requirement) => (
        `- **${requirement.status === "review" ? "REVIEW" : "NO DECLARED CONCERN"}** ${requirementSummary(requirement)}.`
      ))
      : ["No further capability expectation needs review."]);

    if (specConcerns.length > 0) {
      lines.push("", "### Composition review records", "");
      lines.push(...specConcerns.map((review) => (
        `- **${review.severity.toUpperCase()} / ${review.code}** — packages: ${review.packages.join(", ")}${review.capability ? `; capability: ${review.capability}` : ""}${reviewRevisionSummary(review)}${review.reason ? `; author reason: ${JSON.stringify(review.reason)}` : ""}`
      )));
    }
  }

  lines.push(
    "",
    "## Unresolved solution decisions",
    ""
  );

  if (unresolvedDecisions.length === 0) {
    lines.push("No package-declared decisions remain unresolved. An implementing agent must still surface any new semantic conflict it discovers.");
  } else {
    lines.push(...unresolvedDecisions.map((decision) => (
      `- **${decision.package}/${decision.id}**${decision.required ? " (required)" : ""}: ${decision.question}`
    )));
  }

  if (specAbsent.length > 0) {
    lines.push(
      "",
      "## Not declared by any selected package",
      "",
      `${specAbsent.join(", ")}.`
    );
  }

  return `${lines.join("\n").trim()}\n`;
}

async function resolveProjectInStaging(rootPath, {
  additionPaths = [],
  featurePaths = [],
  implementationProfiles = [],
  outputDirectory = process.cwd(),
  configurationSelectionsPath,
  appliedIntentPath,
  completionScopePath,
  technicalPreferencesPath,
  artifactSelectionsPath,
  decisionsPath
} = {}) {
  const application = await validatePackage(rootPath);
  const explicitAdditionRecords = await Promise.all(
    [...additionPaths, ...featurePaths].map(validatePackage)
  );
  const selectedComposition = collectSelectedComposition(
    application,
    explicitAdditionRecords
  );

  const { orderedAdditions: orderedFeatures, capabilities, requirements, reviews } = analyzeCapabilityDeclarations(
    application,
    selectedComposition.additions
  );
  const selectedRecords = [application, ...orderedFeatures];
  const configurationState = await readConfigurationSelections(
    configurationSelectionsPath,
    selectedRecords
  );
  const applicationSelection = configurationState.selections.get(application.manifest.id);
  const applicationConfiguration = applicationSelection.values;
  const resolvedIntent = await resolveAppliedIntent(appliedIntentPath, selectedRecords);
  const completionScope = await resolveCompletionScope(completionScopePath, selectedRecords);

  const selectedFeatures = [];
  for (const feature of orderedFeatures) {
    const selection = configurationState.selections.get(feature.manifest.id);
    selectedFeatures.push({
      record: feature,
      configuration: selection.values,
      configurationSelection: selection.selection
    });
  }

  const technicalPreferences = technicalPreferencesPath
    ? await readYamlFile(path.resolve(technicalPreferencesPath), "Technical preferences")
    : {};
  if (!isPlainObject(technicalPreferences)) {
    throw new SeedSpecError("Technical preferences must be a YAML object", {
      code: "INVALID_TECHNICAL_PREFERENCES"
    });
  }
  const artifactSelections = await readArtifactSelections(
    artifactSelectionsPath,
    selectedRecords
  );
  await validateTechnicalPreferences(
    technicalPreferences,
    selectedRecords,
    artifactSelections
  );

  const suppliedDecisions = decisionsPath
    ? await readYamlFile(path.resolve(decisionsPath), "Decision answers")
    : {};
  const decisionState = normalizeDecisionAnswers(
    selectedRecords,
    suppliedDecisions
  );
  const workspace = path.join(path.resolve(outputDirectory), ".seedspec");
  const featuresDirectory = path.join(workspace, "additions");
  await mkdir(workspace, { recursive: true });
  await rm(featuresDirectory, { recursive: true, force: true });
  await mkdir(featuresDirectory, { recursive: true });
  const implementationProfileState = await materializeImplementationProfileState(
    selectedRecords,
    implementationProfiles,
    workspace
  );
  const status = configurationState.status === "review"
    || resolvedIntent.status === "review"
    || decisionState.unresolved.some((decision) => decision.required)
    || implementationProfileState.status === "review"
    ? "needs-input"
    : "ready";
  const artifactIndex = await materializeArtifacts(
    selectedRecords,
    workspace,
    artifactSelections
  );
  const componentIndex = await materializeComponents(
    selectedRecords,
    workspace
  );
  const compositionEdges = resolveCompositionEdges(
    selectedComposition.edges,
    componentIndex
  );
  const taskIndex = await materializeTasks(selectedRecords, workspace);
  const implementationResourceIndex = await materializeImplementationResources(
    selectedRecords,
    workspace
  );
  const contextIndex = await materializeContextIndex(
    selectedRecords,
    workspace,
    artifactIndex,
    implementationResourceIndex
  );
  const project = {
    protocol_version: protocolVersion,
    status,
    configuration_status: configurationState.status,
    intent_status: resolvedIntent.status,
    completion_scope_status: completionScope.status,
    declaration_status: reviews.length > 0 ? "review" : "no-declared-concerns",
    artifact_status: artifactIndex.artifacts.some(
      (artifact) => artifact.disposition === "unreviewed"
    ) ? "review" : "recorded",
    implementation_profile_status: implementationProfileState.status,
    root: packageReference(application),
    additions: selectedFeatures.map(({ record }) => packageReference(record)),
    composition: compositionEdges,
    configuration: "resolved-config.yaml",
    resolved_intent: "resolved-intent.yaml",
    task_index: "tasks.yaml",
    component_index: "components.yaml",
    artifact_index: "artifacts.yaml",
    context_index: "context-index.yaml",
    implementation_resource_index: "implementation-resources.yaml",
    implementation_resource_state: "implementation-resource-state.yaml",
    implementation_profile_state: "implementation-profile-state.yaml",
    lockfile: "dependencies.lock.yaml",
    resolved_spec: "resolved-spec.md",
    agent_guide: "agent-guide.md",
    implementation_notes: "implementation-notes.md",
    verification_report: "verification-report.md",
    completion_scope: "completion-scope.yaml",
    verification_state: "verification-state.yaml",
    resolution_receipt: "resolution-receipt.json",
    resolved_decisions: decisionState.resolved,
    unresolved_decisions: decisionState.unresolved
  };
  const lock = {
    protocol_version: protocolVersion,
    resolution_algorithm: "declaration-review-v1",
    root: lockedPackage(application),
    additions: selectedFeatures.map(({ record }) => lockedPackage(record)),
    capabilities,
    requirements,
    reviews
  };
  const resolvedConfiguration = {
    protocol_version: protocolVersion,
    root: {
      package: application.manifest.id,
      selection: applicationSelection.selection,
      values: applicationConfiguration
    },
    additions: Object.fromEntries(
      selectedFeatures.map(({ record, configuration, configurationSelection }) => [
        record.manifest.id,
        {
          package: record.manifest.id,
          selection: configurationSelection,
          values: configuration
        }
      ])
    ),
    decisions: Object.fromEntries(
      decisionState.resolved.map((decision) => [
        `${decision.package}/${decision.id}`,
        decision.answer
      ])
    ),
    technical_preferences: technicalPreferences
  };

  await Promise.all([
    writeFile(path.join(workspace, "project.yaml"), stringifyYaml(project), "utf8"),
    writeFile(path.join(workspace, "dependencies.lock.yaml"), stringifyYaml(lock), "utf8"),
    writeFile(path.join(workspace, "resolved-config.yaml"), stringifyYaml(resolvedConfiguration), "utf8"),
    writeFile(path.join(workspace, "resolved-intent.yaml"), stringifyYaml(resolvedIntent), "utf8"),
    writeFile(path.join(workspace, "completion-scope.yaml"), stringifyYaml(completionScope), "utf8"),
    writeFile(path.join(workspace, "tasks.yaml"), stringifyYaml(taskIndex), "utf8"),
    writeFile(path.join(workspace, "components.yaml"), stringifyYaml(componentIndex), "utf8"),
    writeFile(path.join(workspace, "artifacts.yaml"), stringifyYaml(artifactIndex), "utf8"),
    writeFile(
      path.join(workspace, "context-index.yaml"),
      stringifyYaml(contextIndex),
      "utf8"
    ),
    writeFile(
      path.join(workspace, "implementation-profile-state.yaml"),
      stringifyYaml(implementationProfileState),
      "utf8"
    ),
    writeFile(
      path.join(workspace, "implementation-resources.yaml"),
      stringifyYaml(implementationResourceIndex),
      "utf8"
    ),
    writeFile(
      path.join(workspace, "agent-guide.md"),
      buildAgentGuide({
        application,
        features: selectedFeatures,
        composition: compositionEdges,
        resolvedIntent,
        implementationProfileState,
        configurationStatus: configurationState.status,
        completionScope,
        requirements,
        reviews,
        unresolvedDecisions: decisionState.unresolved,
        components: componentIndex.components,
        artifacts: artifactIndex.artifacts,
        taskIndex,
        implementationResources: implementationResourceIndex,
        contextModules: contextIndex,
        technicalPreferences
      }),
      "utf8"
    ),
    writeFile(
      path.join(workspace, "resolved-spec.md"),
      await buildResolvedSpecification({
        application,
        applicationConfiguration,
        applicationConfigurationSelection: applicationSelection.selection,
        resolvedIntent,
        completionScope,
        features: selectedFeatures,
        composition: compositionEdges,
        implementationProfileState,
        technicalPreferences,
        capabilities,
        requirements,
        reviews,
        resolvedDecisions: decisionState.resolved,
        unresolvedDecisions: decisionState.unresolved,
        components: componentIndex.components,
        artifacts: artifactIndex.artifacts,
        taskIndex,
        implementationResources: implementationResourceIndex,
        contextModules: contextIndex
      }),
      "utf8"
    )
  ]);

  await Promise.all([
    writeFileIfMissing(path.join(workspace, "implementation-notes.md"), initialImplementationNotes),
    writeFileIfMissing(path.join(workspace, "verification-report.md"), initialVerificationReport),
    writeFileIfMissing(
      path.join(workspace, "verification-state.yaml"),
      stringifyYaml(createInitialVerificationState(completionScope))
    ),
    reconcileImplementationResourceState(workspace, implementationResourceIndex),
    writeFileIfMissing(path.join(path.resolve(outputDirectory), "AGENTS.md"), rootAgentInstructions)
  ]);

  for (const { record, configuration, configurationSelection } of selectedFeatures) {
    const featureDirectory = path.join(featuresDirectory, featureDirectoryName(record.manifest.id));
    await mkdir(featureDirectory, { recursive: true });
    const integration = await readMarkdownComponent(record, "integration");
    const source = {
      id: record.manifest.id,
      name: record.manifest.name,
      version: record.manifest.version,
      kind: record.manifest.kind,
      digest: record.digest,
      requires: record.manifest.requires,
      provides: record.manifest.provides,
      compatibility: record.manifest.compatibility,
      conflicts: record.manifest.conflicts ?? {},
      decisions: record.manifest.decisions ?? [],
      implementation_profiles: record.manifest.implementation_profiles ?? [],
      ...(record.manifest.composition
        ? { composition: record.manifest.composition }
        : {}),
      artifacts: record.manifest.artifacts ?? [],
      relationships: record.manifest.relationships ?? [],
      tasks: record.manifest.tasks ?? null,
      implementation_resources: record.manifest.implementation_resources ?? null,
      context: record.manifest.context,
      extensions: record.manifest.extensions ?? {}
    };
    const integrationRecord = [
      `# ${record.manifest.name} integration decisions`,
      "",
      `Source: ${record.manifest.id}@${record.manifest.version}`,
      "",
      `Digest: ${record.digest}`,
      "",
      "Capability, compatibility, and conflict declarations are integration evidence, not installation gates or observations of the actual realization. Solution configuration and answered decisions are recorded in `resolved-config.yaml`.",
      "",
      "## Capability review",
      "",
      ...requirements
        .filter((requirement) => requirement.consumer === record.manifest.id)
        .map((requirement) => (
          `- **${requirement.status === "review" ? "REVIEW" : "NO DECLARED CONCERN"}** ${requirementSummary(requirement)}.`
        )),
      "",
      "## Composition review records",
      "",
      ...(reviews.filter((review) => review.packages.includes(record.manifest.id)).length
        ? reviews
          .filter((review) => review.packages.includes(record.manifest.id))
          .map((review) => (
            `- ${review.severity} / ${review.code}${review.capability ? `: ${review.capability}` : ""}${reviewRevisionSummary(review)}${review.reason ? ` — ${JSON.stringify(review.reason)}` : ""}`
          ))
        : ["No declared composition concern names this addition."]),
      "",
      "## Source integration requirements",
      "",
      integration || "No additional source integration guidance was supplied.",
      "",
      "## Unresolved decisions",
      "",
      ...(decisionState.unresolved.filter((decision) => decision.package === record.manifest.id).length
        ? decisionState.unresolved
          .filter((decision) => decision.package === record.manifest.id)
          .map((decision) => `- ${decision.id}: ${decision.question}`)
        : ["None declared by this package."]),
      ""
    ].join("\n");

    await Promise.all([
      writeFile(path.join(featureDirectory, "source.yaml"), stringifyYaml(source), "utf8"),
      writeFile(
        path.join(featureDirectory, "resolved-config.yaml"),
        stringifyYaml({
          package: record.manifest.id,
          selection: configurationSelection,
          values: configuration
        }),
        "utf8"
      ),
      writeFile(path.join(featureDirectory, "integration-decisions.md"), integrationRecord, "utf8")
    ]);
  }

  const resolutionReceipt = await createResolutionReceipt({
    workspace,
    root: application,
    additions: orderedFeatures,
    projectStatus: status,
    implementationProfiles,
    inputs: {
      configurationSelectionsPath,
      appliedIntentPath,
      completionScopePath,
      technicalPreferencesPath,
      artifactSelectionsPath,
      decisionsPath
    }
  });

  return {
    workspace,
    project,
    lock,
    resolvedConfiguration,
    resolvedIntent,
    artifactIndex,
    componentIndex,
    composition: compositionEdges,
    taskIndex,
    implementationResourceIndex,
    contextIndex,
    completionScope,
    implementationProfileState,
    resolutionReceipt,
    additions: selectedFeatures.map(({ record }) => record.manifest.id),
    features: selectedFeatures.map(({ record }) => record.manifest.id)
  };
}

export async function resolveProject(rootPath, options = {}) {
  const outputRoot = path.resolve(options.outputDirectory ?? process.cwd());
  await mkdir(outputRoot, { recursive: true });

  const workspace = path.join(outputRoot, ".seedspec");
  const transactionRoot = await mkdtemp(
    path.join(outputRoot, ".seedspec-transaction-")
  );
  const stagedWorkspace = path.join(transactionRoot, ".seedspec");
  const previousWorkspace = await pathExists(workspace);

  try {
    if (previousWorkspace) {
      if (!previousWorkspace.isDirectory()) {
        throw new SeedSpecError("Resolved workspace path is not a directory", {
          code: "INVALID_PROJECT_WORKSPACE"
        });
      }
      await cp(workspace, stagedWorkspace, { recursive: true });
    }

    const result = await resolveProjectInStaging(rootPath, {
      ...options,
      outputDirectory: transactionRoot
    });

    const stagedAgentInstructions = path.join(transactionRoot, "AGENTS.md");
    const projectAgentInstructions = path.join(outputRoot, "AGENTS.md");
    if (!await pathExists(projectAgentInstructions)
      && await pathExists(stagedAgentInstructions)) {
      await cp(stagedAgentInstructions, projectAgentInstructions);
    }

    let backupWorkspace;
    if (previousWorkspace) {
      backupWorkspace = path.join(
        outputRoot,
        `.seedspec-previous-${randomUUID()}`
      );
      await rename(workspace, backupWorkspace);
    }

    try {
      await rename(stagedWorkspace, workspace);
    } catch (error) {
      if (backupWorkspace && !await pathExists(workspace)) {
        await rename(backupWorkspace, workspace);
      }
      throw error;
    }

    if (backupWorkspace) {
      await rm(backupWorkspace, { recursive: true, force: true }).catch(() => {});
    }

    return {
      ...result,
      workspace
    };
  } finally {
    await rm(transactionRoot, { recursive: true, force: true });
  }
}
