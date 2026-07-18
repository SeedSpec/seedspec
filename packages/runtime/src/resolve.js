import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { resolveCapabilityGraph } from "./capabilities.js";
import { SeedSpecError } from "./errors.js";
import { pathExists, readMarkdownComponent, readYamlFile, resolvePackagePath } from "./files.js";
import { compileConfigurationSchema, formatSchemaErrors } from "./schema.js";
import { validatePackage } from "./validate.js";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function mergeConfiguration(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;

  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = key in result ? mergeConfiguration(result[key], value) : value;
  }
  return result;
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

async function selectConfiguration(packageRecord, overridePath) {
  if (!overridePath) return packageRecord.exampleConfiguration;
  const override = await readYamlFile(path.resolve(overridePath), "Configuration override");
  const selected = mergeConfiguration(packageRecord.exampleConfiguration, override);
  validateSelectedConfiguration(packageRecord, selected);
  return selected;
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

async function materializeArtifacts(records, workspace) {
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
      const resolved = {
        package: record.manifest.id,
        id: artifact.id,
        type: artifact.type,
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

function yamlBlock(value) {
  return `\`\`\`yaml\n${stringifyYaml(value).trimEnd()}\n\`\`\``;
}

async function writeFileIfMissing(filePath, contents) {
  if (!await pathExists(filePath)) {
    await writeFile(filePath, contents, "utf8");
  }
}

function buildAgentGuide({ application, features, requirements, unresolvedDecisions, artifacts }) {
  const reviewItems = requirements.filter((requirement) => requirement.status === "review");
  const lines = [
    "# SeedSpec implementation guide",
    "",
    "This project contains SeedSpec packages: structured product intent and verification guidance for an implementing agent. They are not a framework, generated architecture, or package-manager constraint.",
    "",
    "## Read first",
    "",
    "1. Read `resolved-spec.md` for the selected application, features, configuration, and acceptance criteria.",
    "2. Read `artifacts.yaml` to discover optional intent, design, execution, infrastructure, and evidence artifacts preserved from the selected packages.",
    "3. Read `implementation-notes.md` for local terminology, behavior, architecture, and earlier deviations.",
    "4. Read each feature's `features/*/integration-decisions.md` before integrating it.",
    "5. Inspect the actual application and its tests; current code and user data are authoritative evidence of what exists.",
    "",
    "## Working principles",
    "",
    "- Preserve the requested product outcome, not the SeedSpec's original implementation assumptions.",
    "- Capability revisions are evidence. A mismatch is a prompt to inspect and plan, never a reason by itself to reject the work.",
    "- Recognize equivalent local concepts even when names differ. Prefer adapting incoming behavior to the current application.",
    "- Do not rename, migrate, or overwrite established behavior merely to make it resemble the source SeedSpec.",
    "- Surface consequential ambiguity before implementing it. Reversible technical choices remain yours.",
    "- Translate acceptance criteria into tests appropriate for the chosen stack; do not force a source package's test technology onto the application.",
    "- Record material semantic mappings and deviations in `implementation-notes.md`.",
    "- Record acceptance evidence, remaining gaps, and manual checks in `verification-report.md`.",
    "- Artifact discovery is descriptive, not an instruction to activate the artifact's tooling or lifecycle.",
    "- If an artifact format has its own workflow, explain the relevant choice and ask the end user before adopting that workflow. The package author's preference does not override the end user's direction.",
    "",
    "## Selected intent",
    "",
    `- Application: ${application.manifest.id}@${application.manifest.version}`,
    `- Features: ${features.length ? features.map(({ record }) => `${record.manifest.id}@${record.manifest.version}`).join(", ") : "none"}`,
    `- Optional artifacts: ${artifacts.length ? artifacts.map((artifact) => `${artifact.package}/${artifact.id} (${artifact.type})`).join(", ") : "none"}`,
    "",
    "## Capability revision review",
    ""
  ];

  if (reviewItems.length === 0) {
    lines.push("No selected capability revision differs from the revision its consumer was tested against.");
  } else {
    lines.push(
      "Create an integration plan for these items before implementation:",
      "",
      ...reviewItems.map((requirement) => (
        `- ${requirement.consumer} was tested against ${requirement.capability}@${requirement.tested_against}; the selected provider supplies ${requirement.provided_version}.`
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

  lines.push(
    "",
    "## Completion standard",
    "",
    "The implementation is complete when the selected use case works in the actual application, relevant acceptance behavior has credible evidence, and material deviations are recorded. Conformity to a particular architecture is not required.",
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
  features,
  technicalPreferences,
  capabilities,
  requirements,
  resolvedDecisions,
  unresolvedDecisions,
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
    `### ${application.manifest.name}`,
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

  for (const { record, configuration } of features) {
    lines.push(
      "",
      `## Feature: ${record.manifest.name}`,
      "",
      `Package: ${record.manifest.id}@${record.manifest.version}`,
      "",
      `Digest: ${record.digest}`,
      "",
      "### Selected feature configuration",
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

  lines.push("", "## Discovered artifacts", "");
  if (artifacts.length === 0) {
    lines.push("No selected package declares optional artifacts.");
  } else {
    lines.push(
      "These artifacts are preserved inputs, not automatically activated workflows:",
      "",
      ...artifacts.map((artifact) => (
        `- ${artifact.package}/${artifact.id}: ${artifact.type} — ${artifact.path ?? artifact.url}`
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
    "## Resulting capabilities",
    "",
    ...capabilities.map((capability) => (
      `- ${capability.id}@${capability.version} — ${capability.provider.id}@${capability.provider.version}`
    )),
    "",
    "## Capability integration review",
    ""
  );

  if (requirements.length === 0) {
    lines.push("No selected feature declares host capability expectations.");
  } else {
    lines.push(...requirements.map((requirement) => (
      `- **${requirement.status === "review" ? "REVIEW" : "ALIGNED"}** ${requirement.consumer} uses ${requirement.capability}; tested against ${requirement.tested_against}, provider supplies ${requirement.provided_version}.`
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
  applicationConfigurationPath,
  featureConfigurationPaths = {},
  technicalPreferencesPath,
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

  const { orderedFeatures, capabilities, requirements } = resolveCapabilityGraph(application, featureRecords);
  const applicationConfiguration = await selectConfiguration(
    application,
    applicationConfigurationPath
  );
  validateSelectedConfiguration(application, applicationConfiguration);

  const selectedFeatures = [];
  for (const feature of orderedFeatures) {
    const configuration = await selectConfiguration(
      feature,
      featureConfigurationPaths[feature.manifest.id]
    );
    validateSelectedConfiguration(feature, configuration);
    selectedFeatures.push({ record: feature, configuration });
  }

  const unknownFeatureConfigurations = Object.keys(featureConfigurationPaths).filter(
    (id) => !selectedIds.has(id)
  );
  if (unknownFeatureConfigurations.length > 0) {
    throw new SeedSpecError("Feature configuration supplied for an unselected feature", {
      code: "UNKNOWN_FEATURE_CONFIGURATION",
      details: unknownFeatureConfigurations
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

  const suppliedDecisions = decisionsPath
    ? await readYamlFile(path.resolve(decisionsPath), "Decision answers")
    : {};
  const decisionState = normalizeDecisionAnswers(
    [application, ...orderedFeatures],
    suppliedDecisions
  );
  const status = decisionState.unresolved.some((decision) => decision.required)
    ? "needs-decisions"
    : "ready";

  const workspace = path.join(path.resolve(outputDirectory), ".seedspec");
  const featuresDirectory = path.join(workspace, "features");
  await mkdir(workspace, { recursive: true });
  await rm(featuresDirectory, { recursive: true, force: true });
  await mkdir(featuresDirectory, { recursive: true });
  const artifactIndex = await materializeArtifacts(
    [application, ...orderedFeatures],
    workspace
  );

  const project = {
    protocol_version: "0.1",
    status,
    integration_status: requirements.some((requirement) => requirement.status === "review")
      ? "review"
      : "aligned",
    application: packageReference(application),
    features: selectedFeatures.map(({ record }) => packageReference(record)),
    configuration: "resolved-config.yaml",
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
    resolution_algorithm: "capability-graph-v1",
    application: lockedPackage(application),
    features: selectedFeatures.map(({ record }) => lockedPackage(record)),
    capabilities,
    requirements
  };
  const resolvedConfiguration = {
    protocol_version: "0.1",
    application: {
      package: application.manifest.id,
      values: applicationConfiguration
    },
    features: Object.fromEntries(
      selectedFeatures.map(({ record, configuration }) => [
        record.manifest.id,
        { package: record.manifest.id, values: configuration }
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
    writeFile(path.join(workspace, "artifacts.yaml"), stringifyYaml(artifactIndex), "utf8"),
    writeFile(
      path.join(workspace, "agent-guide.md"),
      buildAgentGuide({
        application,
        features: selectedFeatures,
        requirements,
        unresolvedDecisions: decisionState.unresolved,
        artifacts: artifactIndex.artifacts
      }),
      "utf8"
    ),
    writeFile(
      path.join(workspace, "resolved-spec.md"),
      await buildResolvedSpecification({
        application,
        applicationConfiguration,
        features: selectedFeatures,
        technicalPreferences,
        capabilities,
        requirements,
        resolvedDecisions: decisionState.resolved,
        unresolvedDecisions: decisionState.unresolved,
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

  for (const { record, configuration } of selectedFeatures) {
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
      "Capability revisions are integration evidence, not installation gates. Product configuration and answered decisions are recorded in `resolved-config.yaml`.",
      "",
      "## Capability review",
      "",
      ...requirements
        .filter((requirement) => requirement.consumer === record.manifest.id)
        .map((requirement) => (
          `- **${requirement.status === "review" ? "REVIEW" : "ALIGNED"}** ${requirement.capability}: tested against ${requirement.tested_against}; selected provider supplies ${requirement.provided_version}.`
        )),
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
      writeFile(path.join(featureDirectory, "resolved-config.yaml"), stringifyYaml(configuration), "utf8"),
      writeFile(path.join(featureDirectory, "integration-decisions.md"), integrationRecord, "utf8")
    ]);
  }

  return {
    workspace,
    project,
    lock,
    resolvedConfiguration,
    artifactIndex,
    features: selectedFeatures.map(({ record }) => record.manifest.id)
  };
}
