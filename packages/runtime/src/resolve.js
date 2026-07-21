import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { analyzeCapabilityDeclarations } from "./capabilities.js";
import { createInitialVerificationState, resolveCompletionScope } from "./completion.js";
import { SeedSpecError } from "./errors.js";
import { pathExists, readMarkdownComponent, readYamlFile, resolvePackagePath } from "./files.js";
import { compileConfigurationSchema, compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { artifactReview, componentReview } from "./guidance.js";
import {
  materializeImplementationResources,
  reconcileImplementationResourceState
} from "./resources.js";
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

function conditionVerificationSummary(condition) {
  return `${condition.verification.method}; evidence ${condition.verification.evidence}`;
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
    protocol_version: "0.1",
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

function buildAgentGuide({
  application,
  features,
  implementationProfileState,
  configurationStatus,
  completionScope,
  requirements,
  reviews,
  unresolvedDecisions,
  components,
  artifacts,
  implementationResources,
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
  const resourcePolicies = implementationResources.policies;
  const declaredResources = implementationResources.resources;
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
    if (reference.resource) {
      const resource = declaredResources.find((candidate) => (
        candidate.package === reference.package && candidate.id === reference.resource
      ));
      return `implementation resource ${reference.package}/${reference.resource} (resolve \`${resource.entrypoint}\` through the resource index)`;
    }
    const component = components.find((candidate) => (
      candidate.package === reference.package && candidate.name === reference.component
    ));
    return `component ${reference.package}/${reference.component} at \`${component.path}\``;
  };
  const lines = [
    "# SeedSpec implementation guide",
    "",
    "This project contains SeedSpec packages: structured solution intent and verification guidance for an implementing agent. They are not a framework, generated architecture, executable workflow, or package-manager constraint.",
    "",
    "## Read first",
    "",
    "1. Read `resolved-spec.md` and `resolved-config.yaml` for recorded solution intent, configuration, decisions, and technical preferences.",
    "2. Read `implementation-profile-state.yaml` for candidate implementation profiles, the recorded preference, and conditions that must be checked.",
    "3. Read `components.yaml` and `artifacts.yaml` for preserved optional material and its required review timing.",
    "4. Read `implementation-resources.yaml`, then run `seedspec resolve-resources <project-path>` before consulting any declared implementation skill or instruction.",
    "5. Read `implementation-resource-state.yaml`; every bundled fallback must include the reason canonical resolution failed.",
    "6. Read `implementation-notes.md` for local terminology, behavior, architecture, external resource identifiers, configured state, and earlier deviations.",
    "7. Read each addition's `additions/*/integration-decisions.md` before integrating it.",
    "8. Inspect the actual environment before planning. Current code, configuration, external system state, user data, tests, and audit records are authoritative evidence of what exists.",
    "",
    "## Working principles",
    "",
    "- Preserve the requested outcome, not the SeedSpec's original implementation assumptions.",
    "- Use each package's kind as a hint for planning depth and likely concerns, not as a validity, composition, architecture, or execution constraint.",
    "- Capabilities, compatibility, and conflicts are package-author declarations, not observations of the actual implementation.",
    "- Missing, multiple, cyclic, conflicting, or revision-different declarations are prompts to inspect and plan, never reasons by themselves to reject the work.",
    "- Recognize equivalent local concepts even when names differ. Prefer adapting incoming behavior to the current realization.",
    "- Do not rename, migrate, or overwrite established behavior merely to make it resemble the source SeedSpec.",
    "- Surface consequential ambiguity before implementing it. Reversible technical choices remain yours.",
    "- Translate acceptance criteria into verification appropriate for the selected realization. Use tests where appropriate, but allow credible observations of configured external state and delivered operational results.",
    "- Record material semantic mappings, external resource identifiers, selected approaches, and deviations in `implementation-notes.md`.",
    "- Record acceptance evidence, remaining gaps, and manual checks in `verification-report.md`.",
    "- Keep concise per-scope results and evidence references truthful in `verification-state.yaml`.",
    "- Artifact discovery is descriptive, not an instruction to activate the artifact's tooling or lifecycle.",
    "- Artifact disposition records intended use. Even a selected artifact does not authorize loading a skill, running a command, fetching a URL, or invoking an adapter.",
    "- If an artifact format has its own workflow, explain the exact action and obtain specific user direction at activation time. The package author's preference does not override the end user's direction.",
    "- Implementation resources are author-selected help, not capability evidence or automatic authority. A package-scoped skill is not installed or automatically invoked. Resolve exact online versions first, report fallback use, inspect skill frontmatter, and explicitly consult only the bodies relevant to the work.",
    "- `required`, `recommended`, and `available` express author intent. They never authorize executing a tool, changing external state, or overriding the end user, current project requirements, or clearer solution intent.",
    "",
    "## Selected intent",
    "",
    `- Root package: ${application.manifest.id}@${application.manifest.version} (kind hint: ${application.manifest.kind})`,
    `- Additions: ${features.length ? features.map(({ record }) => `${record.manifest.id}@${record.manifest.version} (kind hint: ${record.manifest.kind})`).join(", ") : "none"}`,
    `- Implementation profiles: ${implementationProfileState.status}`,
    `- Configuration: ${configurationStatus === "selected" ? "explicitly selected" : "review required; author examples are present only as unreviewed placeholders"}`,
    `- Optional components: ${components.length ? components.map((component) => `${component.package}/${component.name}`).join(", ") : "none"}`,
    `- Optional artifacts: ${artifacts.length ? artifacts.map((artifact) => `${artifact.package}/${artifact.id} (${artifact.type}; ${artifact.disposition})`).join(", ") : "none"}`,
    `- Implementation resources: ${declaredResources.length ? declaredResources.map((resource) => `${resource.package}/${resource.id} (${resource.kind}; ${resource.usage})`).join(", ") : "none"}`,
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

  lines.push("", "## Implementation profile decision", "");
  if (implementationProfileState.status === "not-declared") {
    lines.push("No selected package declares an implementation profile. Choose execution from the core intent, actual environment, and end-user direction.");
  } else {
    for (const packageState of implementationProfileState.packages.filter((item) => item.profiles.length > 0)) {
      lines.push(`### ${packageState.package} (${packageState.selection})`, "");
      for (const profile of packageState.profiles) {
        const preferred = packageState.preferred_profile === profile.id ? " **PREFERRED**" : "";
        lines.push(`- **${profile.name}** (\`${profile.id}\`)${preferred}: ${profile.description}`);
        if (profile.guidance) lines.push(`  - Guidance: \`${profile.guidance}\``);
        for (const item of profile.prerequisites) {
          lines.push(`  - Prerequisite [${conditionVerificationSummary(item)}]: ${item.statement}`);
          if (item.verification.guidance) lines.push(`    - ${item.verification.guidance}`);
        }
        for (const item of profile.blockers) {
          lines.push(`  - Blocker check [${conditionVerificationSummary(item)}]: ${item.statement}`);
          if (item.verification.guidance) lines.push(`    - ${item.verification.guidance}`);
        }
        for (const item of profile.tradeoffs) lines.push(`  - Tradeoff: ${item}`);
      }
      lines.push("");
    }
    if (implementationProfileState.status === "review") {
      lines.push(
        "**Do not choose silently.** More than one implementation profile is available without a recorded preference. Explain the materially different approaches, inspect the declared prerequisites and blockers, ask the end user which direction to prefer, and rerun resolution with `-i <profile-id>` or `--implementation <profile-id>` before consequential implementation."
      );
    } else if (implementationProfileState.packages.some((item) => item.selection === "preferred")) {
      lines.push(
        "A preferred profile is strong implementation guidance, not an irreversible command or a claim that its prerequisites hold. Verify its prerequisites and blocker conditions. Follow it when viable; if it conflicts with the actual environment or core intent, present the evidence and ask the end user before changing direction."
      );
    } else {
      lines.push(
        "A sole available profile is author-provided context, not an explicit preference. Inspect it and the actual environment before recommending whether to use it."
      );
    }
  }

  lines.push("", "## Implementation-resource policy", "");
  for (const policy of resourcePolicies) {
    lines.push(`- ${policy.package}: additional guidance \`${policy.additional_guidance}\``);
    if (policy.catalogs.length > 0) {
      lines.push(...policy.catalogs.map((catalog) => (
        `  - catalog ${catalog.id}@${catalog.version}: ${catalog.url}`
      )));
    }
  }
  if (declaredResources.length === 0) {
    lines.push("", "No author-selected implementation resources are declared. Absence is not a statement that a capability exists, is absent, or should be implemented a particular way.");
  } else {
    lines.push("", "Resolve these resources before considering their contents:", "");
    for (const resource of declaredResources) {
      const applies = [
        ...(resource.applies_to?.capabilities ?? []).map((id) => `capability ${id}`),
        ...(resource.applies_to?.targets ?? []).map((id) => `target ${id}`)
      ];
      lines.push(
        `- **${resource.usage.toUpperCase()}** ${resource.package}/${resource.id}@${resource.version} (${resource.kind}; ${resource.update_policy})${applies.length ? ` — ${applies.join(", ")}` : ""}`,
        `  - ${resource.description}`,
        `  - Entrypoint after resolution: \`${resource.entrypoint}\``
      );
    }
    lines.push(
      "",
      "After resolution, use `implementation-resource-state.yaml` to locate each verified resource root and entrypoint. Consult required resources, consult recommended resources when relevant unless they conflict with stronger direction, and decide whether available resources add enough value to justify their context cost. Resolve supporting-file references from the resource root. Record consulted or skipped status and the reason. Consultation does not install or automatically invoke a skill, execute a tool, or promote guidance into solution intent."
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
    lines.push("No concern is visible from the selected packages' declarations. This is not a compatibility claim; verify the actual realization before integration.");
  } else {
    lines.push(
      "Create an integration plan for these author-supplied review signals. Resolve them against actual code, configuration, external state, and user intent rather than treating them as package-manager failures:",
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

  lines.push("", "## Solution decisions", "");
  if (unresolvedDecisions.length === 0) {
    lines.push("No package-declared solution decisions remain unresolved.");
  } else {
    lines.push(...unresolvedDecisions.map((decision) => (
      `- ${decision.required ? "REQUIRED" : "OPTIONAL"} ${decision.package}/${decision.id}: ${decision.question}`
    )));
  }

  lines.push("", "## Before claiming completion", "");
  if (completionScope.status === "review") {
    lines.push(
      "**Completion scope is not fully recorded. Do not claim this implementation is complete.** Add observable criteria or select author acceptance material for these packages, then rerun resolution:",
      "",
      ...completionScope.uncovered_packages.map((packageId) => `- ${packageId}`),
      ""
    );
  } else {
    lines.push("The current completion claim is limited to these recorded scope items:", "");
    for (const item of completionScope.items) {
      if (item.kind === "criterion") {
        lines.push(`- **${item.disposition.toUpperCase()} ${item.id}** (${item.package}): ${item.statement}`);
      } else if (item.selection === "all") {
        lines.push(`- **${item.id}**: all acceptance material from ${item.package}/${item.component}`);
      } else {
        lines.push(
          `- **${item.id}**: selected references from ${item.package}/${item.component}: ${(item.included_references ?? []).join(", ")}`
        );
        if (item.deferred_references?.length) {
          lines.push(`  - Deferred gaps: ${item.deferred_references.join(", ")}`);
        }
        if (item.excluded_references?.length) {
          lines.push(`  - Explicitly outside this scope: ${item.excluded_references.join(", ")}`);
        }
      }
    }
    lines.push("");
  }

  if (completionComponents.length === 0 && completionArtifacts.length === 0) {
    lines.push("No author acceptance, evaluation, or evidence material is preserved. Use the explicit project criteria in `completion-scope.yaml` and attach credible evidence to `verification-state.yaml`.");
  } else {
    if (completionComponents.length > 0 || selectedCompletionArtifacts.length > 0) {
      lines.push(
        "These preserved materials may supply acceptance behavior or evidence. `completion-scope.yaml`, not mere presence, determines the current claim:",
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
    "Project `status: ready` authorizes implementation planning; it is not a completion claim. The realization is complete only when the explicitly recorded scope works in the actual environment, `verification-state.yaml` truthfully records results and evidence, and material deviations are documented. Run `seedspec completion <project-path>` before claiming verified completion. A package author's execution path or architecture remains optional unless the user selected it, the selected technical preferences or target require it, or the intended outcome depends on it.",
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

## Acceptance evidence

| SeedSpec criterion | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Add criteria as they are implemented | not run | — | — |

## Manual checks

- None recorded yet.

Evidence may include tests, known-data queries, external resource identifiers,
permission checks, delivered messages, screenshots, or platform audit records.

## Remaining gaps

- Implementation has not yet been verified.
`;

const rootAgentInstructions = `# SeedSpec project guidance

Read \`.seedspec/agent-guide.md\` before planning or realizing SeedSpec work. Resolve declared implementation resources through the SeedSpec CLI, report every bundled fallback, and explicitly consult only relevant resolved skills or instructions. Packaged skills are not installed or automatically invoked. Preserve local behavior and terminology, record material deviations and external resource identifiers in \`.seedspec/implementation-notes.md\`, record detailed acceptance evidence in \`.seedspec/verification-report.md\`, and keep \`.seedspec/verification-state.yaml\` aligned with the exact completion scope.
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
  completionScope,
  features,
  implementationProfileState,
  technicalPreferences,
  capabilities,
  requirements,
  reviews,
  resolvedDecisions,
  unresolvedDecisions,
  components,
  artifacts,
  implementationResources
}) {
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
    `- Protocol: ${application.manifest.protocol_version}`,
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

  lines.push("", "## Implementation profile state", "");
  if (implementationProfileState.status === "not-declared") {
    lines.push("No implementation profiles were declared. Execution remains open to the implementing agent under end-user direction.");
  } else {
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
      if (item.kind === "criterion") return `- ${item.id} (${item.disposition}): ${item.statement}`;
      if (item.selection === "all") return `- ${item.id}: all of ${item.package}/${item.component}`;
      return `- ${item.id}: ${item.package}/${item.component} references ${(item.included_references ?? []).join(", ")}`;
    }));
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

  lines.push("", "## Author-declared implementation resources", "");
  if (implementationResources.resources.length === 0) {
    lines.push("No selected package declares an implementation resource.");
  } else {
    lines.push(
      "These resources express author guidance and discovery policy. They do not prove implementation capability or authorize tool execution:",
      "",
      ...implementationResources.resources.map((resource) => (
        `- ${resource.package}/${resource.id}@${resource.version}: ${resource.kind}; ${resource.usage}; ${resource.update_policy}`
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
    "## Unresolved solution decisions",
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

export async function resolveProject(rootPath, {
  additionPaths = [],
  featurePaths = [],
  implementationProfiles = [],
  outputDirectory = process.cwd(),
  configurationSelectionsPath,
  completionScopePath,
  technicalPreferencesPath,
  artifactSelectionsPath,
  decisionsPath
} = {}) {
  const application = await validatePackage(rootPath);
  const featureRecords = await Promise.all(
    [...additionPaths, ...featurePaths].map(validatePackage)
  );
  const selectedIds = new Set([application.manifest.id]);
  for (const feature of featureRecords) {
    if (selectedIds.has(feature.manifest.id)) {
      throw new SeedSpecError(`Package selected more than once: ${feature.manifest.id}`, {
        code: "DUPLICATE_ADDITION"
      });
    }
    selectedIds.add(feature.manifest.id);
  }

  const { orderedAdditions: orderedFeatures, capabilities, requirements, reviews } = analyzeCapabilityDeclarations(
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
  const implementationResourceIndex = await materializeImplementationResources(
    selectedRecords,
    workspace
  );

  const project = {
    protocol_version: "0.1",
    status,
    configuration_status: configurationState.status,
    completion_scope_status: completionScope.status,
    declaration_status: reviews.length > 0 ? "review" : "no-declared-concerns",
    artifact_status: artifactIndex.artifacts.some(
      (artifact) => artifact.disposition === "unreviewed"
    ) ? "review" : "recorded",
    implementation_profile_status: implementationProfileState.status,
    root: packageReference(application),
    additions: selectedFeatures.map(({ record }) => packageReference(record)),
    configuration: "resolved-config.yaml",
    component_index: "components.yaml",
    artifact_index: "artifacts.yaml",
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
    resolved_decisions: decisionState.resolved,
    unresolved_decisions: decisionState.unresolved
  };
  const lock = {
    protocol_version: "0.1",
    resolution_algorithm: "declaration-review-v1",
    root: lockedPackage(application),
    additions: selectedFeatures.map(({ record }) => lockedPackage(record)),
    capabilities,
    requirements,
    reviews
  };
  const resolvedConfiguration = {
    protocol_version: "0.1",
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
    writeFile(path.join(workspace, "completion-scope.yaml"), stringifyYaml(completionScope), "utf8"),
    writeFile(path.join(workspace, "components.yaml"), stringifyYaml(componentIndex), "utf8"),
    writeFile(path.join(workspace, "artifacts.yaml"), stringifyYaml(artifactIndex), "utf8"),
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
        implementationProfileState,
        configurationStatus: configurationState.status,
        completionScope,
        requirements,
        reviews,
        unresolvedDecisions: decisionState.unresolved,
        components: componentIndex.components,
        artifacts: artifactIndex.artifacts,
        implementationResources: implementationResourceIndex,
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
        completionScope,
        features: selectedFeatures,
        implementationProfileState,
        technicalPreferences,
        capabilities,
        requirements,
        reviews,
        resolvedDecisions: decisionState.resolved,
        unresolvedDecisions: decisionState.unresolved,
        components: componentIndex.components,
        artifacts: artifactIndex.artifacts,
        implementationResources: implementationResourceIndex
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
      artifacts: record.manifest.artifacts ?? [],
      relationships: record.manifest.relationships ?? [],
      implementation_resources: record.manifest.implementation_resources ?? null,
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
            `- ${review.code}${review.capability ? `: ${review.capability}` : ""}${review.reason ? ` — ${JSON.stringify(review.reason)}` : ""}`
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

  return {
    workspace,
    project,
    lock,
    resolvedConfiguration,
    artifactIndex,
    componentIndex,
    implementationResourceIndex,
    completionScope,
    implementationProfileState,
    additions: selectedFeatures.map(({ record }) => record.manifest.id),
    features: selectedFeatures.map(({ record }) => record.manifest.id)
  };
}
