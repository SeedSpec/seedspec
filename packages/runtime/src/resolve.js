import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { analyzeCapabilityDeclarations } from "./capabilities.js";
import { SeedSpecError } from "./errors.js";
import { pathExists, readMarkdownComponent, readYamlFile, resolvePackagePath } from "./files.js";
import { compileConfigurationSchema, compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { artifactReview, componentReview } from "./guidance.js";
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

function featureDirectoryName(id) {
  return id.replace(/[^a-zA-Z0-9.-]/g, "-");
}

function portablePath(...parts) {
  return parts.join("/");
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
    protocol_version: "0.1",
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
        ...(artifact.concerns ? { concerns: artifact.concerns } : {})
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
    protocol_version: "0.1",
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

function yamlBlock(value) {
  return `\`\`\`yaml\n${stringifyYaml(value).trimEnd()}\n\`\`\``;
}

function requirementSummary(requirement) {
  const providers = requirement.providers.length === 0
    ? "no selected package declares a provider"
    : requirement.providers.map((candidate) => (
      `${candidate.provider.id}@${candidate.provided_version} (${candidate.revision_status})`
    )).join(", ");
  const issues = requirement.issues.length ? requirement.issues.join(", ") : "none";
  return `${requirement.consumer} expects ${requirement.capability}@${requirement.tested_against}; declared candidates: ${providers}; issues: ${issues}`;
}

async function writeFileIfMissing(filePath, contents) {
  if (!await pathExists(filePath)) {
    await writeFile(filePath, contents, "utf8");
  }
}

function buildAgentGuide({
  application,
  features,
  configurationStatus,
  requirements,
  reviews,
  unresolvedDecisions,
  components,
  artifacts,
  technicalPreferences
}) {
  const planningComponents = components.filter((component) => component.review === "before-planning");
  const planningArtifacts = artifacts.filter((artifact) => artifact.review === "before-planning");
  const activationArtifacts = artifacts.filter((artifact) => artifact.review === "before-activation");
  const completionComponents = components.filter(
    (component) => component.review === "before-completion-claim"
  );
  const completionArtifacts = artifacts.filter(
    (artifact) => artifact.review === "before-completion-claim"
      && artifact.disposition !== "declined"
  );
  const selectedCompletionArtifacts = completionArtifacts.filter(
    (artifact) => artifact.disposition === "selected"
  );
  const deferredCompletionArtifacts = completionArtifacts.filter(
    (artifact) => artifact.disposition === "deferred"
  );
  const unreviewedCompletionArtifacts = completionArtifacts.filter(
    (artifact) => artifact.disposition === "unreviewed"
  );
  const hasTechnicalPreferences = Object.keys(technicalPreferences).length > 0;
  const implementationTargets = technicalPreferences.implementation_targets ?? [];
  const selectedPlanningArtifacts = planningArtifacts.filter(
    (artifact) => artifact.disposition === "selected"
  );
  const unreviewedPlanningArtifacts = planningArtifacts.filter(
    (artifact) => artifact.disposition === "unreviewed"
  );
  const deferredPlanningArtifacts = planningArtifacts.filter(
    (artifact) => artifact.disposition === "deferred"
  );
  const materialLocation = (reference) => {
    if (reference.artifact) {
      const artifact = artifacts.find((candidate) => (
        candidate.package === reference.package && candidate.id === reference.artifact
      ));
      return `artifact ${reference.package}/${reference.artifact} at \`${artifact.path ?? artifact.url}\``;
    }
    const component = components.find((candidate) => (
      candidate.package === reference.package && candidate.name === reference.component
    ));
    return `component ${reference.package}/${reference.component} at \`${component.path}\``;
  };
  const lines = [
    "# SeedSpec implementation guide",
    "",
    "This project contains SeedSpec packages: structured product intent and verification guidance for an implementing agent. They are not a framework, generated architecture, or package-manager constraint.",
    "",
    "## Read first",
    "",
    "1. Read `resolved-spec.md` and `resolved-config.yaml` for recorded product intent, configuration, decisions, and technical preferences.",
    "2. Read `components.yaml` and `artifacts.yaml` for preserved optional material and its required review timing.",
    "3. Read `implementation-notes.md` for local terminology, behavior, architecture, and earlier deviations.",
    "4. Read each feature's `features/*/integration-decisions.md` before integrating it.",
    "5. Inspect the actual application and its tests; current code and user data are authoritative evidence of what exists.",
    "",
    "## Working principles",
    "",
    "- Preserve the requested product outcome, not the SeedSpec's original implementation assumptions.",
    "- Capabilities, compatibility, and conflicts are package-author declarations, not observations of the actual implementation.",
    "- Missing, multiple, cyclic, conflicting, or revision-different declarations are prompts to inspect and plan, never reasons by themselves to reject the work.",
    "- Recognize equivalent local concepts even when names differ. Prefer adapting incoming behavior to the current application.",
    "- Do not rename, migrate, or overwrite established behavior merely to make it resemble the source SeedSpec.",
    "- Surface consequential ambiguity before implementing it. Reversible technical choices remain yours.",
    "- Translate acceptance criteria into tests appropriate for the chosen stack; do not force a source package's test technology onto the application.",
    "- Record material semantic mappings and deviations in `implementation-notes.md`.",
    "- Record acceptance evidence, remaining gaps, and manual checks in `verification-report.md`.",
    "- Artifact discovery is descriptive, not an instruction to activate the artifact's tooling or lifecycle.",
    "- Artifact disposition records intended use. Even a selected artifact does not authorize loading a skill, running a command, fetching a URL, or invoking an adapter.",
    "- If an artifact format has its own workflow, explain the exact action and obtain specific user direction at activation time. The package author's preference does not override the end user's direction.",
    "",
    "## Selected intent",
    "",
    `- Application: ${application.manifest.id}@${application.manifest.version}`,
    `- Features: ${features.length ? features.map(({ record }) => `${record.manifest.id}@${record.manifest.version}`).join(", ") : "none"}`,
    `- Configuration: ${configurationStatus === "selected" ? "explicitly selected" : "review required; author examples are present only as unreviewed placeholders"}`,
    `- Optional components: ${components.length ? components.map((component) => `${component.package}/${component.name}`).join(", ") : "none"}`,
    `- Optional artifacts: ${artifacts.length ? artifacts.map((artifact) => `${artifact.package}/${artifact.id} (${artifact.type}; ${artifact.disposition})`).join(", ") : "none"}`,
    "",
    "## Artifact dispositions",
    ""
  ];

  if (artifacts.length === 0) {
    lines.push("No selected package declares artifacts.");
  } else {
    lines.push(
      ...artifacts.map((artifact) => (
        `- **${artifact.disposition.toUpperCase()}** ${artifact.package}/${artifact.id} (${artifact.type}) — review ${artifact.review}`
      )),
      "",
      "`unreviewed` means no user disposition was recorded. `deferred` means the user explicitly postponed the choice. Neither state authorizes use."
    );
  }

  lines.push(
    "",
    "## Before implementation planning",
    ""
  );

  if (configurationStatus === "review") {
    lines.push(
      "**Do not treat the recorded example values as selected product behavior.** No configuration selection was supplied. Review every package configuration with the user, create a complete configuration-selections document, and rerun resolution before consequential implementation.",
      ""
    );
  }

  if (hasTechnicalPreferences) {
    lines.push(
      "The user supplied technical preferences. Treat selected platform, architecture, infrastructure, or hosting targets as implementation constraints unless they conflict with the requested product or the user revises them. Surface conflicts before choosing an incompatible architecture.",
      ""
    );
  }

  if (implementationTargets.length > 0) {
    lines.push(
      "Selected implementation targets are strong user context, not compatibility guarantees. Review their referenced guidance and surface conflicts before choosing architecture:",
      ""
    );
    for (const target of implementationTargets) {
      lines.push(
        `- **${target.id}**: ${target.kind} → ${target.target}`,
        ...target.guidance.map((reference) => `  - ${materialLocation(reference)}`)
      );
    }
    lines.push("");
  }

  if (
    planningComponents.length === 0
    && selectedPlanningArtifacts.length === 0
    && unreviewedPlanningArtifacts.length === 0
    && deferredPlanningArtifacts.length === 0
  ) {
    lines.push("No optional component or artifact is classified for review before planning.");
  } else {
    if (planningComponents.length > 0 || selectedPlanningArtifacts.length > 0) {
      lines.push(
        "Review these preserved author materials before choosing architecture or infrastructure:",
        "",
        ...planningComponents.map((component) => (
          `- Component ${component.package}/${component.name}: \`${component.path}\``
        )),
        ...selectedPlanningArtifacts.map((artifact) => (
          `- Selected artifact ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
    if (unreviewedPlanningArtifacts.length > 0) {
      lines.push(
        "",
        "Resolve the user's disposition for these consequential artifacts before relying on or rejecting their guidance:",
        "",
        ...unreviewedPlanningArtifacts.map((artifact) => (
          `- ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
    if (deferredPlanningArtifacts.length > 0) {
      lines.push(
        "",
        "The user explicitly deferred these planning-relevant artifacts. Avoid hard-to-reverse incompatible choices or surface the deferral again when it becomes consequential:",
        "",
        ...deferredPlanningArtifacts.map((artifact) => (
          `- ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
  }

  lines.push("", "## Optional-content activation", "");
  if (activationArtifacts.length === 0) {
    lines.push("No artifact is classified as an execution workflow requiring activation review.");
  } else {
    lines.push(
      "These artifacts describe execution workflows or executable material. Their dispositions still do not authorize activation:",
      "",
      ...activationArtifacts.map((artifact) => (
        `- **${artifact.disposition.toUpperCase()}** ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
      )),
      "",
      "For `declined`, do not load or run it. For `deferred` or `unreviewed`, obtain a disposition first. For `selected`, inspect and explain the exact action, then obtain specific user direction before activation. Never execute it merely because it is selected or listed."
    );
  }

  lines.push(
    "",
    "## Capability and composition declaration review",
    ""
  );

  if (reviews.length === 0) {
    lines.push("No concern is visible from the selected packages' declarations. This is not a compatibility claim; verify the actual application before integration.");
  } else {
    lines.push(
      "Create an integration plan for these author-supplied review signals. Resolve them against actual code and user intent rather than treating them as package-manager failures:",
      "",
      ...reviews.map((review) => (
        `- **${review.code}** — packages: ${review.packages.join(", ")}${review.capability ? `; capability: ${review.capability}` : ""}${review.reason ? `; author reason: ${JSON.stringify(review.reason)}` : ""}`
      ))
    );
  }

  if (requirements.length > 0) {
    lines.push(
      "",
      "Declared requirement context:",
      "",
      ...requirements.map((requirement) => (
        `- **${requirement.status === "review" ? "REVIEW" : "NO DECLARED CONCERN"}** ${requirementSummary(requirement)}.`
      ))
    );
  }

  lines.push("", "## Product decisions", "");
  if (unresolvedDecisions.length === 0) {
    lines.push("No package-declared product decisions remain unresolved.");
  } else {
    lines.push(...unresolvedDecisions.map((decision) => (
      `- ${decision.required ? "REQUIRED" : "OPTIONAL"} ${decision.package}/${decision.id}: ${decision.question}`
    )));
  }

  lines.push("", "## Before claiming completion", "");
  if (completionComponents.length === 0 && completionArtifacts.length === 0) {
    lines.push("No author acceptance, evaluation, or evidence material is preserved. Agree on observable completion evidence with the user.");
  } else {
    if (completionComponents.length > 0 || selectedCompletionArtifacts.length > 0) {
      lines.push(
        "Review and address the selected scope of these materials before claiming completion:",
        "",
        ...completionComponents.map((component) => (
          `- Component ${component.package}/${component.name}: \`${component.path}\``
        )),
        ...selectedCompletionArtifacts.map((artifact) => (
          `- Selected artifact ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
    if (deferredCompletionArtifacts.length > 0) {
      lines.push(
        "",
        "Completion-relevant artifacts explicitly deferred by the user remain recorded gaps, not addressed evidence:",
        "",
        ...deferredCompletionArtifacts.map((artifact) => (
          `- ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
    if (unreviewedCompletionArtifacts.length > 0) {
      lines.push(
        "",
        "No user disposition is recorded for these completion-relevant artifacts. Decide whether they belong to the completion scope before relying on them:",
        "",
        ...unreviewedCompletionArtifacts.map((artifact) => (
          `- ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
  }

  lines.push(
    "",
    "## Completion standard",
    "",
    "The implementation is complete when the explicitly selected scope works in the actual application, relevant acceptance behavior has credible evidence, and material deviations are recorded. A package author's architecture remains optional unless the user selected it, the selected technical preferences or hosting target require it, or the product outcome depends on it.",
    ""
  );

  return lines.join("\n");
}

const initialImplementationNotes = `# SeedSpec implementation notes

Keep this as a concise current-state record for future implementing agents. It is not required to be an exhaustive changelog.

## Local terminology and concept mappings

- None recorded yet.

## Material behavioral deviations

- None recorded yet.

## Architecture and integration choices

- None recorded yet.

## Known limitations and follow-up

- None recorded yet.
`;

const initialVerificationReport = `# SeedSpec verification report

Status: not started

## Implemented use cases

- None recorded yet.

## Acceptance evidence

| SeedSpec criterion | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Add criteria as they are implemented | not run | — | — |

## Manual checks

- None recorded yet.

## Remaining gaps

- Implementation has not yet been verified.
`;

const rootAgentInstructions = `# SeedSpec project guidance

Read \`.seedspec/agent-guide.md\` before planning or implementing SeedSpec work. Preserve project-local behavior and terminology, record material deviations in \`.seedspec/implementation-notes.md\`, and record acceptance evidence in \`.seedspec/verification-report.md\`.
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
  features,
  technicalPreferences,
  capabilities,
  requirements,
  reviews,
  resolvedDecisions,
  unresolvedDecisions,
  components,
  artifacts
}) {
  const lines = [
    `# Resolved SeedSpec: ${application.manifest.name}`,
    "",
    "> This file records resolved product intent. It is an input to planning and implementation, not generated application code.",
    "",
    "## Project summary",
    "",
    `- Application: ${application.manifest.id}@${application.manifest.version}`,
    `- Application digest: ${application.digest}`,
    `- Features: ${features.length ? features.map(({ record }) => `${record.manifest.id}@${record.manifest.version}`).join(", ") : "none"}`,
    `- Protocol: ${application.manifest.protocol_version}`,
    "",
    "## Product configuration",
    "",
    `### ${application.manifest.name} (${applicationConfigurationSelection})`,
    "",
    yamlBlock(applicationConfiguration),
    "",
    "## Application definition",
    "",
    application.definition.trim()
  ];

  const applicationAcceptance = await readMarkdownComponent(application, "acceptance");
  if (applicationAcceptance) {
    lines.push("", "## Application acceptance", "", applicationAcceptance.trim());
  }

  for (const { record, configuration, configurationSelection } of features) {
    lines.push(
      "",
      `## Feature: ${record.manifest.name}`,
      "",
      `Package: ${record.manifest.id}@${record.manifest.version}`,
      "",
      `Digest: ${record.digest}`,
      "",
      `### Feature configuration (${configurationSelection})`,
      "",
      yamlBlock(configuration),
      "",
      "### Feature definition",
      "",
      record.definition.trim()
    );

    const integration = await readMarkdownComponent(record, "integration");
    if (integration) lines.push("", "### Integration requirements", "", integration.trim());

    const acceptance = await readMarkdownComponent(record, "acceptance");
    if (acceptance) lines.push("", "### Feature acceptance", "", acceptance.trim());
  }

  lines.push("", "## Technical preferences", "");
  if (Object.keys(technicalPreferences).length === 0) {
    lines.push("No technical preferences were supplied. The execution engine retains implementation freedom.");
  } else {
    lines.push(yamlBlock(technicalPreferences));
  }

  lines.push("", "## Preserved components", "");
  if (components.length === 0) {
    lines.push("No selected package declares optional components.");
  } else {
    lines.push(...components.map((component) => (
      `- ${component.package}/${component.name}: ${component.path} — review ${component.review}`
    )));
  }

  lines.push("", "## Discovered artifacts", "");
  if (artifacts.length === 0) {
    lines.push("No selected package declares optional artifacts.");
  } else {
    lines.push(
      "These artifacts are preserved inputs, not automatically activated workflows:",
      "",
      ...artifacts.map((artifact) => (
        `- ${artifact.package}/${artifact.id}: ${artifact.type} — ${artifact.path ?? artifact.url} — disposition ${artifact.disposition}; review ${artifact.review}`
      ))
    );
  }

  lines.push("", "## Resolved decisions", "");
  if (resolvedDecisions.length === 0) {
    lines.push("No declared decisions were answered during resolution.");
  } else {
    lines.push(...resolvedDecisions.map((decision) => (
      `- ${decision.package}/${decision.id}: ${decision.answer}`
    )));
  }

  lines.push(
    "",
    "## Declared capabilities",
    "",
    ...capabilities.map((capability) => (
      `- ${capability.id}@${capability.version} — ${capability.provider.id}@${capability.provider.version}`
    )),
    "",
    "## Capability and composition declaration review",
    ""
  );

  if (requirements.length === 0) {
    lines.push("No selected package declares capability expectations.");
  } else {
    lines.push(...requirements.map((requirement) => (
      `- **${requirement.status === "review" ? "REVIEW" : "NO DECLARED CONCERN"}** ${requirementSummary(requirement)}.`
    )));
  }

  lines.push("", "### Composition review records", "");
  if (reviews.length === 0) {
    lines.push("No concern is visible from package declarations. This does not establish implementation compatibility.");
  } else {
    lines.push(...reviews.map((review) => (
      `- **${review.code}** — packages: ${review.packages.join(", ")}${review.capability ? `; capability: ${review.capability}` : ""}${review.reason ? `; author reason: ${JSON.stringify(review.reason)}` : ""}`
    )));
  }

  lines.push(
    "",
    "## Unresolved product decisions",
    ""
  );

  if (unresolvedDecisions.length === 0) {
    lines.push("No package-declared decisions remain unresolved. An implementation agent must still surface any new semantic conflict it discovers.");
  } else {
    lines.push(...unresolvedDecisions.map((decision) => (
      `- **${decision.package}/${decision.id}**${decision.required ? " (required)" : ""}: ${decision.question}`
    )));
  }

  return `${lines.join("\n").trim()}\n`;
}

export async function resolveProject(applicationPath, {
  featurePaths = [],
  outputDirectory = process.cwd(),
  configurationSelectionsPath,
  technicalPreferencesPath,
  artifactSelectionsPath,
  decisionsPath
} = {}) {
  const application = await validatePackage(applicationPath);
  if (application.manifest.kind !== "application") {
    throw new SeedSpecError(`Resolve requires an application package, received ${application.manifest.kind}: ${application.manifest.id}`, {
      code: "EXPECTED_APPLICATION"
    });
  }

  const featureRecords = await Promise.all(featurePaths.map(validatePackage));
  const selectedIds = new Set([application.manifest.id]);
  for (const feature of featureRecords) {
    if (feature.manifest.kind !== "feature") {
      throw new SeedSpecError(`Feature selection must be a feature package: ${feature.manifest.id}`, {
        code: "EXPECTED_FEATURE"
      });
    }
    if (selectedIds.has(feature.manifest.id)) {
      throw new SeedSpecError(`Package selected more than once: ${feature.manifest.id}`, {
        code: "DUPLICATE_FEATURE"
      });
    }
    selectedIds.add(feature.manifest.id);
  }

  const { orderedFeatures, capabilities, requirements, reviews } = analyzeCapabilityDeclarations(
    application,
    featureRecords
  );
  const selectedRecords = [application, ...orderedFeatures];
  const configurationState = await readConfigurationSelections(
    configurationSelectionsPath,
    selectedRecords
  );
  const applicationSelection = configurationState.selections.get(application.manifest.id);
  const applicationConfiguration = applicationSelection.values;

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
  const status = configurationState.status === "review"
    || decisionState.unresolved.some((decision) => decision.required)
    ? "needs-input"
    : "ready";

  const workspace = path.join(path.resolve(outputDirectory), ".seedspec");
  const featuresDirectory = path.join(workspace, "features");
  await mkdir(workspace, { recursive: true });
  await rm(featuresDirectory, { recursive: true, force: true });
  await mkdir(featuresDirectory, { recursive: true });
  const artifactIndex = await materializeArtifacts(
    selectedRecords,
    workspace,
    artifactSelections
  );
  const componentIndex = await materializeComponents(
    selectedRecords,
    workspace
  );

  const project = {
    protocol_version: "0.1",
    status,
    configuration_status: configurationState.status,
    declaration_status: reviews.length > 0 ? "review" : "no-declared-concerns",
    artifact_status: artifactIndex.artifacts.some(
      (artifact) => artifact.disposition === "unreviewed"
    ) ? "review" : "recorded",
    application: packageReference(application),
    features: selectedFeatures.map(({ record }) => packageReference(record)),
    configuration: "resolved-config.yaml",
    component_index: "components.yaml",
    artifact_index: "artifacts.yaml",
    lockfile: "dependencies.lock.yaml",
    resolved_spec: "resolved-spec.md",
    agent_guide: "agent-guide.md",
    implementation_notes: "implementation-notes.md",
    verification_report: "verification-report.md",
    resolved_decisions: decisionState.resolved,
    unresolved_decisions: decisionState.unresolved
  };
  const lock = {
    protocol_version: "0.1",
    resolution_algorithm: "declaration-review-v1",
    application: lockedPackage(application),
    features: selectedFeatures.map(({ record }) => lockedPackage(record)),
    capabilities,
    requirements,
    reviews
  };
  const resolvedConfiguration = {
    protocol_version: "0.1",
    application: {
      package: application.manifest.id,
      selection: applicationSelection.selection,
      values: applicationConfiguration
    },
    features: Object.fromEntries(
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
    writeFile(path.join(workspace, "components.yaml"), stringifyYaml(componentIndex), "utf8"),
    writeFile(path.join(workspace, "artifacts.yaml"), stringifyYaml(artifactIndex), "utf8"),
    writeFile(
      path.join(workspace, "agent-guide.md"),
      buildAgentGuide({
        application,
        features: selectedFeatures,
        configurationStatus: configurationState.status,
        requirements,
        reviews,
        unresolvedDecisions: decisionState.unresolved,
        components: componentIndex.components,
        artifacts: artifactIndex.artifacts,
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
        features: selectedFeatures,
        technicalPreferences,
        capabilities,
        requirements,
        reviews,
        resolvedDecisions: decisionState.resolved,
        unresolvedDecisions: decisionState.unresolved,
        components: componentIndex.components,
        artifacts: artifactIndex.artifacts
      }),
      "utf8"
    )
  ]);

  await Promise.all([
    writeFileIfMissing(path.join(workspace, "implementation-notes.md"), initialImplementationNotes),
    writeFileIfMissing(path.join(workspace, "verification-report.md"), initialVerificationReport),
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
      artifacts: record.manifest.artifacts ?? [],
      relationships: record.manifest.relationships ?? [],
      extensions: record.manifest.extensions ?? {}
    };
    const integrationRecord = [
      `# ${record.manifest.name} integration decisions`,
      "",
      `Source: ${record.manifest.id}@${record.manifest.version}`,
      "",
      `Digest: ${record.digest}`,
      "",
      "Capability, compatibility, and conflict declarations are integration evidence, not installation gates or observations of the actual application. Product configuration and answered decisions are recorded in `resolved-config.yaml`.",
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
            `- ${review.code}${review.capability ? `: ${review.capability}` : ""}${review.reason ? ` — ${JSON.stringify(review.reason)}` : ""}`
          ))
        : ["No declared composition concern names this feature."]),
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

  return {
    workspace,
    project,
    lock,
    resolvedConfiguration,
    artifactIndex,
    componentIndex,
    features: selectedFeatures.map(({ record }) => record.manifest.id)
  };
}
