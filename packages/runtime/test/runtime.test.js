import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  AUTHORING_AREAS,
  AUTHORING_CANDIDATE_FORMAT,
  AUTHORING_CHANGE_PROPOSAL_FORMAT,
  AUTHORING_PROBE_RUN_FORMAT,
  QUESTION_RESOLUTIONS,
  discoverProviders,
  readBundledResource,
  formatBundledResource,
  answerQuestion,
  computeWorkspaceRevision,
  attachSource,
  recordObservations,
  reviewArea,
  formatAuthoringGuidance,
  readAuthoringSchema,
  AUTHORING_INSTRUCTION_FORMAT,
  AUTHORING_RESULT_FORMAT,
  AUTHORING_WORKSPACE_OPERATION_FORMAT,
  AUTHORING_WORKSPACE_SNAPSHOT_FORMAT,
  applyIntegrationBridgePlan,
  applyDocumentChange,
  auditPackage,
  beginPackage,
  capabilityConformanceBinding,
  classifyCapabilityRevision,
  completionScopeDigest,
  conformanceSuiteVersion,
  createAdapterRegistry,
  createAuthoringWorkspace,
  computeDirectoryDigest,
  computeFileDigest,
  createAuthorEvaluation,
  decideDocumentChange,
  decideClarificationCandidate,
  discoverAuthoringWorkspace,
  formatAuthoringWorkspaceSnapshot,
  discoverFeatures,
  discoverFormatIntegrations,
  formatAuthoringAudit,
  formatAuthoringDocumentation,
  formatAuthoringStarterPrompt,
  formatPackageAgentPrompt,
  formatPackageBeginning,
  inspectPackage,
  inspectCapabilityConformance,
  inspectInstallation,
  inspectAuthoringWorkspace,
  inspectProjectCompletion,
  initPackage,
  listPackageArtifacts,
  listPackageImplementationResources,
  loadIntegrationAdapter,
  lintPackage,
  packPackage,
  planIntegrationBridges,
  prepareContext,
  prepareClarificationProbe,
  preparePackage,
  proposeDocumentChange,
  publishCheckPackage,
  readIntegrationDescriptor,
  recordImplementationResourceUse,
  recordClarificationCandidate,
  recordClarificationProbeRun,
  recordContextUse,
  resolveImplementationResources,
  resolveProject,
  runConformanceSuite,
  upgradePackage,
  validateContextModule,
  verifyProjectLock,
  validatePackage,
  verifyClarificationProbe,
  authoringWorkspaceLockPath,
  withAuthoringWorkspaceMutationLock
} from "../src/index.js";
import {
  compileConfigurationSchema,
  compileProtocolSchema,
  formatSchemaErrors
} from "../src/schema.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(packageRoot, "../..");
const allowance = path.join(root, "conformance/fixtures/comprehensive-application");
const savings = path.join(root, "conformance/fixtures/portable-feature");
const resourcesFixture = path.join(root, "conformance/fixtures/implementation-resources");
const contextModulesFixture = path.join(root, "conformance/fixtures/context-modules");
const contextIntegration = path.join(root, "conformance/integrations/example-context");
const contextRequest = path.join(root, "conformance/fixtures/context-request-review.yaml");
const contextUse = path.join(root, "conformance/fixtures/context-use-review.json");
const streaks = path.join(root, "conformance/fixtures/revision-feature");
const hubspotMetric = path.join(root, "conformance/fixtures/profiled-workflow");
const fixtures = path.join(packageRoot, "test/fixtures");
const ambiguousAuthoring = path.join(fixtures, "authoring-ambiguous-delivery");
const delegatedAuthoring = path.join(fixtures, "authoring-delegated-delivery");

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "seedspec-v02-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function completeAuthoringReview(packagePath, stateDirectory) {
  for (let index = 0; index < AUTHORING_AREAS.length; index += 1) {
    const audit = await auditPackage(packagePath, {
      stateDirectory,
      target: "package",
      toolVersion: "0.2.0"
    });
    const result = parseYaml(await readFile(audit.current.result, "utf8"));
    result.outcome = "reviewed";
    result.disposition = "good-enough";
    result.summary = `Reviewed ${audit.current.area} for publishing test.`;
    result.package_digest_after = audit.package.digest;
    result.validation.protocol_valid = true;
    result.validation.commands = [
      "seedspec validate package",
      "seedspec lint package",
      "seedspec digest package"
    ];
    await writeFile(audit.current.result, stringifyYaml(result), "utf8");
  }
  return auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0",
    statusOnly: true
  });
}

async function writeExampleConfigurationSelections(directory, packagePaths, name = "configuration-selections.yaml") {
  const records = await Promise.all(packagePaths.map(validatePackage));
  const selectionPath = path.join(directory, name);
  await writeFile(selectionPath, stringifyYaml({
    protocol_version: "0.3",
    packages: records.map((record) => ({
      package: record.manifest.id,
      selection: "example"
    }))
  }), "utf8");
  return selectionPath;
}

async function writeAffirmedAppliedIntent(directory, packagePaths, name = "applied-intent.yaml") {
  const records = await Promise.all(packagePaths.map(validatePackage));
  const intentPath = path.join(directory, name);
  await writeFile(intentPath, stringifyYaml({
    protocol_version: "0.3",
    packages: records.map((record) => ({
      package: record.manifest.id,
      use: "as-authored"
    })),
    contributions: []
  }), "utf8");
  return intentPath;
}

const realizationVerification = Object.freeze({
  subject: "realization",
  method: "tool-check",
  timing: "completion",
  evidence: "required"
});

const publicAddressLookup = async () => [{ address: "203.0.113.10", family: 4 }];

async function createImplementationResourcePackage(t, {
  includeCanonical = true,
  includeBundled = true,
  usage = "recommended"
} = {}) {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "resource-package");
  await cp(allowance, packagePath, { recursive: true });
  const resourcePath = path.join(packagePath, "guidance/authorization");
  const skillSource = `---
name: authorization-decisions
description: Help an implementing agent decide whether and how authorization belongs in this product.
---

# Authorization decisions

Inspect actual actors, protected resources, and target constraints before choosing an approach.
`;
  await mkdir(resourcePath, { recursive: true });
  await writeFile(path.join(resourcePath, "SKILL.md"), skillSource, "utf8");
  const digest = await computeDirectoryDigest(resourcePath);
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.implementation_resources = {
    additional_guidance: "agent-delegated",
    catalogs: [{
      id: "org.seedspec.guidance.catalog",
      url: "https://guidance.seedspec.org/catalog.json",
      version: "0.1.0"
    }],
    resources: [{
      id: "org.seedspec.guidance.authorization-decisions",
      kind: "skill",
      description: "Help the agent make an authorization decision without assuming accounts are required.",
      usage,
      entrypoint: "SKILL.md",
      version: "0.1.0",
      update_policy: "exact",
      ...(includeCanonical ? {
        canonical: {
          manifest_url: "https://guidance.seedspec.org/resources/authorization/0.1.0/resource.json",
          digest
        }
      } : {}),
      ...(includeBundled ? {
        bundled: {
          path: "guidance/authorization/",
          version: "0.1.0",
          digest,
          compatibility: "exact"
        }
      } : {}),
      applies_to: {
        capabilities: ["org.seedspec.core.actors"],
        targets: ["org.seedspec.target.nextjs"]
      }
    }]
  };
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  return { packagePath, resourcePath, skillSource, digest, output };
}

async function createContextModulePackage(t) {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "context-module-package");
  await cp(allowance, packagePath, { recursive: true });

  const behaviorRoot = path.join(packagePath, "context/refund-safety");
  const bridgeRoot = path.join(packagePath, "context/review-behavior");
  await mkdir(behaviorRoot, { recursive: true });
  await mkdir(bridgeRoot, { recursive: true });
  await writeFile(
    path.join(behaviorRoot, "BEHAVIOR.md"),
    `---\nname: refund-safety\ndescription: Review refund decisions for clear evidence and escalation.\n---\n\n# Refund safety\n`,
    "utf8"
  );
  await writeFile(
    path.join(bridgeRoot, "SKILL.md"),
    `---\nname: review-behavior\ndescription: Use when reviewing a trace against a BEHAVIOR.md module.\n---\n\n# Review behavior\n\nRead the selected behavior and compare it with trace evidence.\n`,
    "utf8"
  );

  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.context.modules.push(
    {
      id: "refund-safety",
      format: "org.example.context.behavior",
      format_version: "1.0.0",
      description: "Expected refund-agent conduct for review and eval design.",
      entrypoint: "BEHAVIOR.md",
      source: { kind: "package", path: "context/refund-safety/" },
      applies_to: {
        purposes: ["review", "evaluate"],
        audiences: ["reviewer", "evaluator"]
      },
      bridges: [{
        skill: "review-behavior",
        applies_to: {
          purposes: ["review", "evaluate"],
          audiences: ["reviewer", "evaluator"]
        }
      }]
    },
    {
      id: "review-behavior",
      format: "io.agentskills.skill",
      description: "Bridge Skill for consuming Agent Behavior modules.",
      entrypoint: "SKILL.md",
      source: { kind: "package", path: "context/review-behavior/" },
      applies_to: {
        purposes: ["review", "evaluate"]
      }
    }
  );
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");

  return { output, packagePath };
}

async function createNestedCompositionPackage(t) {
  const output = await temporaryDirectory(t);
  const parentPath = path.join(output, "family-hub");
  const widgetPath = path.join(parentPath, "bundled/widget");
  const controlPath = path.join(widgetPath, "bundled/control");

  await initPackage("application", parentPath);
  await initPackage("component", widgetPath);
  await initPackage("component", controlPath);
  await writeFile(
    path.join(parentPath, "seed.md"),
    "# Family hub\n\nProvide a family hub that supplies household events to a shared widget.\n",
    "utf8"
  );
  await writeFile(
    path.join(widgetPath, "seed.md"),
    "# Shared widget\n\nPresent household events and delegate selection controls without owning the household record.\n",
    "utf8"
  );
  await writeFile(
    path.join(controlPath, "seed.md"),
    "# Selection control\n\nPresent supplied selection options and emit a requested selection change.\n",
    "utf8"
  );
  await writeFile(
    path.join(parentPath, "success.md"),
    "# Family hub success\n\nA household member can use the shared widget from the family hub.\n",
    "utf8"
  );
  await writeFile(
    path.join(widgetPath, "success.md"),
    "# Widget success\n\nThe widget presents the supplied selection and accepts a requested change.\n",
    "utf8"
  );
  await writeFile(
    path.join(controlPath, "success.md"),
    "# Control success\n\nThe control exposes every supplied selection option.\n",
    "utf8"
  );

  const controlManifestPath = path.join(controlPath, "seedspec.yaml");
  const controlManifest = parseYaml(await readFile(controlManifestPath, "utf8"));
  controlManifest.description = "A control for choosing from supplied selection options.";
  await writeFile(controlManifestPath, stringifyYaml(controlManifest), "utf8");
  const control = await validatePackage(controlPath);
  await mkdir(path.join(widgetPath, "integrations"), { recursive: true });
  await writeFile(
    path.join(widgetPath, "integrations/control.md"),
    "# Widget to control\n\nThe widget owns selection state. The control emits a requested selection change.\n",
    "utf8"
  );
  const widgetManifestPath = path.join(widgetPath, "seedspec.yaml");
  const widgetManifest = parseYaml(await readFile(widgetManifestPath, "utf8"));
  widgetManifest.description = "A shared widget for presenting household events.";
  widgetManifest.components.integration = "integrations/";
  widgetManifest.composition = {
    includes: [{
      id: "selection-control",
      path: "bundled/control",
      package: control.manifest.id,
      version: control.manifest.version,
      digest: control.digest,
      integration: "integrations/control.md"
    }]
  };
  await writeFile(widgetManifestPath, stringifyYaml(widgetManifest), "utf8");
  const widget = await validatePackage(widgetPath);

  await mkdir(path.join(parentPath, "integrations"), { recursive: true });
  await writeFile(
    path.join(parentPath, "integrations/widget.md"),
    "# Family hub to widget\n\nThe family hub supplies household events. The widget presents them without owning the household record.\n",
    "utf8"
  );
  const parentManifestPath = path.join(parentPath, "seedspec.yaml");
  const parentManifest = parseYaml(await readFile(parentManifestPath, "utf8"));
  parentManifest.description = "A family hub that presents household events through a shared widget.";
  parentManifest.components.integration = "integrations/";
  parentManifest.composition = {
    includes: [{
      id: "shared-widget",
      path: "bundled/widget",
      package: widget.manifest.id,
      version: widget.manifest.version,
      digest: widget.digest,
      integration: "integrations/widget.md"
    }]
  };
  await writeFile(parentManifestPath, stringifyYaml(parentManifest), "utf8");

  return {
    output,
    parentPath,
    parentManifestPath,
    widget,
    control
  };
}

test("representative protocol fixtures validate", async () => {
  const application = await validatePackage(allowance);
  const feature = await validatePackage(savings);
  const streakFeature = await validatePackage(streaks);

  assert.equal(application.manifest.kind, "application");
  assert.equal(feature.manifest.kind, "feature");
  assert.equal(streakFeature.manifest.kind, "feature");
  assert.ok(application.manifest.provides.capabilities.some(
    (capability) => capability.id === "org.seedspec.core.balances"
  ));
  assert.deepEqual(
    feature.manifest.requires.capabilities.map((capability) => capability.id),
    [
      "org.seedspec.core.actors",
      "org.seedspec.core.balances",
      "org.seedspec.core.transactions"
    ]
  );
  assert.equal(application.manifest.artifacts[0].type, "org.example.artifact.reference-markdown");
  assert.equal(application.manifest.definition.module, "primary-intent");
  assert.equal(application.manifest.context.modules[0].source.path, "intent/allowance-tracker.md");
  assert.deepEqual(
    application.taskRunbook.tasks.map((task) => task.id),
    ["inspect-current-state", "review-author-context", "realize-package", "verify-realization"]
  );
});

test("kind is a tooling hint rather than a composition gate", async (t) => {
  const output = await temporaryDirectory(t);
  const featureAsRoot = await resolveProject(savings, { outputDirectory: output });
  const workflow = await validatePackage(hubspotMetric);
  const customKindPath = path.join(output, "custom-kind");
  await cp(allowance, customKindPath, { recursive: true });
  const manifestPath = path.join(customKindPath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.kind = "com.example.kind.agent";
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  const customKind = await validatePackage(customKindPath);

  assert.equal(featureAsRoot.lock.root.kind, "feature");
  assert.equal(workflow.manifest.kind, "workflow");
  assert.equal(customKind.manifest.kind, "com.example.kind.agent");
});

test("configuration schemas with explosive regex patterns are rejected deterministically", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "explosive-pattern");
  await cp(allowance, packagePath, { recursive: true });
  const schemaPath = path.join(packagePath, "configuration", "schema.json");
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  schema.properties.pattern_probe = { type: "string", pattern: "^(a+)+$" };
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8");

  await assert.rejects(
    validatePackage(packagePath),
    (error) => error.code === "INVALID_CONFIGURATION_SCHEMA"
      && error.details.some((detail) => /unanchored repetition/u.test(detail))
  );
});

test("common anchored repetition patterns in configuration schemas remain valid", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "anchored-pattern");
  await cp(allowance, packagePath, { recursive: true });
  const schemaPath = path.join(packagePath, "configuration", "schema.json");
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  schema.properties.pattern_probe = {
    type: "string",
    pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*(?:\\.[a-z0-9][a-z0-9-]*){2,}$"
  };
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8");

  const validated = await validatePackage(packagePath);
  assert.equal(validated.manifest.id, "org.seedspec.fixtures.comprehensive-application");
});

test("bundled composition resolves recursively and preserves every integration seam", async (t) => {
  const fixture = await createNestedCompositionPackage(t);
  const parent = await validatePackage(fixture.parentPath);
  assert.equal(parent.composition.includes[0].record.manifest.id, fixture.widget.manifest.id);
  assert.equal(
    parent.composition.includes[0].record.composition.includes[0].record.manifest.id,
    fixture.control.manifest.id
  );

  const inspection = await inspectPackage(fixture.parentPath);
  assert.equal(inspection.composition[0].id, "shared-widget");
  assert.equal(inspection.composition[1].id, "selection-control");
  const beginning = await beginPackage(fixture.parentPath);
  assert.equal(beginning.composition.length, 2);
  assert.ok(beginning.notices.some(
    (notice) => notice.code === "BUNDLED_COMPOSITION_REQUIRES_REVIEW"
  ));

  const projectOutput = path.join(fixture.output, "resolved");
  const result = await resolveProject(fixture.parentPath, {
    outputDirectory: projectOutput
  });
  assert.deepEqual(
    new Set(result.additions),
    new Set([fixture.widget.manifest.id, fixture.control.manifest.id])
  );
  assert.equal(result.project.composition.length, 2);

  const parentEdge = result.project.composition.find((edge) => edge.id === "shared-widget");
  const nestedEdge = result.project.composition.find((edge) => edge.id === "selection-control");
  assert.equal(parentEdge.parent.id, parent.manifest.id);
  assert.equal(parentEdge.child.id, fixture.widget.manifest.id);
  assert.equal(
    await readFile(path.join(result.workspace, parentEdge.integration.resolved_path), "utf8"),
    "# Family hub to widget\n\nThe family hub supplies household events. The widget presents them without owning the household record.\n"
  );
  assert.equal(nestedEdge.parent.id, fixture.widget.manifest.id);
  assert.equal(nestedEdge.child.id, fixture.control.manifest.id);

  const validateProject = await compileProtocolSchema("project.schema.json");
  assert.equal(
    validateProject(result.project),
    true,
    formatSchemaErrors(validateProject.errors).join("\n")
  );
  const guide = await readFile(path.join(result.workspace, "agent-guide.md"), "utf8");
  assert.match(guide, /Bundled composition seams/);
  assert.match(guide, /components\/org\.example\.family-hub\/integration\/widget\.md/);
  const lockVerification = await verifyProjectLock(projectOutput, [fixture.parentPath]);
  assert.deepEqual(
    new Set(lockVerification.verifiedPackages),
    new Set([
      parent.manifest.id,
      fixture.widget.manifest.id,
      fixture.control.manifest.id
    ])
  );

  const authoring = await auditPackage(fixture.parentPath, {
    area: "supporting-material",
    target: "compose",
    stateDirectory: path.join(fixture.output, "authoring"),
    toolVersion: "0.2.3-test"
  });
  assert.match(authoring.current.instructions, /responsibility boundaries, concept mapping, state ownership/);
  assert.match(authoring.current.instructions, /prompts, not required headings/);
  assert.match(authoring.current.instructions, /shared-widget/);
  assert.match(authoring.current.instructions, /selection-control/);
  assert.match(formatAuthoringGuidance("composition"), /Delete unused sections/);

  const packed = await packPackage(fixture.parentPath, {
    outputDirectory: path.join(fixture.output, "release"),
    stateDirectory: path.join(fixture.output, "pack-authoring"),
    toolVersion: "0.2.3-test"
  });
  const archive = await execFileAsync("tar", ["-tzf", packed.paths.archive]);
  assert.match(
    archive.stdout,
    /package\/bundled\/widget\/bundled\/control\/seedspec\.yaml/
  );

  const manifest = parseYaml(await readFile(fixture.parentManifestPath, "utf8"));
  manifest.composition.includes[0].digest = `sha256:${"0".repeat(64)}`;
  await writeFile(fixture.parentManifestPath, stringifyYaml(manifest), "utf8");
  await assert.rejects(
    validatePackage(fixture.parentPath),
    (error) => error.code === "COMPOSITION_IDENTITY_MISMATCH"
  );
});

test("source-bound linting separates protocol validity from authored-content feedback", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "integration-lint");
  await cp(allowance, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.kind = "integration";
  manifest.implementation_profiles = [{
    id: "nextjs-service",
    name: "Next.js service",
    description: "Use a separately hosted integration service.",
    prerequisites: [{
      id: "approved-hosting",
      statement: "Do you approve the hosting environment?",
      verification: {
        method: "user-confirmation",
        evidence: "optional"
      }
    }]
  }];
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  await writeFile(
    path.join(
      packagePath,
      manifest.context.modules.find((module) => module.id === manifest.definition.module).source.path
    ),
    "# Integration\n\nBuild a Next.js page and route for the customer interface.\n",
    "utf8"
  );

  const lint = await lintPackage(packagePath);
  const codes = lint.diagnostics.map((item) => item.code);

  assert.equal(lint.protocol_valid, true);
  assert.equal(lint.package.kind, "integration");
  assert.ok(codes.includes("CORE_INTENT_MAY_CONTAIN_IMPLEMENTATION_DETAIL"));
  assert.ok(codes.includes("KIND_SCOPE_MAY_INCLUDE_APPLICATION_UI"));
  assert.ok(codes.includes("PROFILE_CONDITION_IS_QUESTION"));
  assert.ok(!codes.includes("KIND_RECOMMENDED_CONCEPT_MISSING"));
});

test("a sparse seed does not acquire invented domain gaps and separate success is the readiness floor", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "ice-cream");
  await initPackage("application", packagePath);
  await writeFile(
    path.join(packagePath, "seed.md"),
    "# Ice cream shop\n\nCreate a friendly website where people can browse ice cream and place an order.\n",
    "utf8"
  );
  await writeFile(
    path.join(packagePath, "success.md"),
    "# Success\n\nA visitor can browse available ice cream, place an order, and see a confirmation.\n",
    "utf8"
  );
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.description = "A friendly website for browsing ice cream and placing an order.";
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");

  const lint = await lintPackage(packagePath);
  assert.deepEqual(lint.diagnostics, []);
  assert.doesNotMatch(JSON.stringify(lint), /tax|refund|identity|retry|hosting|accessibility/iu);

  delete manifest.components;
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  const withoutSuccess = await lintPackage(packagePath);
  assert.ok(withoutSuccess.diagnostics.some(
    ({ code }) => code === "SUCCESS_MATERIAL_UNDECLARED"
  ));
  const publish = await publishCheckPackage(packagePath, {
    stateDirectory: path.join(output, "authoring"),
    toolVersion: "0.2.3-test"
  });
  assert.equal(publish.ready, false);
  assert.equal(publish.checks.find(({ id }) => id === "success-material").status, "failed");
});

test("starter intent and description remain visible until the author replaces them", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "seedspec");
  const stateDirectory = path.join(output, "authoring");
  await initPackage("workflow", packagePath);

  const lint = await lintPackage(packagePath);
  assert.ok(lint.diagnostics.some(({ code }) => code === "STARTER_INTENT_PLACEHOLDER"));
  assert.ok(lint.diagnostics.some(({ code }) => code === "STARTER_DESCRIPTION_PLACEHOLDER"));
  assert.ok(lint.diagnostics.some(({ code }) => code === "STARTER_IDENTITY_PLACEHOLDER"));
  const audit = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0-test"
  });
  assert.match(audit.current.instructions, /unfilled starter scaffold/u);
  assert.match(audit.current.instructions, /author's current conversation as the supplied seed/u);
  assert.match(audit.current.instructions, /descriptive name, package ID, and concise description/u);
  assert.match(audit.current.instructions, /Copy question, candidate, and proposal IDs exactly/u);
  assert.match(
    audit.current.instructions,
    /author's current messages, current package, and active workspace/u
  );
  assert.match(audit.current.instructions, /Never ask the author to reconfirm meaning/u);
  const publish = await publishCheckPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0-test"
  });
  assert.equal(publish.ready, false);
  assert.equal(publish.checks.find(({ id }) => id === "starter-content").status, "failed");
});

test("a fresh agent receives settled author meaning before it asks another question", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "seedspec");
  const stateDirectory = path.join(output, "authoring");
  await initPackage("workflow", packagePath);
  await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0-test"
  });
  const recorded = await recordObservations(packagePath, {
    stateRoot: stateDirectory,
    entries: [{
      type: "question",
      question: "Should this remain a lightweight personal maintenance reminder?"
    }]
  });
  await answerQuestion(packagePath, {
    stateRoot: stateDirectory,
    questionId: recorded.recorded[0].id,
    answer: "Yes. Record recurring home-maintenance tasks and show what is due next."
  });

  const resumed = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0-test"
  });
  assert.match(resumed.current.instructions, /## Session continuity/u);
  assert.match(resumed.current.instructions, /Should this remain a lightweight personal maintenance reminder/u);
  assert.match(resumed.current.instructions, /Record recurring home-maintenance tasks and show what is due next/u);
  assert.match(resumed.current.instructions, /Never ask the author to repeat or reconfirm settled meaning/u);
  assert.match(resumed.current.instructions, /confirmed direction authorizes you to draft an exact proposal/u);
  assert.match(resumed.current.instructions, /do not ask separately whether the author wants the scaffold replaced/u);
  assert.match(resumed.current.instructions, /create exact starter-replacement proposals without another question/u);
  assert.match(resumed.current.instructions, /An answered question records author authority, not package content/u);
  assert.match(resumed.current.instructions, /Confirmed meaning absent from package documents requires an exact proposal/u);
});

test("authoring review is source-bound and advances after an author disposition", async (t) => {
  const output = await temporaryDirectory(t);
  const stateDirectory = path.join(output, "authoring-state");
  const first = await auditPackage(allowance, {
    stateDirectory,
    target: "harden",
    toolVersion: "0.1.0-test"
  });

  assert.equal(first.current.id, "0001-seed");
  assert.equal(first.result_format, AUTHORING_RESULT_FORMAT);
  assert.equal(first.current.area, "seed");
  assert.equal(first.areas.length, AUTHORING_AREAS.length);
  assert.equal(first.instruction_format, AUTHORING_INSTRUCTION_FORMAT);
  assert.match(first.current.instructions, /useful starting seed/);
  assert.match(first.current.instructions, /Absence is not a gap/);
  assert.match(first.current.instructions, /restriction on what may become a finding; it is not an instruction to search/);
  assert.match(first.current.instructions, /Save cross-document inconsistency, stale counts/);
  assert.match(first.current.instructions, /Every factual claim must come from the active authored material/);
  assert.match(first.current.instructions, /When the direction is not confirmed, write one or two plain sentences reflecting it/);
  assert.match(first.current.instructions, /Active attached sources: none/);
  assert.match(first.current.instructions, /After recording a reviewed disposition, rerun `npx @seedspec\/cli author review`/u);

  // The brief states response length exactly once. Two competing caps made the
  // agent hedge, and a rule repeated four times made responses evasive.
  const lengthRules = first.current.instructions.match(/plain sentences/g) ?? [];
  assert.equal(lengthRules.length, 1, "response length must be stated once");
  const prohibitions = first.current.instructions.match(/Do not |Never |must not/g) ?? [];
  assert.ok(
    prohibitions.length <= 10,
    `brief carries ${prohibitions.length} prohibitions; keep it at or under 10`
  );

  // Depth is served on request rather than embedded up front, because stacked
  // guidance measurably reduced coverage while multiplying cost.
  assert.match(first.current.instructions, /npx @seedspec\/cli author guidance --topic review-model/);
  assert.match(
    first.current.instructions,
    /detailed approved requirements, source precedence, or unresolved author-owned choices/u
  );
  assert.doesNotMatch(first.current.instructions, /## Internal review model/);
  assert.match(formatAuthoringGuidance("review-model"), /Coherence/);
  assert.match(formatAuthoringGuidance("source-boundary"), /Absence alone is not a gap/);
  const requirementsGuidance = formatAuthoringGuidance("requirements");
  assert.match(requirementsGuidance, /Treat unapproved or informational material as evidence only/u);
  assert.match(requirementsGuidance, /attachment alone does not place their bytes in the distributable package/u);
  assert.match(requirementsGuidance, /fresh planning agent/u);
  assert.match(requirementsGuidance, /declare that document as a context module/u);
  assert.match(requirementsGuidance, /explicitly unresolved choice marked author-owned or non-delegable/u);
  assert.match(requirementsGuidance, /Do not close the applicable review thread/u);
  assert.match(requirementsGuidance, /reuse its candidate ID for coordinated later proposals/u);
  assert.match(requirementsGuidance, /at least one applied document that anchors the meaning remains unchanged/u);
  assert.match(requirementsGuidance, /Expansion proposes optional new meaning/u);
  assert.match(requirementsGuidance, /Contraction proposes removal or generalization/u);
  assert.throws(
    () => formatAuthoringGuidance("nope"),
    (error) => error.code === "UNKNOWN_AUTHORING_GUIDANCE"
  );
  assert.doesNotMatch(first.current.instructions, /Current source documentation|github\.com\/SeedSpec\/seedspec\/blob/);
  assert.match(formatAuthoringAudit(first), /^# SeedSpec authoring agent operating brief/m);
  assert.doesNotMatch(formatAuthoringAudit(first), /Internal review progress:/);
  assert.match(formatAuthoringAudit(first, { statusOnly: true }), /1\. The seed — in-progress/);
  assert.match(formatAuthoringAudit(first, { statusOnly: true }), /Next private focus after review: Coherence/);
  assert.match(
    formatAuthoringAudit(first, { summary: true }),
    /Review progress: 0 of 4 areas reviewed/
  );
  assert.doesNotMatch(formatAuthoringAudit(first, { summary: true }), /## Area objective/);

  const result = parseYaml(await readFile(first.current.result, "utf8"));
  result.outcome = "reviewed";
  result.disposition = "good-enough";
  result.summary = "The author reviewed the supplied seed and accepted its current depth.";
  result.package_digest_after = first.package.digest;
  result.validation.commands = [
    "seedspec validate <package-path>",
    "seedspec lint <package-path>",
    "seedspec digest <package-path>"
  ];
  await writeFile(first.current.result, stringifyYaml(result), "utf8");

  const second = await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.1.0-test"
  });
  assert.equal(second.current.id, "0002-coherence");
  assert.equal(second.areas[0].status, "reviewed");
  assert.equal(second.areas[1].status, "in-progress");

  const status = await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.1.0-test",
    statusOnly: true
  });
  assert.equal(status.current.id, second.current.id);
  assert.match(formatAuthoringAudit(status, { statusOnly: true }), /Run `npx @seedspec\/cli author review`/);
});

test("authoring review supports source-bound targeted areas and keeps state outside the package", async (t) => {
  const output = await temporaryDirectory(t);
  const targeted = await auditPackage(hubspotMetric, {
    area: "coherence",
    stateDirectory: path.join(output, "hubspot-authoring"),
    toolVersion: "0.1.0-test"
  });
  assert.equal(targeted.current.id, "0001-coherence");
  assert.match(targeted.current.instructions, /two cited authored claims/);
  assert.match(targeted.current.instructions, /Do not infer gaps from topics the package never introduces/);
  assert.match(targeted.current.instructions, /ask whether the author wants to address it before drafting replacement wording/);
  assert.match(formatAuthoringDocumentation("coherence"), /Coherence objective/);

  const support = await auditPackage(allowance, {
    area: "supporting-material",
    stateDirectory: path.join(output, "allowance-support"),
    toolVersion: "0.1.0-test"
  });
  assert.match(support.current.instructions, /The absence of any optional item is valid/);
  assert.match(support.current.instructions, /Configuration is deliberate authored variation/);
  assert.match(formatAuthoringDocumentation("supporting-material"), /Configuration and supporting material objective/);

  await assert.rejects(
    auditPackage(allowance, {
      stateDirectory: path.join(allowance, ".seedspec-authoring"),
      toolVersion: "0.1.0-test"
    }),
    (error) => error.code === "AUTHORING_STATE_INSIDE_PACKAGE"
  );
});

test("authoring exposes declared supporting material and fixes context module bodies", async (t) => {
  const output = await temporaryDirectory(t);
  const resourceAudit = await auditPackage(resourcesFixture, {
    area: "supporting-material",
    stateDirectory: path.join(output, "resource-authoring"),
    toolVersion: "0.18.0-test"
  });
  assert.match(resourceAudit.current.instructions, /Existing non-primary context modules are fixed inputs to this authoring cycle/u);
  assert.match(resourceAudit.current.instructions, /Other implementation resources, profiles, tasks, artifacts, reference material, and evidence are visible authored package material/u);
  assert.match(resourceAudit.current.instructions, /Declared implementation-resource policy: `agent-delegated`/u);
  assert.match(resourceAudit.current.instructions, /Declared implementation resources \(1; preserve by default; never auto-activate\)/u);
  assert.match(resourceAudit.current.instructions, /`org\.example\.guidance\.authorization` \(skill; available; 0\.1\.0; exact\)/u);
  assert.match(resourceAudit.current.instructions, /bundled at `guidance\/authorization\/`@0\.1\.0, digest-bound/u);
  assert.match(resourceAudit.current.instructions, /Treat every existing non-primary context-module body as a fixed input/u);
  assert.match(resourceAudit.current.instructions, /Preserve other existing supporting bodies and declarations byte-for-byte by default/u);
  assert.match(resourceAudit.current.instructions, /Do not perform a general quality audit of a skill, evaluation, context module, artifact, or reference implementation/u);
  assert.match(resourceAudit.current.instructions, /Do not open every supporting body by default/u);
  assert.match(resourceAudit.current.instructions, /For supporting material other than fixed context modules, propose a body edit only when the author explicitly asks/u);
  assert.match(resourceAudit.current.instructions, /changing their bytes without a matching declaration update breaks validation/u);
  assert.match(resourceAudit.current.instructions, /Never install or invoke a package-scoped skill, execute a tool or evaluation, fetch a remote resource/u);

  const contextAudit = await auditPackage(contextModulesFixture, {
    area: "supporting-material",
    stateDirectory: path.join(output, "context-authoring"),
    toolVersion: "0.18.0-test"
  });
  assert.match(contextAudit.current.instructions, /Declared context modules \(3; visible package context\)/u);
  assert.match(contextAudit.current.instructions, /`primary-intent` \(org\.seedspec\.intent\.markdown; primary intent\)/u);
  assert.match(contextAudit.current.instructions, /`refund-safety` \(org\.example\.context\.behavior@1\.0\.0; supporting; fixed input; read-only in authoring\)/u);
  assert.match(contextAudit.current.instructions, /bridges `review-behavior`/u);
  assert.match(contextAudit.current.instructions, /`review-behavior` \(io\.agentskills\.skill; supporting; fixed input; read-only in authoring\)/u);

  const artifactAudit = await auditPackage(allowance, {
    area: "supporting-material",
    stateDirectory: path.join(output, "artifact-authoring"),
    toolVersion: "0.18.0-test"
  });
  assert.match(artifactAudit.current.instructions, /Declared task runbook: `tasks\.yaml` \(preserve by default\)/u);
  assert.match(artifactAudit.current.instructions, /Declared passive artifacts \(1; preserve by default; never auto-activate\)/u);
  assert.match(artifactAudit.current.instructions, /`chore-reference` \(org\.example\.artifact\.reference-markdown; path `reference\/capabilities\/chores-1\.0\.0\.md`\)/u);
});

test("reviewed authoring areas accept pinned npm CLI commands", async (t) => {
  const output = await temporaryDirectory(t);
  const stateDirectory = path.join(output, "authoring-state");
  const audit = await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.1.0-test"
  });
  const result = parseYaml(await readFile(audit.current.result, "utf8"));
  result.outcome = "reviewed";
  result.disposition = "good-enough";
  result.summary = "Validated through the exact npm CLI package.";
  result.validation.commands = [
    "npx --yes @seedspec/cli@0.2.0 validate package",
    "npx --yes @seedspec/cli@0.2.0 lint package",
    "npx --yes @seedspec/cli@0.2.0 digest package"
  ];
  await writeFile(audit.current.result, stringifyYaml(result), "utf8");

  const advanced = await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.1.0-test"
  });
  assert.equal(advanced.current.area, "coherence");
});

test("an active source-bound pass receives the latest conversation and record brief without a reset", async (t) => {
  const output = await temporaryDirectory(t);
  const stateDirectory = path.join(output, "authoring-state");
  const first = await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.3.0-test"
  });
  const requestPath = path.join(first.current.root, "request.yaml");
  const instructionsPath = path.join(first.current.root, "instructions.md");
  const request = parseYaml(await readFile(requestPath, "utf8"));
  request.authoring_instruction_version = "0.4";
  await writeFile(requestPath, stringifyYaml(request), "utf8");
  await writeFile(instructionsPath, "# Older source-bound instructions\n", "utf8");
  const resultPath = first.current.result;
  const result = parseYaml(await readFile(resultPath, "utf8"));
  result.outcome = "needs-author";
  result.summary = "Reflected the seed and asked the author to confirm it.";
  result.inventory.push({
    path: "definition/solution.md",
    note: "Primary intent"
  });
  result.questions.asked.push("Is this still the intended direction?");
  await writeFile(resultPath, stringifyYaml(result), "utf8");

  const status = await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.4.0-test",
    statusOnly: true
  });
  assert.equal(
    parseYaml(await readFile(requestPath, "utf8")).authoring_instruction_version,
    "0.4"
  );
  assert.match(status.current.instructions, /Older source-bound instructions/);

  const refreshed = await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.4.0-test"
  });
  assert.equal(
    parseYaml(await readFile(requestPath, "utf8")).authoring_instruction_version,
    AUTHORING_INSTRUCTION_FORMAT
  );
  assert.match(refreshed.current.instructions, /How to talk to the author/);
  assert.match(refreshed.current.instructions, /record terms/);
  assert.match(refreshed.current.instructions, /substance for a future co-author, not a transcript/);
  assert.match(refreshed.current.instructions, /states the product direction, clarification, or authored choice/);
  assert.match(refreshed.current.instructions, /npx @seedspec\/cli author schema result/);

  // The record section hands the agent runnable commands against the real
  // package path, rather than an unpublished YAML contract it has to guess at.
  for (const operation of ["record", "answer", "attach-source", "reviewed"]) {
    assert.ok(
      refreshed.current.instructions.includes(
        `npx @seedspec/cli author ${operation} '${allowance}' --json - <<'SEEDSPEC_JSON_${operation.replaceAll("-", "_").toUpperCase()}'`
      ),
      `${operation} must be offered as a shell-safe runnable command`
    );
  }
  assert.doesNotMatch(refreshed.current.instructions, /<package-path>/);
  const preserved = parseYaml(await readFile(resultPath, "utf8"));
  assert.equal(preserved.outcome, "needs-author");
  assert.equal(
    preserved.summary,
    "Reflected the seed and asked the author to confirm it."
  );
  assert.equal(preserved.inventory[0].note, "Primary intent");
  assert.equal(
    preserved.questions.asked[0],
    "Is this still the intended direction?"
  );
});

test("the authoring starter prompt selects shape, deep, and minimal postures", () => {
  const prompt = formatAuthoringStarterPrompt();
  assert.match(prompt, /idea to shape/iu);
  assert.match(prompt, /practical first specification/iu);
  assert.match(prompt, /deeper discovery pass/iu);
  assert.match(prompt, /one consequential product question at a time/iu);
  assert.match(prompt, /native single-choice question tool/iu);
  assert.match(prompt, /practical shaping first/iu);
  assert.match(prompt, /--target shape/u);

  const deep = formatAuthoringStarterPrompt({ mode: "deep" });
  assert.match(deep, /every consequential aspect/iu);
  assert.match(deep, /decision tree in dependency order/iu);
  assert.match(deep, /recommended answer/iu);
  assert.match(deep, /one question at a time/iu);
  assert.match(deep, /--target deep/u);

  const minimal = formatAuthoringStarterPrompt({ mode: "minimal" });
  assert.match(minimal, /authoring boundary/iu);
  assert.match(minimal, /Do not brainstorm/u);
  assert.match(minimal, /--target minimal/u);

  const explore = formatAuthoringStarterPrompt({ explore: true });
  assert.equal(explore, prompt);
});

test("authoring briefs persist kind-aware shape, deep, and minimal guidance", async (t) => {
  const output = await temporaryDirectory(t);
  const shape = await auditPackage(allowance, {
    stateDirectory: path.join(output, "shape"),
    target: "shape",
    toolVersion: "0.17.0-test"
  });
  assert.equal(shape.target, "shape");
  assert.match(shape.current.instructions, /Exploration posture: `shape`/u);
  assert.match(shape.current.instructions, /application lens/u);
  assert.match(shape.current.instructions, /materially different products/u);
  assert.match(shape.current.instructions, /roadmap or vision/u);
  assert.match(shape.current.instructions, /product behavior.*technical architecture/isu);
  assert.match(shape.current.instructions, /native single-choice question tool/iu);
  assert.match(shape.current.instructions, /numbered Markdown options/iu);
  assert.match(shape.current.instructions, /label it `\(Recommended\)`/u);
  assert.match(shape.current.instructions, /free-form or discuss path/iu);
  assert.match(shape.current.instructions, /Include completeness scores.*only when/isu);

  const deep = await auditPackage(allowance, {
    stateDirectory: path.join(output, "deep"),
    target: "deep",
    toolVersion: "0.17.0-test"
  });
  assert.equal(deep.target, "deep");
  assert.match(deep.current.instructions, /decision tree/u);
  assert.match(deep.current.instructions, /recommended answer/u);
  assert.match(deep.current.instructions, /Do not formulate document proposals until/u);

  const minimal = await auditPackage(allowance, {
    stateDirectory: path.join(output, "minimal"),
    target: "minimal",
    toolVersion: "0.17.0-test"
  });
  assert.equal(minimal.target, "minimal");
  assert.match(minimal.current.instructions, /Treat the supplied material as the authoring boundary/u);
  assert.match(minimal.current.instructions, /Do not brainstorm/u);
  assert.doesNotMatch(minimal.current.instructions, /selected exploration posture is explicit authorization/u);
});

test("authoring audit status is read-only and accepts portable workspace paths", async (t) => {
  const output = await temporaryDirectory(t);
  const missingState = path.join(output, "missing-state");
  const emptyStatus = await auditPackage(allowance, {
    stateDirectory: missingState,
    toolVersion: "0.1.0-test",
    statusOnly: true
  });
  assert.equal(emptyStatus.passes.length, 0);
  assert.match(formatAuthoringAudit(emptyStatus, { statusOnly: true }), /No guided review exists/);
  await assert.rejects(access(missingState), { code: "ENOENT" });

  const stateDirectory = path.join(output, "reviews", "allowance");
  await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.1.0-test"
  });
  const workspacePath = path.join(stateDirectory, "workspace.yaml");
  const workspace = parseYaml(await readFile(workspacePath, "utf8"));
  assert.equal(path.isAbsolute(workspace.package.path), false);
  const before = await readFile(workspacePath, "utf8");
  await auditPackage(allowance, {
    stateDirectory,
    toolVersion: "0.1.0-test",
    statusOnly: true
  });
  assert.equal(await readFile(workspacePath, "utf8"), before);
});

test("authoring workspace snapshots are path-independent and survive invalid drafts", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "draft-package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  const audit = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0-test"
  });
  const questionPath = path.join(stateDirectory, "open-questions.yaml");
  const questionState = parseYaml(await readFile(questionPath, "utf8"));
  questionState.questions.push({
    id: "local-source",
    source: `${packagePath}/definition/feature.md`,
    question: "Should this source remain local?",
    status: "open"
  });
  await writeFile(questionPath, stringifyYaml(questionState), "utf8");

  const first = await inspectAuthoringWorkspace(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0-test"
  });
  assert.equal(first.authoring_workspace_snapshot_version, AUTHORING_WORKSPACE_SNAPSHOT_FORMAT);
  assert.match(first.workspace.id, /^[0-9a-f]{8}-[0-9a-f-]{27}$/u);
  assert.match(first.workspace.revision, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(first.package.status, "valid");
  assert.equal(first.package.digest, audit.package.digest);
  assert.equal(first.review.current.id, "0001-seed");
  assert.equal(first.review.questions.items[0].source, "<package>/definition/feature.md");
  assert.ok(first.documents.some((document) => document.path === "seedspec.yaml"));
  assert.doesNotMatch(JSON.stringify(first), new RegExp(output.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));

  const repeated = await inspectAuthoringWorkspace(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0-test"
  });
  assert.equal(repeated.workspace.revision, first.workspace.revision);
  assert.equal(repeated.workspace.id, first.workspace.id);

  await writeFile(path.join(packagePath, "seedspec.yaml"), "protocol_version: [\n", "utf8");
  const invalid = await inspectAuthoringWorkspace(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0-test"
  });
  assert.equal(invalid.package.status, "invalid");
  assert.equal(invalid.package.digest, null);
  assert.notEqual(invalid.workspace.revision, first.workspace.revision);
  assert.equal(invalid.workspace.id, first.workspace.id);
  assert.equal(invalid.review.current.id, first.review.current.id);
  assert.ok(invalid.package.diagnostics.some((diagnostic) => diagnostic.code === "INVALID_YAML"));
  assert.ok(invalid.documents.some((document) => document.path === "seedspec.yaml"));
  assert.doesNotMatch(JSON.stringify(invalid), new RegExp(output.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
});

test("authoring workspaces can begin before a valid package exists", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "empty-draft");
  const stateDirectory = path.join(output, "authoring-state");
  const created = await createAuthoringWorkspace(packagePath, {
    stateDirectory,
    target: "minimal",
    toolVersion: "0.2.0-test"
  });

  assert.equal(created.authoring_workspace_operation_version, AUTHORING_WORKSPACE_OPERATION_FORMAT);
  assert.equal(created.operation, "create");
  assert.equal(created.created, true);
  assert.match(created.snapshot.workspace.id, /^[0-9a-f]{8}-[0-9a-f-]{27}$/u);
  assert.equal(created.snapshot.package.status, "invalid");
  assert.equal(created.snapshot.documents.length, 0);
  assert.equal(created.snapshot.review.status, "available");
  assert.equal(created.snapshot.review.target, "minimal");

  const repeated = await createAuthoringWorkspace(packagePath, {
    stateDirectory,
    target: "package",
    toolVersion: "0.2.0-test"
  });
  assert.equal(repeated.created, false);
  assert.equal(repeated.snapshot.workspace.id, created.snapshot.workspace.id);
  assert.equal(repeated.snapshot.workspace.revision, created.snapshot.workspace.revision);
  assert.equal(repeated.snapshot.review.target, "minimal");

  await initPackage("application", packagePath);
  const audit = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0-test"
  });
  const shaped = await inspectAuthoringWorkspace(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0-test"
  });
  assert.equal(shaped.workspace.id, created.snapshot.workspace.id);
  assert.equal(shaped.package.status, "valid");
  assert.equal(shaped.review.current.id, audit.current.id);
});

test("authoring workspace discovery follows conventional layouts from nested directories", async (t) => {
  const output = await temporaryDirectory(t);
  const projectRoot = path.join(output, "authoring-project");
  const packagePath = path.join(projectRoot, "seedspec");
  const stateDirectory = path.join(projectRoot, "authoring");
  await cp(savings, packagePath, { recursive: true });

  const beforeState = await discoverAuthoringWorkspace(
    path.join(packagePath, "definition")
  );
  assert.equal(beforeState.packageRoot, packagePath);
  assert.equal(beforeState.stateRoot, stateDirectory);
  assert.equal(beforeState.stateExists, false);

  await createAuthoringWorkspace(packagePath, {
    stateDirectory,
    toolVersion: "0.2.1-test"
  });
  const discovered = await discoverAuthoringWorkspace(
    path.join(packagePath, "definition")
  );
  assert.equal(discovered.packageRoot, packagePath);
  assert.equal(discovered.stateRoot, stateDirectory);
  assert.equal(discovered.stateExists, true);
});

test("authoring status reports progress between reviewed areas", () => {
  const text = formatAuthoringWorkspaceSnapshot({
    workspace: {},
    package: {
      id: "org.example.authoring",
      version: "0.1.0",
      status: "valid",
      diagnostics: []
    },
    documents: [{ path: "seedspec.yaml" }],
    review: {
      questions: { open: 0, resolved: 0 },
      current: null,
      complete: false,
      passes: [{ id: "0001", area: "seed", outcome: "reviewed" }],
      areas: [
        { index: 1, id: "seed", status: "reviewed" },
        { index: 2, id: "coherence", status: "not-audited" }
      ],
      diagnostics: []
    }
  });

  assert.match(text, /Review: 1 of 2 reviewed/u);
  assert.match(text, /Next review: coherence/u);
  assert.doesNotMatch(text, /Review: not started/u);
});

test("implementation profiles require user choice when ambiguous and preserve profile state", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [hubspotMetric]
  );
  const appliedIntentPath = await writeAffirmedAppliedIntent(output, [hubspotMetric]);
  const unresolved = await resolveProject(hubspotMetric, {
    configurationSelectionsPath,
    appliedIntentPath,
    outputDirectory: path.join(output, "unresolved")
  });
  const unresolvedGuide = await readFile(
    path.join(unresolved.workspace, "agent-guide.md"),
    "utf8"
  );
  const beginning = formatPackageBeginning(await beginPackage(hubspotMetric));

  assert.equal(unresolved.project.status, "needs-input");
  assert.equal(unresolved.project.implementation_profile_status, "review");
  assert.match(unresolvedGuide, /Do not choose silently/);
  assert.match(unresolvedGuide, /ask the end user which direction to prefer/);
  assert.match(beginning, /Guidance: `implementation\/hubspot-native\.md`/);
  assert.match(beginning, /`supports-native-operations`: The active HubSpot edition/);
  assert.match(beginning, /Minimizes separately operated infrastructure/);

  const preferred = await resolveProject(hubspotMetric, {
    configurationSelectionsPath,
    appliedIntentPath,
    implementationProfiles: ["hubspot-native"],
    outputDirectory: path.join(output, "preferred")
  });
  const packageState = preferred.implementationProfileState.packages[0];
  const preferredGuide = await readFile(
    path.join(preferred.workspace, "agent-guide.md"),
    "utf8"
  );

  assert.equal(preferred.project.status, "ready");
  assert.equal(preferred.project.implementation_profile_status, "recorded");
  assert.equal(packageState.selection, "preferred");
  assert.equal(packageState.preferred_profile, "hubspot-native");
  assert.ok(await readFile(
    path.join(preferred.workspace, packageState.profiles[0].guidance),
    "utf8"
  ));
  assert.match(preferredGuide, /strong implementation guidance/);
  assert.match(preferredGuide, /The organization uses HubSpot/);

  await assert.rejects(
    resolveProject(hubspotMetric, {
      implementationProfiles: ["missing-profile"],
      outputDirectory: path.join(output, "invalid")
    }),
    (error) => error.code === "INVALID_IMPLEMENTATION_PROFILE"
  );
});

test("capability revision differences request review without blocking handoff", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance, streaks]
  );
  const appliedIntentPath = await writeAffirmedAppliedIntent(output, [allowance, streaks]);
  const result = await resolveProject(allowance, {
    featurePaths: [streaks],
    configurationSelectionsPath,
    appliedIntentPath,
    outputDirectory: output
  });
  const binding = result.lock.requirements.find(
    (requirement) => requirement.capability === "org.seedspec.core.chores"
  );

  assert.equal(result.project.status, "ready");
  assert.equal(result.project.declaration_status, "review");
  assert.equal(binding.tested_against, "1.0.0");
  assert.equal(binding.providers[0].provided_version, "1.1.0");
  assert.equal(binding.providers[0].revision_status, "different-revision");
  assert.equal(binding.providers[0].revision_direction, "provider-newer");
  assert.equal(binding.providers[0].revision_difference, "minor");
  assert.equal(binding.providers[0].review_severity, "medium");
  assert.equal(binding.providers[0].change_evidence, "complete");
  assert.equal(binding.providers[0].declared_changes[0].changes[0].type, "additive");
  assert.deepEqual(binding.issues, ["revision-difference"]);
  assert.equal(binding.status, "review");
  assert.ok(result.lock.reviews.some(
    (review) => review.code === "revision-difference"
      && review.capability === "org.seedspec.core.chores"
      && review.severity === "medium"
      && review.revision.direction === "provider-newer"
      && review.revision.difference === "minor"
      && review.revision.declared_changes[0].changes[0].type === "additive"
  ));
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /Create an integration plan/
  );
});

test("capability revision classification preserves direction and semver severity", () => {
  assert.deepEqual(classifyCapabilityRevision("1.0.0", "1.0.0"), {
    revision_status: "tested-revision",
    revision_direction: "exact",
    revision_difference: "none",
    review_severity: "none"
  });
  assert.equal(classifyCapabilityRevision("1.0.0", "1.0.1").review_severity, "low");
  assert.equal(classifyCapabilityRevision("1.0.0", "1.1.0").review_severity, "medium");
  assert.equal(classifyCapabilityRevision("1.1.0", "1.0.0").review_severity, "high");
  assert.equal(classifyCapabilityRevision("1.0.0", "2.0.0").review_severity, "high");
});

test("capability conformance results bind exact contract, suite, checks, and realization evidence", async (t) => {
  const output = await temporaryDirectory(t);
  const record = await validatePackage(allowance);
  const binding = await capabilityConformanceBinding(record, "org.seedspec.core.chores");
  assert.equal(binding.checks.length, 2);
  assert.match(binding.contract_digest, /^sha256:[a-f0-9]{64}$/);
  assert.match(binding.suite_digest, /^sha256:[a-f0-9]{64}$/);

  const resultPath = path.join(output, "capability-conformance.yaml");
  const result = {
    protocol_version: "0.3",
    capability: binding.capability,
    contract_digest: binding.contract_digest,
    suite_digest: binding.suite_digest,
    realization: {
      reference: "https://example.test/builds/allowance-123",
      digest: `sha256:${"1".repeat(64)}`,
      environment: "isolated contract-test environment"
    },
    evaluator: {
      id: "org.seedspec.runner.reference",
      version: "0.1.0"
    },
    evaluated_at: "2026-07-22T15:00:00Z",
    status: "passed",
    checks: binding.checks.map((check) => ({
      id: check.id,
      result: "pass",
      evidence: [{
        source: "tool",
        reference: `results/${check.id}.json`
      }]
    }))
  };
  await writeFile(resultPath, stringifyYaml(result), "utf8");
  const inspected = await inspectCapabilityConformance(
    allowance,
    "org.seedspec.core.chores",
    resultPath
  );
  assert.equal(inspected.status, "passed");
  assert.equal(inspected.result.realization.reference, result.realization.reference);

  result.suite_digest = `sha256:${"2".repeat(64)}`;
  await writeFile(resultPath, stringifyYaml(result), "utf8");
  await assert.rejects(
    inspectCapabilityConformance(allowance, "org.seedspec.core.chores", resultPath),
    (error) => error.code === "STALE_CAPABILITY_CONFORMANCE_RESULT"
  );
});

test("capability revision histories and suites receive semantic validation", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "invalid-capability-contract");
  await cp(allowance, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  const chores = manifest.provides.capabilities.find(
    (capability) => capability.id === "org.seedspec.core.chores"
  );
  chores.change_history[0].changes[0].type = "breaking";
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  await assert.rejects(
    validatePackage(packagePath),
    (error) => error.code === "INVALID_MANIFEST_SEMANTICS"
  );

  chores.change_history[0].changes[0].type = "additive";
  const scenariosPath = path.join(
    packagePath,
    "capabilities/conformance/chores.scenarios.yaml"
  );
  const scenarios = parseYaml(await readFile(scenariosPath, "utf8"));
  scenarios.capability.version = "1.0.0";
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  await writeFile(scenariosPath, stringifyYaml(scenarios), "utf8");
  await assert.rejects(
    validatePackage(packagePath),
    (error) => error.code === "INVALID_CAPABILITY_CONFORMANCE"
  );
});

test("resolution preserves implementation notes and verification evidence", async (t) => {
  const output = await temporaryDirectory(t);
  const first = await resolveProject(allowance, { outputDirectory: output });
  const notesPath = path.join(first.workspace, "implementation-notes.md");
  const reportPath = path.join(first.workspace, "verification-report.md");
  await writeFile(notesPath, "# Local implementation notes\n\nKeep me.\n", "utf8");
  await writeFile(reportPath, "# Local verification\n\nEvidence stays.\n", "utf8");

  await resolveProject(allowance, { outputDirectory: output });
  assert.equal(await readFile(notesPath, "utf8"), "# Local implementation notes\n\nKeep me.\n");
  assert.equal(await readFile(reportPath, "utf8"), "# Local verification\n\nEvidence stays.\n");
});

test("resolution commits atomically and removes failed staging state", async (t) => {
  const output = await temporaryDirectory(t);
  const first = await resolveProject(allowance, { outputDirectory: output });
  const beforeFailure = await computeDirectoryDigest(first.workspace);

  await assert.rejects(
    resolveProject(allowance, {
      implementationProfiles: ["missing-profile"],
      outputDirectory: output
    }),
    (error) => error.code === "INVALID_IMPLEMENTATION_PROFILE"
  );

  assert.equal(await computeDirectoryDigest(first.workspace), beforeFailure);
  assert.deepEqual(
    (await readdir(output)).filter((name) => name.startsWith(".seedspec-transaction-")),
    []
  );

  const emptyOutput = path.join(output, "no-previous-workspace");
  await assert.rejects(
    resolveProject(allowance, {
      implementationProfiles: ["missing-profile"],
      outputDirectory: emptyOutput
    }),
    (error) => error.code === "INVALID_IMPLEMENTATION_PROFILE"
  );
  await assert.rejects(access(path.join(emptyOutput, ".seedspec")));
});

test("kind-specific manifest schemas accept their matching examples", async () => {
  const application = await validatePackage(allowance);
  const feature = await validatePackage(savings);
  const component = await validatePackage(path.join(
    root,
    "conformance/fixtures/bundled-family-hub/bundled/shared-agenda-widget"
  ));
  const validateApplication = await compileProtocolSchema("application.schema.json");
  const validateFeature = await compileProtocolSchema("feature.schema.json");
  const validateComponent = await compileProtocolSchema("component.schema.json");

  assert.equal(validateApplication(application.manifest), true, formatSchemaErrors(validateApplication.errors).join("\n"));
  assert.equal(validateFeature(feature.manifest), true, formatSchemaErrors(validateFeature.errors).join("\n"));
  assert.equal(validateComponent(component.manifest), true, formatSchemaErrors(validateComponent.errors).join("\n"));
  assert.equal(validateApplication(feature.manifest), false);
  assert.equal(validateFeature(application.manifest), false);
  assert.equal(validateComponent(feature.manifest), false);
});

test("inspect reports identity, capabilities, and optional components", async () => {
  const inspection = await inspectPackage(savings);

  assert.equal(inspection.id, "org.seedspec.fixtures.portable-feature");
  assert.equal(inspection.kind, "feature");
  assert.equal(typeof inspection.description, "string");
  assert.deepEqual(inspection.metadata, { license: "Apache-2.0" });
  assert.deepEqual(
    inspection.requires.map((capability) => capability.id),
    [
      "org.seedspec.core.actors",
      "org.seedspec.core.balances",
      "org.seedspec.core.transactions"
    ]
  );
  assert.deepEqual(Object.keys(inspection.components).sort(), ["acceptance", "integration"]);
  assert.match(inspection.digest, /^sha256:[a-f0-9]{64}$/);
});

test("begin validates an application and exposes the pre-resolution workflow", async () => {
  const beginning = await beginPackage(allowance);
  const formatted = formatPackageBeginning(beginning);

  assert.equal(beginning.package.id, "org.seedspec.fixtures.comprehensive-application");
  assert.equal(beginning.configuration.selection_status, "review-required");
  assert.equal(beginning.configuration.resolution_behavior, "unselected-example-produces-needs-input");
  assert.equal(beginning.acceptance.declared, true);
  assert.ok(beginning.components.some(
    (component) => component.name === "reference" && component.review === "before-planning"
  ));
  assert.ok(beginning.artifacts.some((artifact) => artifact.id === "chore-reference"));
  assert.equal(beginning.tasks.path, "tasks.yaml");
  assert.equal(beginning.tasks.items[0].id, "inspect-current-state");
  assert.equal(beginning.trust.discovery_activates_content, false);
  assert.ok(beginning.next_actions.some(
    (action) => action.id === "record-artifact-dispositions"
      && /supporting artifact/.test(action.action)
  ));
  assert.ok(beginning.next_actions.some(
    (action) => action.id === "review-task-sequence" && /listed order/.test(action.action)
  ));
  assert.ok(beginning.next_actions.some((action) => action.id === "resolve-handoff"));
  assert.match(formatted, /Their order is their only sequencing mechanism/);
  assert.ok(formatted.indexOf("No package-declared solution decisions were supplied.")
    < formatted.indexOf("## Implementation profiles"));
});

test("context modules and bridge skills validate, inspect, and survive resolution", async (t) => {
  const fixture = await createContextModulePackage(t);
  const record = await validatePackage(fixture.packagePath);
  const inspection = await inspectPackage(fixture.packagePath);
  const beginning = await beginPackage(fixture.packagePath);
  const formattedBeginning = formatPackageBeginning(beginning);

  assert.equal(record.manifest.context.modules.length, 3);
  assert.equal(inspection.contextModules[1].id, "refund-safety");
  assert.equal(inspection.contextModules[1].bridges[0].skill, "review-behavior");
  assert.equal(beginning.trust.context_prepared, false);
  assert.equal(beginning.trust.bridge_skills_invoked, false);
  assert.match(formattedBeginning, /prepare only modules relevant to the current purpose/i);
  assert.match(formattedBeginning, /source: `package:context\/refund-safety\/?`/);
  assert.match(formattedBeginning, /review-behavior.*purpose review, purpose evaluate/s);

  const result = await resolveProject(fixture.packagePath, {
    outputDirectory: fixture.output
  });
  const indexPath = path.join(result.workspace, "context-index.yaml");
  const index = parseYaml(await readFile(indexPath, "utf8"));
  const validateIndex = await compileProtocolSchema("context-index.schema.json");
  const project = parseYaml(
    await readFile(path.join(result.workspace, "project.yaml"), "utf8")
  );
  const guide = await readFile(path.join(result.workspace, "agent-guide.md"), "utf8");

  assert.equal(validateIndex(index), true, formatSchemaErrors(validateIndex.errors).join("\n"));
  assert.equal(project.context_index, "context-index.yaml");
  const behavior = index.modules.find((module) => module.id === "refund-safety");
  assert.equal(behavior.qualified_id, `${record.manifest.id}/refund-safety`);
  assert.equal(behavior.availability, "materialized");
  assert.equal(behavior.bridges[0].skill, `${record.manifest.id}/review-behavior`);
  assert.equal(
    await readFile(
      path.join(result.workspace, behavior.root, behavior.entrypoint),
      "utf8"
    ),
    await readFile(path.join(fixture.packagePath, "context/refund-safety/BEHAVIOR.md"), "utf8")
  );
  assert.match(guide, /## Context navigation/);
  assert.match(guide, /A bridge Skill explains how to consume another module format/);
});

test("context preparation selects native or bridge mechanisms and binds reported use", async (t) => {
  const fixture = await createContextModulePackage(t);
  const projectPath = path.join(fixture.output, "context-project");
  const resolved = await resolveProject(fixture.packagePath, { outputDirectory: projectPath });

  const registry = createAdapterRegistry();
  await loadIntegrationAdapter(contextIntegration, registry);
  const native = await prepareContext(
    resolved.workspace,
    contextRequest,
    path.join(fixture.output, "prepared-native"),
    { registry }
  );
  const behavior = native.bundle.modules.find((module) => module.module.endsWith("/refund-safety"));
  assert.equal(behavior.mechanism.kind, "native-adapter");
  assert.equal(behavior.validation.status, "valid");
  assert.ok(behavior.included_files.some((file) => file.path === "BEHAVIOR.md"));
  const validateBundle = await compileProtocolSchema("context-bundle.schema.json");
  const validateReceipt = await compileProtocolSchema("context-preparation-receipt.schema.json");
  assert.equal(validateBundle(native.bundle), true, formatSchemaErrors(validateBundle.errors).join("\n"));
  assert.equal(validateReceipt(native.receipt), true, formatSchemaErrors(validateReceipt.errors).join("\n"));

  const usage = JSON.parse(await readFile(contextUse, "utf8"));
  usage.modules = usage.modules.map((module) => ({
    ...module,
    module: module.module.replace(
      "org.seedspec.fixtures.context-modules",
      "org.seedspec.fixtures.comprehensive-application"
    )
  }));
  const useReceipt = await recordContextUse(
    native.output,
    usage,
    path.join(fixture.output, "context-use-receipt.json")
  );
  const validateUseReceipt = await compileProtocolSchema("context-use-receipt.schema.json");
  assert.equal(validateUseReceipt(useReceipt), true, formatSchemaErrors(validateUseReceipt.errors).join("\n"));
  assert.equal(useReceipt.subject.preparation_receipt, native.receipt.receipt_id);

  const preparedOutput = native.bundle.modules[0].output.path;
  await writeFile(
    path.join(native.output, preparedOutput),
    `${await readFile(path.join(native.output, preparedOutput), "utf8")}\ntampered\n`,
    "utf8"
  );
  await assert.rejects(
    recordContextUse(
      native.output,
      usage,
      path.join(fixture.output, "tampered-context-use-receipt.json")
    ),
    (error) => error.code === "CONTEXT_BUNDLE_DIGEST_MISMATCH"
  );

  const bridged = await prepareContext(
    resolved.workspace,
    contextRequest,
    path.join(fixture.output, "prepared-bridge")
  );
  const bridgedBehavior = bridged.bundle.modules.find((module) => module.module.endsWith("/refund-safety"));
  assert.equal(bridgedBehavior.mechanism.kind, "bridge-skills");
  assert.equal(bridgedBehavior.mechanism.skills[0].skill.endsWith("/review-behavior"), true);
  assert.ok(await readFile(
    path.join(bridged.output, bridgedBehavior.mechanism.skills[0].path, "SKILL.md"),
    "utf8"
  ));
});

test("integration discovery is inert and explicit adapter loading verifies code bytes", async (t) => {
  const output = await temporaryDirectory(t);
  const integrationPath = path.join(output, "integration");
  const marker = path.join(output, "adapter-loaded.txt");
  await cp(contextIntegration, integrationPath, { recursive: true });
  const adapterPath = path.join(integrationPath, "adapter.mjs");
  await writeFile(adapterPath, `
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(marker)}, "loaded\\n", "utf8");
export const adapter = {
  adapter_api_version: "1",
  id: "org.seedspec.fixtures.example-context-adapter",
  version: "1.0.0",
  formats: [{ id: "org.example.context.behavior", versions: ["1.0.0"] }],
  capabilities: ["inspect", "validate", "prepare"],
  async inspect() { return {}; },
  async validate() { return { valid: true, issues: [] }; },
  async prepare() { return { text: "# Prepared", supporting_files: [] }; }
};
`, "utf8");
  const descriptorPath = path.join(integrationPath, "seedspec-integration.json");
  const descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
  descriptor.adapter.entrypoint = "adapter.js";
  await writeFile(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");
  await assert.rejects(
    readIntegrationDescriptor(integrationPath),
    (error) => error.code === "INVALID_INTEGRATION_DESCRIPTOR"
  );
  descriptor.adapter.entrypoint = "adapter.mjs";
  descriptor.adapter.digest = await computeFileDigest(adapterPath);
  await writeFile(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");

  const discovery = await discoverFormatIntegrations(
    path.join(root, "conformance/fixtures/context-modules"),
    [integrationPath]
  );
  assert.equal(discovery.modules.find((module) => module.module === "refund-safety").compatible.length, 1);
  await assert.rejects(access(marker));

  const integrationLink = path.join(output, "integration-link");
  await symlink(integrationPath, integrationLink);
  await assert.rejects(
    discoverFormatIntegrations(
      path.join(root, "conformance/fixtures/context-modules"),
      [integrationLink]
    ),
    (error) => error.code === "INVALID_INTEGRATION_DESCRIPTOR"
  );

  const registry = createAdapterRegistry();
  await loadIntegrationAdapter(integrationPath, registry);
  await access(marker);
  assert.equal(registry.list().length, 1);

  await writeFile(adapterPath, `${await readFile(adapterPath, "utf8")}\n// changed\n`, "utf8");
  await assert.rejects(
    discoverFormatIntegrations(
      path.join(root, "conformance/fixtures/context-modules"),
      [integrationPath]
    ),
    (error) => error.code === "INTEGRATION_ADAPTER_DIGEST_MISMATCH"
  );
});

test("adapter registries reject duplicates and ambiguous format claims", () => {
  const adapter = (id) => ({
    adapter_api_version: "1",
    id,
    version: "1.0.0",
    formats: [{ id: "org.example.context.behavior", versions: ["1.0.0"] }],
    capabilities: ["validate"],
    async validate() { return { valid: true, issues: [] }; }
  });
  const registry = createAdapterRegistry([adapter("org.example.adapters.first")]);
  assert.throws(
    () => registry.register(adapter("org.example.adapters.first")),
    (error) => error.code === "DUPLICATE_CONTEXT_ADAPTER"
  );
  registry.register(adapter("org.example.adapters.second"));
  assert.throws(
    () => registry.match({
      id: "refund-safety",
      qualified_id: "org.example.package/refund-safety",
      format: "org.example.context.behavior",
      format_version: "1.0.0"
    }, "validate"),
    (error) => error.code === "AMBIGUOUS_CONTEXT_ADAPTER"
  );
});

test("authoring bridge plans are dry-run first and install verified Skills atomically", async (t) => {
  const fixture = await createContextModulePackage(t);
  const manifestPath = path.join(fixture.packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.context.modules = manifest.context.modules.filter((module) => module.id !== "review-behavior");
  delete manifest.context.modules.find((module) => module.id === "refund-safety").bridges;
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  await rm(path.join(fixture.packagePath, "context/review-behavior"), { recursive: true, force: true });
  const before = await validatePackage(fixture.packagePath);

  await assert.rejects(
    planIntegrationBridges(fixture.packagePath, [contextIntegration], {
      selections: [{
        integration: "org.seedspec.fixtures.example-context-integration",
        bridge: "review-behavior",
        module: "primary-intent"
      }]
    }),
    (error) => error.code === "INVALID_INTEGRATION_SELECTION"
  );

  const plan = await planIntegrationBridges(fixture.packagePath, [contextIntegration]);
  assert.equal(plan.skills.length, 1);
  assert.equal(plan.bindings.length, 1);
  assert.equal((await validatePackage(fixture.packagePath)).digest, before.digest);

  const stateRoot = path.join(fixture.output, "authoring-state");
  const applied = await applyIntegrationBridgePlan(plan, { stateRoot });
  const updated = await validatePackage(fixture.packagePath);
  assert.equal(applied.digest, updated.digest);
  assert.ok(updated.manifest.context.modules.some((module) => module.id === "review-behavior"));
  assert.equal(
    updated.manifest.context.modules.find((module) => module.id === "refund-safety").bridges[0].skill,
    "review-behavior"
  );
  assert.match(await readFile(path.join(stateRoot, "integrations.yaml"), "utf8"), /after_digest/);
});

test("begin reports when a package has no author acceptance material", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "no-acceptance");
  await cp(allowance, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  delete manifest.components;
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");

  const beginning = await beginPackage(packagePath);
  assert.equal(beginning.acceptance.declared, false);
  assert.ok(beginning.notices.some((notice) => notice.code === "NO_DECLARED_ACCEPTANCE"));
  assert.match(
    beginning.next_actions.find((action) => action.id === "agree-completion-scope").action,
    /Record observable project-local completion criteria/
  );
});

test("the package prompt delegates the detailed workflow to versioned tooling", () => {
  const prompt = formatPackageAgentPrompt();
  assert.match(prompt, /npx @seedspec\/cli begin "<package-path-or-github-url>"/);
  assert.match(prompt, /before planning/i);
  assert.match(prompt, /do not need an installed SeedSpec skill/i);
  assert.match(prompt, /complete output as your version-matched work order/i);
  assert.match(prompt, /rendered SeedSpec handoff instead of guessing/i);
  assert.match(prompt, /Do not execute package-provided scripts/);
  assert.match(prompt, /bundled compatible workflow instructions.*fallback reason/i);
  assert.doesNotMatch(prompt, /--yes|@\d+\.\d+\.\d+|npm install/u);

  const remote = formatPackageAgentPrompt(
    "https://github.com/SeedSpec/reference-solutions/tree/main/solutions/family-hub/seedspec"
  );
  assert.match(
    remote,
    /npx @seedspec\/cli begin "https:\/\/github\.com\/SeedSpec\/reference-solutions\/tree\/main\/solutions\/family-hub\/seedspec"/u
  );
});

test("author-declared implementation resources are validated, preserved, and resolved online", async (t) => {
  const fixture = await createImplementationResourcePackage(t);
  const record = await validatePackage(fixture.packagePath);
  const listing = await listPackageImplementationResources(fixture.packagePath);
  const beginning = await beginPackage(fixture.packagePath);

  assert.equal(record.manifest.implementation_resources.additional_guidance, "agent-delegated");
  assert.equal(listing.resources[0].usage, "recommended");
  assert.ok(beginning.notices.some((notice) => notice.code === "IMPLEMENTATION_GUIDANCE_DELEGATED"));
  assert.equal(beginning.trust.remote_implementation_resources_fetched, false);
  assert.match(formatPackageBeginning(beginning), /https:\/\/guidance\.seedspec\.org\/catalog\.json/);

  const technicalPreferencesPath = path.join(fixture.output, "technical-preferences.yaml");
  await writeFile(technicalPreferencesPath, stringifyYaml({
    implementation_targets: [{
      id: "web-app",
      kind: "org.seedspec.target.application-platform",
      target: "org.seedspec.target.nextjs",
      guidance: [{
        package: "org.seedspec.fixtures.comprehensive-application",
        resource: "org.seedspec.guidance.authorization-decisions"
      }]
    }]
  }), "utf8");
  const result = await resolveProject(fixture.packagePath, {
    outputDirectory: path.join(fixture.output, "project"),
    technicalPreferencesPath
  });
  const resource = result.implementationResourceIndex.resources[0];
  const initialState = parseYaml(await readFile(
    path.join(result.workspace, "implementation-resource-state.yaml"),
    "utf8"
  ));
  assert.equal(resource.bundled.digest, fixture.digest);
  assert.equal(initialState.status, "not-resolved");
  assert.equal(initialState.resources[0].kind, "skill");
  assert.equal(initialState.resources[0].entrypoint, "SKILL.md");
  assert.ok(await readFile(
    path.join(result.workspace, resource.bundled.path, resource.entrypoint),
    "utf8"
  ));
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /seedspec docs implementing/
  );
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /implementation resource org\.seedspec\.fixtures\.comprehensive-application\/org\.seedspec\.guidance\.authorization-decisions/
  );
  // The skill-activation boundary now lives in the shared implementing guide;
  // the per-project guide points at it rather than restating it every time.
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /Discovery is not activation/
  );

  const fileDigest = `sha256:${createHash("sha256").update(fixture.skillSource).digest("hex")}`;
  const remoteManifest = {
    protocol_version: "0.3",
    id: resource.id,
    version: "0.1.0",
    kind: "skill",
    description: resource.description,
    entrypoint: "SKILL.md",
    digest: fixture.digest,
    files: [{
      path: "SKILL.md",
      url: "https://guidance.seedspec.org/resources/authorization/0.1.0/SKILL.md",
      digest: fileDigest,
      media_type: "text/markdown"
    }]
  };
  const fetchImpl = async (url) => {
    if (url.endsWith("resource.json")) {
      return new Response(JSON.stringify(remoteManifest), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(fixture.skillSource, {
      status: 200,
      headers: { "content-type": "text/markdown" }
    });
  };
  const resolvedState = await resolveImplementationResources(
    path.join(fixture.output, "project"),
    { fetchImpl, lookupImpl: publicAddressLookup }
  );
  assert.equal(resolvedState.status, "resolved");
  assert.equal(resolvedState.resources[0].resolution_status, "online");
  assert.equal(resolvedState.resources[0].resolved_version, "0.1.0");
  assert.equal(resolvedState.resources[0].kind, "skill");
  assert.equal(resolvedState.resources[0].entrypoint, "SKILL.md");
  assert.equal(
    await readFile(
      path.join(result.workspace, resolvedState.resources[0].path, "SKILL.md"),
      "utf8"
    ),
    fixture.skillSource
  );
  const useRecord = await recordImplementationResourceUse(
    path.join(fixture.output, "project"),
    {
      packageId: resource.package,
      resourceId: resource.id,
      useStatus: "consulted",
      reason: "Relevant to the selected actor and target decisions."
    }
  );
  assert.equal(useRecord.use_status, "consulted");
  assert.match(useRecord.use_reason, /selected actor and target/);

  const statePath = path.join(result.workspace, "implementation-resource-state.yaml");
  const legacyState = parseYaml(await readFile(statePath, "utf8"));
  legacyState.resources[0].use_status = "loaded";
  delete legacyState.resources[0].kind;
  delete legacyState.resources[0].entrypoint;
  await writeFile(statePath, stringifyYaml(legacyState), "utf8");

  const rerun = await resolveProject(fixture.packagePath, {
    outputDirectory: path.join(fixture.output, "project"),
    technicalPreferencesPath
  });
  const preservedState = parseYaml(await readFile(
    path.join(rerun.workspace, "implementation-resource-state.yaml"),
    "utf8"
  ));
  assert.equal(preservedState.resources[0].use_status, "consulted");
  assert.equal(preservedState.resources[0].kind, "skill");
  assert.equal(preservedState.resources[0].entrypoint, "SKILL.md");
  assert.equal(
    await readFile(
      path.join(rerun.workspace, preservedState.resources[0].path, "SKILL.md"),
      "utf8"
    ),
    fixture.skillSource
  );
});

test("canonical resource failure uses and reports a bundled fallback", async (t) => {
  const fixture = await createImplementationResourcePackage(t);
  const projectPath = path.join(fixture.output, "project");
  const result = await resolveProject(fixture.packagePath, { outputDirectory: projectPath });
  const state = await resolveImplementationResources(projectPath, {
    fetchImpl: async () => new Response("unavailable", {
      status: 503,
      statusText: "Unavailable"
    }),
    lookupImpl: publicAddressLookup
  });

  assert.equal(state.status, "degraded");
  assert.equal(state.resources[0].resolution_status, "bundled-fallback");
  assert.equal(state.resources[0].reason_code, "IMPLEMENTATION_RESOURCE_FETCH_FAILED");
  assert.match(state.resources[0].reason, /could not be retrieved/);
  assert.equal(
    await readFile(
      path.join(result.workspace, state.resources[0].path, "SKILL.md"),
      "utf8"
    ),
    fixture.skillSource
  );
});

test("canonical resource redirects cannot reach literal private hosts", async (t) => {
  const fixture = await createImplementationResourcePackage(t);
  const projectPath = path.join(fixture.output, "project");
  await resolveProject(fixture.packagePath, { outputDirectory: projectPath });
  let fetchCalls = 0;
  const state = await resolveImplementationResources(projectPath, {
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://127.0.0.1/internal" }
      });
    },
    lookupImpl: publicAddressLookup
  });

  assert.equal(fetchCalls, 1);
  assert.equal(state.resources[0].resolution_status, "bundled-fallback");
  assert.equal(state.resources[0].reason_code, "INVALID_IMPLEMENTATION_RESOURCE");
  assert.match(state.resources[0].reason, /local or private network host/);
});

test("canonical resource redirects cannot reach unroutable or non-global address forms", async (t) => {
  const fixture = await createImplementationResourcePackage(t);
  const projectPath = path.join(fixture.output, "project");
  await resolveProject(fixture.packagePath, { outputDirectory: projectPath });
  const blockedTargets = [
    "https://0.0.0.0/internal",
    "https://100.64.1.2/internal",
    "https://[fd00::1]/internal",
    "https://[fe80::1]/internal",
    "https://[::ffff:127.0.0.1]/internal",
    "https://[::]/internal"
  ];
  for (const target of blockedTargets) {
    const state = await resolveImplementationResources(projectPath, {
      fetchImpl: async () => new Response(null, {
        status: 302,
        headers: { location: target }
      }),
      lookupImpl: publicAddressLookup
    });
    assert.equal(state.resources[0].resolution_status, "bundled-fallback", target);
    assert.equal(state.resources[0].reason_code, "INVALID_IMPLEMENTATION_RESOURCE", target);
    assert.match(state.resources[0].reason, /local or private network host/, target);
  }
});

test("hostnames resolving to private addresses are rejected before any request", async (t) => {
  const fixture = await createImplementationResourcePackage(t);
  const projectPath = path.join(fixture.output, "project");
  await resolveProject(fixture.packagePath, { outputDirectory: projectPath });
  const privateResolutions = [
    [{ address: "10.0.0.5", family: 4 }],
    [{ address: "203.0.113.10", family: 4 }, { address: "192.168.1.20", family: 4 }],
    [{ address: "fd12:3456::1", family: 6 }]
  ];
  for (const records of privateResolutions) {
    let fetchCalls = 0;
    const state = await resolveImplementationResources(projectPath, {
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response("never reached", { status: 200 });
      },
      lookupImpl: async () => records
    });
    assert.equal(fetchCalls, 0, JSON.stringify(records));
    assert.equal(state.resources[0].resolution_status, "bundled-fallback");
    assert.equal(state.resources[0].reason_code, "INVALID_IMPLEMENTATION_RESOURCE");
    assert.match(state.resources[0].reason, /resolves to/);
  }
});

test("latest resource policies reject SemVer prereleases below a stable baseline", async (t) => {
  const fixture = await createImplementationResourcePackage(t);
  const manifestPath = path.join(fixture.packagePath, "seedspec.yaml");
  const packageManifest = parseYaml(await readFile(manifestPath, "utf8"));
  packageManifest.implementation_resources.resources[0].update_policy = "latest";
  await writeFile(manifestPath, stringifyYaml(packageManifest), "utf8");

  const projectPath = path.join(fixture.output, "project");
  await resolveProject(fixture.packagePath, { outputDirectory: projectPath });
  const remoteManifest = {
    protocol_version: "0.3",
    id: "org.seedspec.guidance.authorization-decisions",
    version: "0.1.0-alpha.1",
    kind: "skill",
    description: "Prerelease guidance",
    entrypoint: "SKILL.md",
    digest: fixture.digest,
    files: [{
      path: "SKILL.md",
      url: "https://guidance.seedspec.org/resources/authorization/0.1.0-alpha.1/SKILL.md",
      digest: `sha256:${createHash("sha256").update(fixture.skillSource).digest("hex")}`
    }]
  };
  const state = await resolveImplementationResources(projectPath, {
    fetchImpl: async () => new Response(JSON.stringify(remoteManifest), { status: 200 }),
    lookupImpl: publicAddressLookup
  });

  assert.equal(state.resources[0].resolution_status, "bundled-fallback");
  assert.equal(state.resources[0].reason_code, "IMPLEMENTATION_RESOURCE_VERSION_MISMATCH");
  assert.match(state.resources[0].reason, /older version/);
});

test("expected unavailable resources fail after recording resolution state", async (t) => {
  const fixture = await createImplementationResourcePackage(t, {
    includeBundled: false,
    usage: "expected"
  });
  const projectPath = path.join(fixture.output, "project");
  const result = await resolveProject(fixture.packagePath, { outputDirectory: projectPath });

  await assert.rejects(
    resolveImplementationResources(projectPath, {
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
      lookupImpl: publicAddressLookup
    }),
    (error) => error.code === "EXPECTED_IMPLEMENTATION_RESOURCE_UNAVAILABLE"
  );
  const state = parseYaml(await readFile(
    path.join(result.workspace, "implementation-resource-state.yaml"),
    "utf8"
  ));
  assert.equal(state.status, "failed");
  assert.equal(state.resources[0].resolution_status, "unavailable");
});

test("bundled implementation resource bytes must match the declared digest", async (t) => {
  const fixture = await createImplementationResourcePackage(t);
  await writeFile(
    path.join(fixture.resourcePath, "SKILL.md"),
    `${fixture.skillSource}\nChanged after packaging.\n`,
    "utf8"
  );
  await assert.rejects(
    validatePackage(fixture.packagePath),
    (error) => error.code === "IMPLEMENTATION_RESOURCE_DIGEST_MISMATCH"
  );
});

test("bundled implementation resources are reverified before use", async (t) => {
  const fixture = await createImplementationResourcePackage(t, { includeCanonical: false });
  const projectPath = path.join(fixture.output, "project");
  const result = await resolveProject(fixture.packagePath, { outputDirectory: projectPath });
  const resource = result.implementationResourceIndex.resources[0];
  await writeFile(
    path.join(result.workspace, resource.bundled.path, resource.entrypoint),
    `${fixture.skillSource}\nModified inside the resolved handoff.\n`,
    "utf8"
  );

  const state = await resolveImplementationResources(projectPath);
  assert.equal(state.status, "degraded");
  assert.equal(state.resources[0].resolution_status, "unavailable");
  assert.equal(state.resources[0].reason_code, "IMPLEMENTATION_RESOURCE_DIGEST_MISMATCH");
});

test("artifact discovery remains passive supporting material", async () => {
  const listing = await listPackageArtifacts(allowance);
  const artifact = listing.artifacts.find((candidate) => candidate.id === "chore-reference");

  assert.equal(artifact.type, "org.example.artifact.reference-markdown");
  assert.deepEqual(artifact.concerns, ["org.seedspec.concern.design"]);
  assert.equal("adapter" in artifact, false);
});

test("context validation requires an explicit adapter registry", async (t) => {
  const fixture = await createContextModulePackage(t);
  await assert.rejects(
    validateContextModule(fixture.packagePath, "refund-safety", {
      registry: createAdapterRegistry()
    }),
    (error) => error.code === "CONTEXT_ADAPTER_NOT_FOUND"
  );
});

test("core validation does not silently run context-format validation", async (t) => {
  const fixture = await createContextModulePackage(t);
  await writeFile(
    path.join(fixture.packagePath, "context/refund-safety/BEHAVIOR.md"),
    "This remains package input even when its native validator rejects it.\n",
    "utf8"
  );

  await validatePackage(fixture.packagePath);
  const registry = createAdapterRegistry();
  await loadIntegrationAdapter(
    path.join(root, "conformance/integrations/example-context"),
    registry
  );
  const result = await validateContextModule(fixture.packagePath, "refund-safety", { registry });
  assert.equal(result.valid, false);
});

test("artifact relationships must refer to declared local artifact IDs", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "unknown-artifact-relation");
  await cp(allowance, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.relationships = [{
    from: "chore-reference",
    type: "org.seedspec.relation.derived-from",
    to: "missing-artifact"
  }];
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");

  await assert.rejects(
    validatePackage(packagePath),
    (error) => error.code === "INVALID_MANIFEST_SEMANTICS"
      && error.details.some((detail) => detail.includes("missing-artifact"))
  );
});

test("the primary intent module must exist and resolve to local bytes", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "invalid-primary-intent");
  await cp(allowance, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));

  manifest.definition.module = "missing-primary-intent";
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  await assert.rejects(
    validatePackage(packagePath),
    (error) => error.code === "INVALID_CONTEXT_MODULE"
      && error.details.some((detail) => detail.includes("missing-primary-intent"))
  );

  manifest.definition.module = "primary-intent";
  manifest.context.modules[0].source.path = "intent/not-here.md";
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  await assert.rejects(
    validatePackage(packagePath),
    (error) => error.code === "INVALID_CONTEXT_MODULE"
      && /does not exist/.test(error.message)
  );
});

test("feature discovery exposes declaration context without compatibility verdicts", async () => {
  const result = await discoverFeatures(allowance, [path.join(root, "conformance/fixtures")]);
  const savingsCandidate = result.candidates.find((candidate) => (
    candidate.id === "org.seedspec.fixtures.portable-feature"
  ));
  const streakCandidate = result.candidates.find((candidate) => (
    candidate.id === "org.seedspec.fixtures.revision-feature"
  ));

  assert.equal(savingsCandidate.status, "candidate");
  assert.equal(streakCandidate.status, "review");
  assert.ok(streakCandidate.reasons.some((reason) => reason.includes("tested at 1.0.0")));
  assert.ok(result.candidates.every(
    (candidate) => !["compatible", "incompatible", "conflict"].includes(candidate.status)
  ));
  assert.deepEqual(result.application.id, "org.seedspec.fixtures.comprehensive-application");
});

test("invalid fixture fails with a useful referenced-file error", async () => {
  await assert.rejects(
    validatePackage(path.join(fixtures, "missing-definition")),
    (error) => error.code === "INVALID_CONTEXT_MODULE"
      && /does not exist/.test(error.message)
  );
});

test("task runbooks reject duplicate IDs and missing or non-file references", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "invalid-tasks");
  await cp(allowance, packagePath, { recursive: true });
  const taskPath = path.join(packagePath, "tasks.yaml");
  const runbook = parseYaml(await readFile(taskPath, "utf8"));
  runbook.tasks[1].id = runbook.tasks[0].id;
  runbook.tasks[0].references = ["missing/context.md", "reference/capabilities"];
  await writeFile(taskPath, stringifyYaml(runbook), "utf8");

  await assert.rejects(
    validatePackage(packagePath),
    (error) => error.code === "INVALID_TASK_RUNBOOK"
      && error.details.some((detail) => detail.includes("appears more than once"))
      && error.details.some((detail) => detail.includes("does not exist"))
      && error.details.some((detail) => detail.includes("must reference a file"))
  );
});

test("the comprehensive application fixture resolves without additions", async (t) => {
  const output = await temporaryDirectory(t);
  const result = await resolveProject(allowance, { outputDirectory: output });
  const project = parseYaml(await readFile(path.join(result.workspace, "project.yaml"), "utf8"));

  assert.deepEqual(project.additions, []);
  assert.equal(project.status, "needs-input");
  assert.equal(project.configuration_status, "review");
  assert.equal(result.resolvedConfiguration.root.selection, "example-unreviewed");
  assert.equal(result.lock.root.id, "org.seedspec.fixtures.comprehensive-application");
  assert.ok(result.lock.capabilities.some(
    (capability) => capability.id === "org.seedspec.core.chores"
  ));
  assert.equal(result.artifactIndex.artifacts.length, 1);
  assert.equal(result.artifactIndex.artifacts[0].disposition, "unreviewed");
  assert.equal("intent_role" in result.artifactIndex.artifacts[0], false);
  assert.equal(result.project.artifact_status, "review");
  assert.equal(project.task_index, "tasks.yaml");
  assert.deepEqual(
    result.taskIndex.packages[0].tasks.map((task) => task.id),
    ["inspect-current-state", "review-author-context", "realize-package", "verify-realization"]
  );
  assert.ok(await readFile(
    path.join(
      result.workspace,
      result.taskIndex.packages[0].tasks[1].references[0].path
    ),
    "utf8"
  ));
  assert.ok(result.componentIndex.components.some(
    (component) => component.name === "reference" && component.review === "before-planning"
  ));
  assert.ok(await readFile(
    path.join(
      result.workspace,
      "components/org.seedspec.fixtures.comprehensive-application/reference/capabilities/chores-1.0.0.md"
    ),
    "utf8"
  ));
  assert.ok(await readFile(
    path.join(result.workspace, result.artifactIndex.artifacts[0].path),
    "utf8"
  ));
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /seedspec docs implementing/
  );
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /Do not treat the recorded example values as selected product behavior/
  );
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /address these reminders from top to bottom/
  );
});

test("artifact dispositions and implementation targets survive resolution", async (t) => {
  const output = await temporaryDirectory(t);
  const selectionsPath = path.join(output, "artifact-selections.yaml");
  const preferencesPath = path.join(output, "technical-preferences.yaml");
  await writeFile(selectionsPath, stringifyYaml({
    protocol_version: "0.3",
    artifacts: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      id: "chore-reference",
      disposition: "selected",
      note: "Use this as supporting product intent."
    }]
  }), "utf8");
  await writeFile(preferencesPath, stringifyYaml({
    implementation_targets: [{
      id: "production-hosting",
      kind: "org.seedspec.target.hosting",
      target: "com.example.hosting.static",
      guidance: [
        {
          package: "org.seedspec.fixtures.comprehensive-application",
          artifact: "chore-reference"
        },
        {
          package: "org.seedspec.fixtures.comprehensive-application",
          component: "reference"
        }
      ]
    }]
  }), "utf8");

  const result = await resolveProject(allowance, {
    outputDirectory: output,
    artifactSelectionsPath: selectionsPath,
    technicalPreferencesPath: preferencesPath
  });
  const artifact = result.artifactIndex.artifacts[0];
  const guide = await readFile(path.join(result.workspace, "agent-guide.md"), "utf8");

  assert.equal(result.project.artifact_status, "recorded");
  assert.equal(artifact.disposition, "selected");
  assert.equal(artifact.selection_note, "Use this as supporting product intent.");
  assert.match(guide, /production-hosting.*org\.seedspec\.target\.hosting.*com\.example\.hosting\.static/);
  assert.match(guide, /artifact org\.seedspec\.fixtures\.comprehensive-application\/chore-reference/);
  assert.match(guide, /Discovery is not activation/);
});

test("invalid artifact references fail and target guidance requires selected artifacts", async (t) => {
  const output = await temporaryDirectory(t);
  const invalidSelectionsPath = path.join(output, "invalid-artifact-selections.yaml");
  const declinedArtifactPath = path.join(output, "declined-artifact.yaml");
  const preferencesPath = path.join(output, "technical-preferences.yaml");
  await writeFile(invalidSelectionsPath, stringifyYaml({
    protocol_version: "0.3",
    artifacts: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      id: "missing-artifact",
      disposition: "selected"
    }]
  }), "utf8");
  await writeFile(preferencesPath, stringifyYaml({
    implementation_targets: [{
      id: "production-hosting",
      kind: "org.seedspec.target.hosting",
      target: "com.example.hosting.static",
      guidance: [{
        package: "org.seedspec.fixtures.comprehensive-application",
        artifact: "chore-reference"
      }]
    }]
  }), "utf8");
  await writeFile(declinedArtifactPath, stringifyYaml({
    protocol_version: "0.3",
    artifacts: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      id: "chore-reference",
      disposition: "declined"
    }]
  }), "utf8");

  await assert.rejects(
    resolveProject(allowance, {
      outputDirectory: path.join(output, "invalid-artifact-output"),
      artifactSelectionsPath: invalidSelectionsPath
    }),
    (error) => error.code === "INVALID_ARTIFACT_SELECTIONS"
      && /missing-artifact/.test(error.message)
  );
  await assert.rejects(
    resolveProject(allowance, {
      outputDirectory: path.join(output, "declined-artifact-output"),
      artifactSelectionsPath: declinedArtifactPath,
      technicalPreferencesPath: preferencesPath
    }),
    (error) => error.code === "INVALID_IMPLEMENTATION_TARGET"
      && /requires selected artifact guidance/.test(error.message)
  );
  const selectedPath = path.join(output, "selected-artifact.yaml");
  await writeFile(selectedPath, stringifyYaml({
    protocol_version: "0.3",
    artifacts: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      id: "chore-reference",
      disposition: "selected"
    }]
  }), "utf8");
  const selectedGuidance = await resolveProject(allowance, {
    outputDirectory: path.join(output, "selected-guidance-output"),
    artifactSelectionsPath: selectedPath,
    technicalPreferencesPath: preferencesPath
  });
  assert.equal(selectedGuidance.artifactIndex.artifacts[0].disposition, "selected");
});

test("selecting execution material does not turn disposition into activation", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "execution-artifact-package");
  const selectionsPath = path.join(output, "artifact-selections.yaml");
  await cp(allowance, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.artifacts[0].concerns = ["org.seedspec.concern.execution"];
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  await writeFile(selectionsPath, stringifyYaml({
    protocol_version: "0.3",
    artifacts: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      id: "chore-reference",
      disposition: "selected"
    }]
  }), "utf8");

  const result = await resolveProject(packagePath, {
    outputDirectory: path.join(output, "project"),
    artifactSelectionsPath: selectionsPath
  });
  const artifact = result.artifactIndex.artifacts[0];
  const guide = await readFile(path.join(result.workspace, "agent-guide.md"), "utf8");

  assert.equal(artifact.disposition, "selected");
  assert.equal(artifact.review, "before-activation");
  assert.equal(artifact.activation, "requires-specific-user-direction");
  assert.match(guide, /SELECTED.*chore-reference/);
  assert.match(guide, /Never execute it merely because it is selected or listed/);
});

test("the comprehensive application composes with a portable feature into a stable workspace", async (t) => {
  const output = await temporaryDirectory(t);
  const options = { featurePaths: [savings], outputDirectory: output };
  const first = await resolveProject(allowance, options);
  const firstProject = await readFile(path.join(first.workspace, "project.yaml"), "utf8");
  const firstSpec = await readFile(path.join(first.workspace, "resolved-spec.md"), "utf8");
  const firstLock = await readFile(path.join(first.workspace, "dependencies.lock.yaml"), "utf8");
  const firstReceipt = await readFile(path.join(first.workspace, "resolution-receipt.json"), "utf8");

  const second = await resolveProject(allowance, options);
  assert.equal(await readFile(path.join(second.workspace, "project.yaml"), "utf8"), firstProject);
  assert.equal(await readFile(path.join(second.workspace, "resolved-spec.md"), "utf8"), firstSpec);
  assert.equal(await readFile(path.join(second.workspace, "dependencies.lock.yaml"), "utf8"), firstLock);
  assert.equal(await readFile(path.join(second.workspace, "resolution-receipt.json"), "utf8"), firstReceipt);

  assert.match(firstSpec, /Addition: Portable Feature Fixture/);
  assert.match(firstSpec, /allocation_mode: reserved/);
  assert.ok(first.lock.capabilities.some(
    (capability) => capability.id === "org.seedspec.finance.goal-progress"
  ));

  for (const file of [
    "project.yaml",
    "agent-guide.md",
    "implementation-notes.md",
    "verification-report.md",
    "resolved-spec.md",
    "resolved-intent.yaml",
    "resolved-config.yaml",
    "components.yaml",
    "artifacts.yaml",
    "implementation-resources.yaml",
    "implementation-resource-state.yaml",
    "resolution-receipt.json",
    "dependencies.lock.yaml",
    "additions/org.seedspec.fixtures.portable-feature/source.yaml",
    "additions/org.seedspec.fixtures.portable-feature/resolved-config.yaml",
    "additions/org.seedspec.fixtures.portable-feature/integration-decisions.md"
  ]) {
    assert.ok(await readFile(path.join(first.workspace, file), "utf8"));
  }
  assert.match(
    await readFile(path.join(output, "AGENTS.md"), "utf8"),
    /\.seedspec\/agent-guide\.md/
  );
  assert.match(firstSpec, /Capability and composition declaration review/);
});

test("missing required capability declarations produce agent review instead of rejection", async (t) => {
  const output = await temporaryDirectory(t);
  const unmet = path.join(fixtures, "unmet-feature");
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance, unmet]
  );
  const appliedIntentPath = await writeAffirmedAppliedIntent(output, [allowance, unmet]);
  const result = await resolveProject(allowance, {
    featurePaths: [unmet],
    configurationSelectionsPath,
    appliedIntentPath,
    outputDirectory: output
  });
  const requirement = result.lock.requirements.find(
    (candidate) => candidate.capability === "org.example.capability.teleportation"
  );

  assert.equal(result.project.status, "ready");
  assert.equal(result.project.declaration_status, "review");
  assert.deepEqual(requirement.providers, []);
  assert.deepEqual(requirement.issues, ["no-declared-provider"]);
  assert.ok(result.lock.reviews.some(
    (review) => review.code === "no-declared-provider"
      && review.capability === "org.example.capability.teleportation"
  ));
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /no-declared-provider.*teleportation/
  );
});

test("application capability requirements are retained as declaration review", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "application-with-requirement");
  await cp(allowance, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.requires = {
    capabilities: [{
      id: "org.example.capability.external-identity",
      tested_against: "1.0.0"
    }]
  };
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");

  const result = await resolveProject(packagePath, {
    outputDirectory: path.join(output, "project")
  });
  const requirement = result.lock.requirements.find(
    (candidate) => candidate.consumer === "org.seedspec.fixtures.comprehensive-application"
  );

  assert.equal(result.project.declaration_status, "review");
  assert.equal(requirement.capability, "org.example.capability.external-identity");
  assert.deepEqual(requirement.issues, ["no-declared-provider"]);
});

test("ambiguous providers, author conflicts, and cycles resolve as review context", async (t) => {
  const scenarios = [
    {
      name: "ambiguous",
      featurePaths: [path.join(root, "conformance/fixtures/ambiguous-provider")],
      code: "multiple-declared-providers"
    },
    {
      name: "conflict",
      featurePaths: [path.join(root, "conformance/fixtures/conflicting-feature")],
      code: "declared-package-conflict"
    },
    {
      name: "cycle",
      featurePaths: [
        path.join(root, "conformance/fixtures/cycle-a"),
        path.join(root, "conformance/fixtures/cycle-b")
      ],
      code: "declared-requirement-cycle"
    }
  ];

  for (const scenario of scenarios) {
    const output = path.join(await temporaryDirectory(t), scenario.name);
    const result = await resolveProject(allowance, {
      featurePaths: scenario.featurePaths,
      outputDirectory: output
    });
    assert.equal(result.project.declaration_status, "review");
    assert.ok(
      result.lock.reviews.some((review) => review.code === scenario.code),
      `${scenario.name} should retain ${scenario.code}`
    );
  }
});

test("configuration selections distinguish examples, complete custom values, and omission", async (t) => {
  const output = await temporaryDirectory(t);
  const application = await validatePackage(allowance);
  const examplePath = await writeExampleConfigurationSelections(
    output,
    [allowance],
    "example-selection.yaml"
  );
  const appliedIntentPath = await writeAffirmedAppliedIntent(output, [allowance]);
  const exampleResult = await resolveProject(allowance, {
    outputDirectory: path.join(output, "example-project"),
    configurationSelectionsPath: examplePath,
    appliedIntentPath
  });
  assert.equal(exampleResult.project.status, "ready");
  assert.equal(exampleResult.project.configuration_status, "selected");
  assert.equal(exampleResult.resolvedConfiguration.root.selection, "example");

  const customPath = path.join(output, "custom-selection.yaml");
  await writeFile(customPath, stringifyYaml({
    protocol_version: "0.3",
    packages: [{
      package: application.manifest.id,
      selection: "custom",
      values: {
        ...application.exampleConfiguration,
        approval_required: false
      }
    }]
  }), "utf8");
  const customResult = await resolveProject(allowance, {
    outputDirectory: path.join(output, "custom-project"),
    configurationSelectionsPath: customPath,
    appliedIntentPath
  });
  assert.equal(customResult.resolvedConfiguration.root.selection, "custom");
  assert.equal(customResult.resolvedConfiguration.root.values.approval_required, false);

  const partialPath = path.join(output, "partial-selection.yaml");
  await writeFile(partialPath, stringifyYaml({
    protocol_version: "0.3",
    packages: [{
      package: application.manifest.id,
      selection: "custom",
      values: { approval_required: false }
    }]
  }), "utf8");

  await assert.rejects(
    resolveProject(allowance, {
      outputDirectory: path.join(output, "partial-project"),
      configurationSelectionsPath: partialPath
    }),
    (error) => error.code === "INVALID_CONFIGURATION"
      && error.details.some((detail) => detail.includes("required property"))
  );
});

test("configuration selections reject missing, duplicate, and unselected package entries", async (t) => {
  const output = await temporaryDirectory(t);
  const cases = [
    {
      name: "missing",
      input: {
        protocol_version: "0.3",
        packages: [{ package: "org.seedspec.fixtures.comprehensive-application", selection: "example" }]
      },
      code: "MISSING_CONFIGURATION_SELECTION"
    },
    {
      name: "duplicate",
      input: {
        protocol_version: "0.3",
        packages: [
          { package: "org.seedspec.fixtures.comprehensive-application", selection: "example" },
          { package: "org.seedspec.fixtures.comprehensive-application", selection: "example" },
          { package: "org.seedspec.fixtures.portable-feature", selection: "example" }
        ]
      },
      code: "INVALID_CONFIGURATION_SELECTIONS"
    },
    {
      name: "unselected",
      input: {
        protocol_version: "0.3",
        packages: [
          { package: "org.seedspec.fixtures.comprehensive-application", selection: "example" },
          { package: "org.example.not-selected", selection: "example" }
        ]
      },
      code: "INVALID_CONFIGURATION_SELECTIONS"
    }
  ];

  for (const scenario of cases) {
    const selectionPath = path.join(output, `${scenario.name}.yaml`);
    await writeFile(selectionPath, stringifyYaml(scenario.input), "utf8");
    await assert.rejects(
      resolveProject(allowance, {
        featurePaths: [savings],
        outputDirectory: path.join(output, `${scenario.name}-project`),
        configurationSelectionsPath: selectionPath
      }),
      (error) => error.code === scenario.code
    );
  }
});

test("applied intent preserves fit, provenance, plans, and baseline evidence", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance]
  );

  const omitted = await resolveProject(allowance, {
    outputDirectory: path.join(output, "omitted"),
    configurationSelectionsPath
  });
  assert.equal(omitted.project.intent_status, "review");
  assert.equal(omitted.project.status, "needs-input");
  assert.equal(omitted.resolvedIntent.packages[0].format.id, "org.seedspec.intent.markdown");
  assert.equal(omitted.resolvedIntent.packages[0].provenance, "package-author");

  const partialCoveragePath = path.join(output, "partial-coverage.yaml");
  await writeFile(partialCoveragePath, stringifyYaml({
    protocol_version: "0.3",
    packages: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      use: "as-authored"
    }],
    contributions: []
  }), "utf8");
  const partialCoverage = await resolveProject(allowance, {
    featurePaths: [savings],
    outputDirectory: path.join(output, "partial-coverage"),
    appliedIntentPath: partialCoveragePath
  });
  assert.equal(partialCoverage.project.intent_status, "review");
  assert.ok(partialCoverage.resolvedIntent.unresolved.some(
    (item) => item.includes("org.seedspec.fixtures.portable-feature")
  ));

  const proposedPath = path.join(output, "proposed-intent.yaml");
  await writeFile(proposedPath, stringifyYaml({
    protocol_version: "0.3",
    packages: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      use: "as-authored"
    }],
    contributions: [{
      id: "reduce-reminders",
      category: "outcome",
      statement: "Caregivers should spend less time sending manual allowance reminders.",
      source: "agent",
      status: "proposed"
    }]
  }), "utf8");
  const proposed = await resolveProject(allowance, {
    outputDirectory: path.join(output, "proposed"),
    configurationSelectionsPath,
    appliedIntentPath: proposedPath
  });
  assert.equal(proposed.project.intent_status, "review");
  assert.ok(proposed.resolvedIntent.unresolved.some((item) => item.includes("reduce-reminders")));

  const affirmedPath = path.join(output, "affirmed-intent.yaml");
  await writeFile(affirmedPath, stringifyYaml({
    protocol_version: "0.3",
    packages: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      use: "adapted",
      note: "Use the existing household identity model."
    }],
    contributions: [
      {
        id: "reduce-reminders",
        category: "outcome",
        statement: "Caregivers should spend less time sending manual allowance reminders.",
        source: "end-user",
        status: "affirmed",
        verification: {
          subject: "outcome",
          method: "user-confirmation",
          timing: "post-realization",
          evidence: "required"
        }
      },
      {
        id: "existing-identities",
        category: "baseline-observation",
        statement: "The target environment already has a household identity model.",
        source: "agent",
        status: "observed",
        verification: {
          subject: "baseline",
          method: "environment-inspection",
          timing: "before-implementation",
          evidence: "required"
        },
        evidence: [{
          subject: "baseline",
          reference: "repository://app/models/household-members",
          source: "tool"
        }]
      }
    ]
  }), "utf8");
  const affirmed = await resolveProject(allowance, {
    outputDirectory: path.join(output, "affirmed"),
    configurationSelectionsPath,
    appliedIntentPath: affirmedPath
  });
  assert.equal(affirmed.project.intent_status, "affirmed");
  assert.equal(affirmed.project.status, "ready");
  assert.equal(affirmed.resolvedIntent.packages[0].use, "adapted");
  assert.equal(affirmed.resolvedIntent.contributions[1].evidence[0].subject, "baseline");
  assert.match(
    await readFile(path.join(affirmed.workspace, "agent-guide.md"), "utf8"),
    /Baseline evidence \[tool\]: repository:\/\/app\/models\/household-members/
  );

  const invalidPath = path.join(output, "invalid-intent.yaml");
  await writeFile(invalidPath, stringifyYaml({
    protocol_version: "0.3",
    packages: [{
      package: "org.seedspec.fixtures.comprehensive-application",
      use: "adapted"
    }],
    contributions: []
  }), "utf8");
  await assert.rejects(
    resolveProject(allowance, {
      outputDirectory: path.join(output, "invalid"),
      configurationSelectionsPath,
      appliedIntentPath: invalidPath
    }),
    (error) => error.code === "INVALID_APPLIED_INTENT"
  );
});

test("completion scope stays independent from implementation readiness", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance]
  );
  const appliedIntentPath = await writeAffirmedAppliedIntent(output, [allowance]);
  const result = await resolveProject(allowance, {
    outputDirectory: output,
    configurationSelectionsPath,
    appliedIntentPath
  });
  const completion = await inspectProjectCompletion(output);

  assert.equal(result.project.status, "ready");
  assert.equal(result.project.completion_scope_status, "review");
  assert.deepEqual(result.completionScope.uncovered_packages, [
    "org.seedspec.fixtures.comprehensive-application"
  ]);
  assert.equal(completion.status, "scope-review");
  assert.equal(completion.state.status, "not-started");
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const command = await execFileAsync(process.execPath, [cli, "completion", output]);
  assert.match(command.stdout, /Completion status: scope-review/);
});

test("completion checking derives verified-with-gaps from scoped evidence", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance, savings]
  );
  const appliedIntentPath = await writeAffirmedAppliedIntent(output, [allowance, savings]);
  const completionScopePath = path.join(output, "completion-input.yaml");
  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.3",
    items: [
      {
        kind: "component",
        id: "allowance-acceptance",
        package: "org.seedspec.fixtures.comprehensive-application",
        component: "acceptance",
        selection: "all",
        verification: realizationVerification
      },
      {
        kind: "component",
        id: "savings-acceptance",
        package: "org.seedspec.fixtures.portable-feature",
        component: "acceptance",
        selection: "subset",
        included_references: ["1"],
        deferred_references: ["2"],
        verification: realizationVerification
      }
    ]
  }), "utf8");

  const result = await resolveProject(allowance, {
    featurePaths: [savings],
    outputDirectory: output,
    configurationSelectionsPath,
    appliedIntentPath,
    completionScopePath
  });
  assert.equal(result.project.completion_scope_status, "recorded");
  const statePath = path.join(result.workspace, "verification-state.yaml");
  const state = parseYaml(await readFile(statePath, "utf8"));
  state.status = "verified-with-gaps";
  state.items = state.items.map((item) => ({
    ...item,
    result: "pass",
    evidence: [{
      subject: "realization",
      reference: `test evidence for ${item.id}`,
      source: "tool"
    }]
  }));
  await writeFile(statePath, stringifyYaml(state), "utf8");

  const completion = await inspectProjectCompletion(output);
  assert.equal(completion.status, "verified-with-gaps");
  assert.equal(completion.state.scope_digest, completionScopeDigest(completion.scope));

  state.items[0].evidence[0].subject = "outcome";
  await writeFile(statePath, stringifyYaml(state), "utf8");
  await assert.rejects(
    inspectProjectCompletion(output),
    (error) => error.code === "EVIDENCE_SUBJECT_MISMATCH"
      && error.details.some((detail) => detail.includes("expected realization"))
  );
});

test("completion checking rejects overlapping references and stale verification", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance]
  );
  const appliedIntentPath = await writeAffirmedAppliedIntent(output, [allowance]);
  const completionScopePath = path.join(output, "completion-input.yaml");
  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.3",
    items: [{
      kind: "component",
      id: "allowance-acceptance",
      package: "org.seedspec.fixtures.comprehensive-application",
      component: "acceptance",
      selection: "subset",
      included_references: ["1"],
      deferred_references: ["1"],
      verification: realizationVerification
    }]
  }), "utf8");
  await assert.rejects(
    resolveProject(allowance, {
      outputDirectory: path.join(output, "invalid-project"),
      configurationSelectionsPath,
      appliedIntentPath,
      completionScopePath
    }),
    (error) => error.code === "INVALID_COMPLETION_SCOPE"
  );

  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.3",
    items: [{
      kind: "component",
      id: "allowance-acceptance",
      package: "org.seedspec.fixtures.comprehensive-application",
      component: "acceptance",
      selection: "all",
      verification: realizationVerification
    }]
  }), "utf8");
  const projectPath = path.join(output, "stale-project");
  await resolveProject(allowance, {
    outputDirectory: projectPath,
    configurationSelectionsPath,
    appliedIntentPath,
    completionScopePath
  });

  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.3",
    items: [{
      kind: "component",
      id: "allowance-acceptance",
      package: "org.seedspec.fixtures.comprehensive-application",
      component: "acceptance",
      selection: "subset",
      included_references: ["1"],
      verification: realizationVerification
    }]
  }), "utf8");
  await resolveProject(allowance, {
    outputDirectory: projectPath,
    configurationSelectionsPath,
    appliedIntentPath,
    completionScopePath
  });
  await assert.rejects(
    inspectProjectCompletion(projectPath),
    (error) => error.code === "STALE_VERIFICATION_STATE"
  );
});

test("all structured resolved state conforms to protocol schemas", async (t) => {
  const output = await temporaryDirectory(t);
  const result = await resolveProject(allowance, {
    featurePaths: [savings],
    outputDirectory: output
  });
  const validateProject = await compileProtocolSchema("project.schema.json");
  const validateLock = await compileProtocolSchema("lock.schema.json");
  const validateResolvedConfiguration = await compileProtocolSchema("resolved-config.schema.json");
  const validateResolvedIntent = await compileProtocolSchema("resolved-intent.schema.json");
  const validateComponentIndex = await compileProtocolSchema("component-index.schema.json");
  const validateTaskIndex = await compileProtocolSchema("task-index.schema.json");
  const validateArtifactIndex = await compileProtocolSchema("artifact-index.schema.json");
  const validateImplementationResourceIndex = await compileProtocolSchema(
    "implementation-resource-index.schema.json"
  );
  const validateImplementationResourceState = await compileProtocolSchema(
    "implementation-resource-state.schema.json"
  );
  const validateImplementationProfileState = await compileProtocolSchema(
    "implementation-profile-state.schema.json"
  );
  const validateCompletionScope = await compileProtocolSchema("completion-scope.schema.json");
  const validateVerificationState = await compileProtocolSchema("verification-state.schema.json");
  const project = parseYaml(await readFile(path.join(result.workspace, "project.yaml"), "utf8"));
  const lock = parseYaml(await readFile(path.join(result.workspace, "dependencies.lock.yaml"), "utf8"));
  const resolvedConfiguration = parseYaml(
    await readFile(path.join(result.workspace, "resolved-config.yaml"), "utf8")
  );
  const resolvedIntent = parseYaml(
    await readFile(path.join(result.workspace, "resolved-intent.yaml"), "utf8")
  );
  const artifactIndex = parseYaml(
    await readFile(path.join(result.workspace, "artifacts.yaml"), "utf8")
  );
  const implementationResourceIndex = parseYaml(
    await readFile(path.join(result.workspace, "implementation-resources.yaml"), "utf8")
  );
  const implementationResourceState = parseYaml(
    await readFile(path.join(result.workspace, "implementation-resource-state.yaml"), "utf8")
  );
  const implementationProfileState = parseYaml(
    await readFile(path.join(result.workspace, "implementation-profile-state.yaml"), "utf8")
  );
  const componentIndex = parseYaml(
    await readFile(path.join(result.workspace, "components.yaml"), "utf8")
  );
  const taskIndex = parseYaml(
    await readFile(path.join(result.workspace, "tasks.yaml"), "utf8")
  );
  const completionScope = parseYaml(
    await readFile(path.join(result.workspace, "completion-scope.yaml"), "utf8")
  );
  const verificationState = parseYaml(
    await readFile(path.join(result.workspace, "verification-state.yaml"), "utf8")
  );

  assert.equal(validateProject(project), true, formatSchemaErrors(validateProject.errors).join("\n"));
  assert.equal(validateLock(lock), true, formatSchemaErrors(validateLock.errors).join("\n"));
  assert.equal(
    validateResolvedConfiguration(resolvedConfiguration),
    true,
    formatSchemaErrors(validateResolvedConfiguration.errors).join("\n")
  );
  assert.equal(
    validateResolvedIntent(resolvedIntent),
    true,
    formatSchemaErrors(validateResolvedIntent.errors).join("\n")
  );
  assert.equal(
    validateComponentIndex(componentIndex),
    true,
    formatSchemaErrors(validateComponentIndex.errors).join("\n")
  );
  assert.equal(
    validateTaskIndex(taskIndex),
    true,
    formatSchemaErrors(validateTaskIndex.errors).join("\n")
  );
  assert.equal(
    validateCompletionScope(completionScope),
    true,
    formatSchemaErrors(validateCompletionScope.errors).join("\n")
  );
  assert.equal(
    validateVerificationState(verificationState),
    true,
    formatSchemaErrors(validateVerificationState.errors).join("\n")
  );
  assert.equal(
    validateArtifactIndex(artifactIndex),
    true,
    formatSchemaErrors(validateArtifactIndex.errors).join("\n")
  );
  assert.equal(
    validateImplementationResourceIndex(implementationResourceIndex),
    true,
    formatSchemaErrors(validateImplementationResourceIndex.errors).join("\n")
  );
  assert.equal(
    validateImplementationResourceState(implementationResourceState),
    true,
    formatSchemaErrors(validateImplementationResourceState.errors).join("\n")
  );
  assert.equal(
    validateImplementationProfileState(implementationProfileState),
    true,
    formatSchemaErrors(validateImplementationProfileState.errors).join("\n")
  );
});

test("init creates valid starter packages for every kind hint", async (t) => {
  const output = await temporaryDirectory(t);
  const kinds = [
    "solution",
    "application",
    "feature",
    "component",
    "workflow",
    "automation",
    "configuration",
    "integration"
  ];
  for (const kind of kinds) {
    const packagePath = path.join(output, kind);
    await initPackage(kind, packagePath);
    const record = await validatePackage(packagePath);
    assert.equal(record.manifest.kind, kind);
    assert.equal(record.manifest.definition.module, "primary-intent");
    assert.equal(record.manifest.context.modules[0].entrypoint, "seed.md");
    assert.equal(record.manifest.components.acceptance, "success.md");
    assert.match(record.definition, /## Seed/);
    assert.match(record.definition, /short honest seed is valid/);
    assert.match(await readFile(path.join(packagePath, "success.md"), "utf8"), /result that someone could observe/);
  }
});

test("preparation, author evaluation, publish checking, and packing form one headless lifecycle", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });

  const preparation = await preparePackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0"
  });
  assert.equal(preparation.preparation_version, "1");
  assert.equal(preparation.phase, "ready-to-pack");
  // Preparation reports readiness without starting work or changing the
  // author's coaching depth. Asking "am I ready?" must not open a review pass.
  assert.equal(preparation.review.current, null);
  await assert.rejects(
    readFile(path.join(stateDirectory, "passes", "0001-seed", "result.yaml"), "utf8"),
    (error) => error.code === "ENOENT"
  );

  const beforeReview = await publishCheckPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0"
  });
  assert.equal(beforeReview.ready, true);
  assert.equal(
    beforeReview.checks.find(({ id }) => id === "authoring-review").status,
    "advisory"
  );
  assert.equal(beforeReview.checks.find(({ id }) => id === "success-material").status, "passed");

  const evaluation = await createAuthorEvaluation(packagePath, {
    outputDirectory: path.join(output, "evaluations", "first"),
    toolVersion: "0.2.0"
  });
  assert.equal(evaluation.eval_harness_version, "1");
  assert.equal(evaluation.package.digest, preparation.package.digest);
  assert.match(await readFile(evaluation.paths.instructions, "utf8"), /fresh target workspace/u);

  const completed = await completeAuthoringReview(packagePath, stateDirectory);
  assert.equal(completed.complete, true);
  const ready = await publishCheckPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0"
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.inspection.inspection_version, "1");

  const first = await packPackage(packagePath, {
    outputDirectory: path.join(output, "release-one"),
    stateDirectory,
    toolVersion: "0.2.0"
  });
  const second = await packPackage(packagePath, {
    outputDirectory: path.join(output, "release-two"),
    stateDirectory,
    toolVersion: "0.2.0"
  });
  assert.equal(first.pack_receipt_version, "1");
  assert.equal(first.archive.digest, second.archive.digest);
  assert.equal(
    JSON.parse(await readFile(first.paths.receipt, "utf8")).package.digest,
    ready.package.digest
  );
  await assert.rejects(
    packPackage(packagePath, {
      outputDirectory: path.join(output, "release-one"),
      stateDirectory,
      toolVersion: "0.2.0"
    }),
    (error) => error.code === "PACK_OUTPUT_EXISTS"
  );
});

test("Protocol 0.3 rejects automatic migration from retired package shapes", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "old-package");
  await cp(savings, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const document = parseYaml(await readFile(manifestPath, "utf8"));
  document.protocol_version = "0.2";
  await writeFile(manifestPath, stringifyYaml(document), "utf8");

  await assert.rejects(
    upgradePackage(packagePath),
    (error) => error.code === "UNSUPPORTED_PROTOCOL_MIGRATION"
      && error.details.some((detail) => /clean cut/.test(detail))
  );
  assert.equal(parseYaml(await readFile(manifestPath, "utf8")).protocol_version, "0.2");
});

test("CLI validates and inspects the comprehensive application fixture", async () => {
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const version = await execFileAsync(process.execPath, [cli, "version", "--json"]);
  const shortVersion = await execFileAsync(process.execPath, [cli, "--version"]);
  const doctor = await execFileAsync(process.execPath, [cli, "doctor", "--json"]);
  const implementingDocs = await execFileAsync(process.execPath, [cli, "docs", "implementing"]);
  const validation = await execFileAsync(process.execPath, [cli, "validate", allowance]);
  const prompt = await execFileAsync(process.execPath, [cli, "prompt"]);
  const beginning = await execFileAsync(process.execPath, [cli, "begin", allowance]);
  const inspection = await execFileAsync(process.execPath, [cli, "inspect", savings]);
  const lint = await execFileAsync(process.execPath, [cli, "lint", hubspotMetric]);
  const artifacts = await execFileAsync(process.execPath, [cli, "artifacts", allowance]);
  const adapters = await execFileAsync(process.execPath, [cli, "context", "adapters"]);
  const authoringWorkspace = await execFileAsync(process.execPath, [
    cli,
    "author",
    "status",
    allowance,
    "--json"
  ]);
  const capabilityConformance = await execFileAsync(process.execPath, [
    cli,
    "capability-conformance",
    allowance,
    "org.seedspec.core.chores"
  ]);
  const discovery = await execFileAsync(process.execPath, [
    cli,
    "discover-features",
    allowance,
    "--catalog",
    path.join(root, "conformance/fixtures")
  ]);

  const versionInfo = JSON.parse(version.stdout);
  assert.equal(versionInfo.protocol_version, "0.3");
  assert.equal(versionInfo.conformance_suite_version, "0.3.1");
  assert.equal(versionInfo.cli_version, "0.3.1");
  assert.equal(shortVersion.stdout.trim(), versionInfo.cli_version);
  assert.equal(JSON.parse(doctor.stdout).status, "healthy");
  assert.match(implementingDocs.stdout, /Resolution is offline and atomic/);
  assert.match(validation.stdout, /Valid SeedSpec package: org\.seedspec\.fixtures\.comprehensive-application/);
  assert.match(validation.stdout, /Kind hint: application/);
  assert.match(prompt.stdout, /Implement this SeedSpec with me/);
  assert.match(beginning.stdout, /Do not begin implementation yet/);
  assert.match(beginning.stdout, /CONFIGURATION_EXAMPLE_REQUIRES_REVIEW/);
  assert.match(beginning.stdout, /Discovery does not activate supporting material/);
  assert.match(inspection.stdout, /Requires: org\.seedspec\.core\.actors \(tested against 1\.0\.0\)/);
  assert.match(lint.stdout, /Source-bound authoring review: Profiled Workflow Fixture/);
  assert.match(lint.stdout, /Kind hint: workflow/);
  assert.match(inspection.stdout, /Components: acceptance, integration/);
  assert.match(artifacts.stdout, /org\.example\.artifact\.reference-markdown/);
  assert.doesNotMatch(artifacts.stdout, /Intent role/);
  assert.match(adapters.stdout, /Registered context adapters: none/);
  const authoringSnapshot = JSON.parse(authoringWorkspace.stdout);
  assert.equal(authoringSnapshot.authoring_workspace_snapshot_version, "1");
  assert.equal(authoringSnapshot.package.status, "valid");
  assert.equal(authoringSnapshot.review.status, "not-created");
  assert.doesNotMatch(authoringWorkspace.stdout, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(capabilityConformance.stdout, /Conformance status: not-evaluated/);
  assert.match(capabilityConformance.stdout, /Declared suite coverage: partial/);
  assert.match(discovery.stdout, /Portable Feature Fixture.*candidate/);
});

test("CLI executes the complete context integration lifecycle", async (t) => {
  const output = await temporaryDirectory(t);
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const contextPackage = path.join(root, "conformance/fixtures/context-modules");
  const project = path.join(output, "project");
  const prepared = path.join(output, "prepared-context");

  await execFileAsync(process.execPath, [
    cli,
    "resolve",
    contextPackage,
    "--output",
    project
  ]);
  const discovery = await execFileAsync(process.execPath, [
    cli,
    "context",
    "discover",
    contextPackage,
    "--integration",
    contextIntegration,
    "--json"
  ]);
  const validation = await execFileAsync(process.execPath, [
    cli,
    "context",
    "validate",
    contextPackage,
    "refund-safety",
    "--integration",
    contextIntegration,
    "--json"
  ]);
  const preparation = await execFileAsync(process.execPath, [
    cli,
    "context",
    "prepare",
    project,
    "--request",
    contextRequest,
    "--output",
    prepared,
    "--integration",
    contextIntegration,
    "--json"
  ]);
  const usage = await execFileAsync(process.execPath, [
    cli,
    "context",
    "record-use",
    prepared,
    "--input",
    contextUse,
    "--json"
  ]);

  assert.equal(
    JSON.parse(discovery.stdout).modules.find((module) => module.module === "refund-safety")
      .compatible.length,
    1
  );
  assert.equal(JSON.parse(validation.stdout).valid, true);
  assert.equal(
    JSON.parse(preparation.stdout).bundle.modules.some(
      (module) => module.mechanism.kind === "native-adapter"
    ),
    true
  );
  assert.equal(JSON.parse(usage.stdout).subject.modules.length, 2);
});

test("installation doctor verifies the exact release and bundled suite", async () => {
  const result = await inspectInstallation({
    cliVersion: "0.3.1"
  });
  assert.equal(result.status, "healthy");
  assert.equal(result.protocol_release.id, "0.3.1");
  assert.ok(result.checks.every((check) => check.status === "passed"));
  assert.ok(result.checks.some((check) => check.id === "offline-smoke-test"));
});

test("CLI review emits source-bound agent instructions, status, and bundled documentation", async (t) => {
  const output = await temporaryDirectory(t);
  const stateDirectory = path.join(output, "authoring-state");
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const audit = await execFileAsync(process.execPath, [
    cli,
    "review",
    hubspotMetric,
    "--area",
    "coherence",
    "--target",
    "harden",
    "--state",
    stateDirectory
  ]);
  const status = await execFileAsync(process.execPath, [
    cli,
    "review",
    hubspotMetric,
    "--state",
    stateDirectory,
    "--status"
  ]);
  const docs = await execFileAsync(process.execPath, [
    cli,
    "docs",
    "authoring",
    "coherence"
  ]);

  assert.match(audit.stdout, /Tool version: `0\.3\.1`/);
  assert.match(audit.stdout, /Internal focus: 2 of 4 — Coherence/);
  assert.match(audit.stdout, /Absence is not a gap/);
  assert.match(audit.stdout, /This pass was opened for one explicit area/u);
  assert.match(audit.stdout, /Do not reopen the same area unless the author asks/u);
  assert.doesNotMatch(audit.stdout, /Internal review progress:/);
  assert.match(status.stdout, /2\. Coherence — in-progress/);
  assert.doesNotMatch(status.stdout, /## Area objective/);
  assert.match(docs.stdout, /SeedSpec CLI: 0\.3\.1/);
  assert.match(docs.stdout, /Coherence objective/);
});

test("CLI creates an authoring workspace around an empty draft", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "empty-draft");
  const stateDirectory = path.join(output, "authoring-state");
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const created = await execFileAsync(process.execPath, [
    cli,
    "author",
    "create",
    packagePath,
    "--target",
    "minimal",
    "--state",
    stateDirectory,
    "--json"
  ]);
  const result = JSON.parse(created.stdout);
  assert.equal(result.authoring_workspace_operation_version, "1");
  assert.equal(result.created, true);
  assert.equal(result.snapshot.package.status, "invalid");
  assert.equal(result.snapshot.review.target, "minimal");
  assert.doesNotMatch(created.stdout, new RegExp(output.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
});

test("CLI -i records a preferred implementation profile", async (t) => {
  const output = await temporaryDirectory(t);
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const appliedIntentPath = await writeAffirmedAppliedIntent(output, [hubspotMetric]);
  const result = await execFileAsync(process.execPath, [
    cli,
    "resolve",
    hubspotMetric,
    "-i",
    "hubspot-native",
    "--configuration-selections",
    path.join(fixtures, "profiled-workflow-configuration-selection.yaml"),
    "--applied-intent",
    appliedIntentPath,
    "--output",
    output
  ]);
  const profileState = parseYaml(await readFile(
    path.join(output, ".seedspec/implementation-profile-state.yaml"),
    "utf8"
  ));

  assert.match(result.stdout, /Project status: ready/);
  assert.equal(profileState.packages[0].preferred_profile, "hubspot-native");
});

test("CLI lists, resolves, and records implementation resource use", async (t) => {
  const fixture = await createImplementationResourcePackage(t, {
    includeCanonical: false
  });
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const projectPath = path.join(fixture.output, "project");
  await resolveProject(fixture.packagePath, { outputDirectory: projectPath });

  const listing = await execFileAsync(process.execPath, [
    cli,
    "resources",
    fixture.packagePath
  ]);
  const digest = await execFileAsync(process.execPath, [
    cli,
    "resource-digest",
    fixture.resourcePath
  ]);
  const resolution = await execFileAsync(process.execPath, [
    cli,
    "resolve-resources",
    projectPath
  ]);
  const usage = await execFileAsync(process.execPath, [
    cli,
    "record-resource-use",
    projectPath,
    "org.seedspec.fixtures.comprehensive-application",
    "org.seedspec.guidance.authorization-decisions",
    "consulted",
    "--reason",
    "Relevant test fixture"
  ]);

  assert.match(listing.stdout, /authorization-decisions.*recommended/);
  assert.equal(digest.stdout.trim(), fixture.digest);
  assert.match(resolution.stdout, /authorization-decisions: bundled/);
  assert.match(resolution.stdout, /Skill entrypoint: .*\/resolved\/SKILL\.md/);
  assert.match(usage.stdout, /consulted.*Relevant test fixture/);
});

test("CLI failures expose stable protocol error codes", async () => {
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  await assert.rejects(
    execFileAsync(process.execPath, [
      cli,
      "validate",
      path.join(fixtures, "missing-definition")
    ]),
    (error) => /\[INVALID_CONTEXT_MODULE\]/.test(error.stderr)
  );
  await assert.rejects(
    execFileAsync(process.execPath, [
      cli,
      "resolve",
      allowance,
      "--config",
      path.join(fixtures, "invalid-allowance-config.yaml")
    ]),
    (error) => /Unknown option --config/.test(error.stderr)
  );
});

test("publisher extensions are accepted and visible without becoming core fields", async () => {
  const inspection = await inspectPackage(allowance);
  assert.deepEqual(inspection.extensions, {
    "org.seedspec.fixtures.catalog": { audience: "families" }
  });
});

test("package digest is stable, content-sensitive, and locked into resolution", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "allowance-copy");
  await cp(allowance, packagePath, { recursive: true });
  const first = await validatePackage(packagePath);
  const second = await validatePackage(packagePath);
  assert.equal(first.digest, second.digest);

  const definitionPath = path.join(packagePath, "definition/app.md");
  const source = await readFile(definitionPath, "utf8");
  await writeFile(definitionPath, `${source}\n`, "utf8");
  const changed = await validatePackage(packagePath);
  assert.notEqual(changed.digest, first.digest);

  const resolved = await resolveProject(packagePath, { outputDirectory: output });
  assert.equal(resolved.lock.root.digest, changed.digest);
});

test("packages containing symbolic links are rejected", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "unsafe-package");
  await cp(allowance, packagePath, { recursive: true });
  await symlink(path.join(packagePath, "definition/app.md"), path.join(packagePath, "linked-definition.md"));

  await assert.rejects(
    validatePackage(packagePath),
    (error) => error.code === "UNSAFE_PACKAGE_CONTENT"
  );
});

test("a dependency lock verifies exact package bytes and declaration analysis", async (t) => {
  const output = await temporaryDirectory(t);
  const result = await resolveProject(allowance, {
    featurePaths: [savings],
    outputDirectory: output
  });
  const verified = await verifyProjectLock(output, [savings, allowance]);
  assert.deepEqual(verified.verifiedPackages, [
    "org.seedspec.fixtures.comprehensive-application",
    "org.seedspec.fixtures.portable-feature"
  ]);
  assert.equal(
    verified.verifiedCapabilityDeclarations.length,
    result.lock.capabilities.length
  );

  const changedFeature = path.join(output, "changed-savings");
  await cp(savings, changedFeature, { recursive: true });
  const definitionPath = path.join(changedFeature, "definition/feature.md");
  await writeFile(
    definitionPath,
    `${await readFile(definitionPath, "utf8")}\n`,
    "utf8"
  );
  await assert.rejects(
    verifyProjectLock(output, [allowance, changedFeature]),
    (error) => error.code === "LOCK_PACKAGE_MISMATCH"
  );
});

test("0.3 conformance suite passes every declared case", async () => {
  const result = await runConformanceSuite(path.join(root, "conformance/cases.yaml"));
  assert.equal(result.suite.version, conformanceSuiteVersion);
  assert.equal(result.status, "conformant");
  assert.equal(result.totals.failed, 0, JSON.stringify(result.results.filter((item) => item.status === "failed"), null, 2));
  assert.ok(result.totals.total >= 15);
});

test("conformance suites cannot reference fixtures outside their directory", async (t) => {
  const output = await temporaryDirectory(t);
  const suiteDirectory = path.join(output, "suite");
  const outsidePackage = path.join(output, "outside-package");
  await mkdir(suiteDirectory, { recursive: true });
  await cp(allowance, outsidePackage, { recursive: true });
  const indexPath = path.join(suiteDirectory, "cases.yaml");
  await writeFile(indexPath, stringifyYaml({
    suite_version: "0.3.0",
    protocol_version: "0.3",
    cases: [{
      id: "outside-fixture",
      operation: "validate",
      package: "../outside-package",
      expect: { result: "pass" }
    }]
  }), "utf8");

  await assert.rejects(
    runConformanceSuite(indexPath),
    (error) => error.code === "INVALID_CONFORMANCE_SUITE"
  );
});

test("historical authoring passes stay readable and never block a command", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });

  // Open a pass, then corrupt its result the way a hand-editing agent does.
  const opened = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });
  await writeFile(opened.current.result, "authoring_result_version: \"9.9\"\nthis: [is, broken\n", "utf8");

  // Every read surface must survive it rather than throwing INVALID_AUTHORING_RESULT.
  const status = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0",
    statusOnly: true
  });
  assert.equal(status.passes[0].outcome, "unreadable");
  assert.ok(status.notices.some(({ code }) => code === "AUTHORING_PASS_UNREADABLE"));

  // And review recovers by opening fresh work instead of dead-ending.
  const recovered = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });
  assert.equal(recovered.current.area, "seed");
  assert.notEqual(recovered.current.id, opened.current.id);
});

test("editing a package after review is advisory, not a blocked command", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });

  await completeAuthoringReview(packagePath, stateDirectory);
  await writeFile(
    path.join(packagePath, "definition", "feature.md"),
    `${await readFile(path.join(packagePath, "definition", "feature.md"), "utf8")}\n\nA later clarification.\n`,
    "utf8"
  );

  const after = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0",
    statusOnly: true
  });
  const stale = after.notices.find(({ code }) => code === "AUTHORING_REVIEW_STALE");
  assert.ok(stale, "changing a reviewed package should report staleness");
  assert.equal(stale.severity, "advisory");

  // Publishing must remain possible; guided review is advisory for packing.
  const check = await publishCheckPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });
  assert.equal(check.ready, true);
});

test("the authoring result contract is published rather than implied", async () => {
  const schema = await readAuthoringSchema("result");
  assert.equal(schema.$id, "https://seedspec.dev/schemas/authoring/v1/authoring-pass-result.schema.json");
  for (const field of ["outcome", "disposition", "summary", "questions", "changes", "validation"]) {
    assert.ok(schema.properties[field], `${field} must be documented`);
  }
  assert.deepEqual(
    schema.properties.disposition.enum,
    ["pending", "improved", "good-enough", "not-relevant"]
  );
  await assert.rejects(
    readAuthoringSchema("nope"),
    (error) => error.code === "UNKNOWN_AUTHORING_SCHEMA"
  );
});

test("recorded questions reach every surface that reads them", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

  const recorded = await recordObservations(packagePath, {
    stateRoot: stateDirectory,
    entries: [
      { type: "question", question: "Should a closed goal be reopenable?", source: "definition/feature.md" },
      { type: "finding", source: "definition/feature.md", assessment: "Completion funds appear twice." }
    ]
  });
  assert.equal(recorded.recorded.length, 2);
  assert.ok(recorded.recorded.every(({ id }) => typeof id === "string" && id.length > 0));

  // The brief used to direct questions into the pass result while every read
  // surface looked at open-questions.yaml, so questions were never visible.
  const snapshot = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(snapshot.review.questions.open, 1);
  const audit = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0",
    statusOnly: true
  });
  assert.equal(audit.questions.open, 1);

  const questionId = recorded.recorded.find(({ type }) => type === "question").id;
  const answered = await answerQuestion(packagePath, {
    stateRoot: stateDirectory,
    questionId,
    answer: "No. A closed goal stays closed."
  });
  assert.equal(answered.question.status, "resolved");
  const afterAnswer = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(afterAnswer.review.questions.open, 0);
  assert.equal(afterAnswer.review.questions.resolved, 1);
});

test("a question the author does not own closes without misreporting authority", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

  const recorded = await recordObservations(packagePath, {
    stateRoot: stateDirectory,
    entries: [{ type: "question", question: "Which engine operation may be mechanical?" }]
  });
  const questionId = recorded.recorded[0].id;
  const routed = await answerQuestion(packagePath, {
    stateRoot: stateDirectory,
    questionId,
    answer: "The engine has no contract for this yet.",
    resolution: "routed-to-platform"
  });
  assert.equal(routed.question.status, "routed-to-platform");
  assert.ok(routed.changed.some(({ kind }) => kind === "platform-feedback"));

  const feedback = parseYaml(
    await readFile(path.join(stateDirectory, "platform-feedback.yaml"), "utf8")
  );
  assert.equal(feedback.feedback.length, 1);
  assert.equal(feedback.feedback[0].status, "open");
});

test("closing a thread records evidence the engine produced itself", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  const opened = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

  const closed = await reviewArea(packagePath, {
    stateRoot: stateDirectory,
    summary: "Author confirmed closed goals are final.",
    disposition: "improved"
  });
  assert.equal(closed.reviewed.pass, opened.current.id);
  assert.equal(closed.reviewed.disposition, "improved");

  // The digest is computed, never transcribed by the agent.
  const result = parseYaml(await readFile(opened.current.result, "utf8"));
  assert.match(result.package_digest_after, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.package_digest_after, closed.reviewed.package.digest);
  for (const operation of ["validate", "lint", "digest"]) {
    assert.ok(
      result.validation.commands.some((command) => command.includes(`seedspec ${operation} `)),
      `${operation} must be recorded`
    );
  }

  // And the thread actually advances.
  const next = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });
  assert.notEqual(next.current.area, "seed");
});

test("a success review cannot close while observable success is still a placeholder", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await initPackage("workflow", packagePath);
  const opened = await auditPackage(packagePath, {
    area: "success",
    stateDirectory,
    toolVersion: "0.3.0"
  });

  assert.match(opened.current.instructions, /If the confirmed meaning is absent from the document, propose exact replacement wording/u);
  await assert.rejects(
    reviewArea(packagePath, {
      stateRoot: stateDirectory,
      summary: "The author defined an observable result in conversation.",
      disposition: "improved"
    }),
    (error) => error.code === "AUTHORING_SUCCESS_MATERIAL_REQUIRED"
  );
  const snapshot = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(snapshot.review.current.area, "success");
  assert.equal(snapshot.review.current.outcome, "in-progress");
});

test("attached sources become review context instead of an unwritable file", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

  const attached = await attachSource(packagePath, {
    stateRoot: stateDirectory,
    source: {
      kind: "document",
      authority: "author",
      location: "notes/allocation-policy.md",
      summary: "How the finance team describes reserved balances"
    }
  });
  assert.ok(attached.source.id);

  // sources.yaml has been read by the brief since the beginning and written by
  // nothing; the attached source must now appear in the review context.
  const refreshed = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });
  assert.match(refreshed.current.instructions, /notes\/allocation-policy\.md/);
  assert.doesNotMatch(refreshed.current.instructions, /Active attached sources: none/);
  assert.match(refreshed.current.instructions, /author guidance --topic requirements/u);

  await assert.rejects(
    attachSource(packagePath, {
      stateRoot: stateDirectory,
      source: { kind: "document", authority: "author" }
    }),
    (error) => error.code === "INVALID_AUTHORING_INPUT"
  );
});

test("accepted clarification meaning reaches package bytes through the existing change gate", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(ambiguousAuthoring, packagePath, { recursive: true });
  const opened = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });
  const documentPath = path.join(packagePath, "definition", "workflow.md");
  const beforeContent = await readFile(documentPath, "utf8");
  const before = await inspectAuthoringWorkspace(packagePath, { stateDirectory });

  await assert.rejects(
    recordClarificationCandidate(packagePath, {
      stateRoot: stateDirectory,
      expectedRevision: before.workspace.revision,
      candidate: {
        issue: "The source permits two delivery routes.",
        alternatives: ["Email", "Team channel"],
        basis: {
          source_claims: [{
            reference: "definition/workflow.md",
            statement: "Send the summary each Friday."
          }],
          inference: "The source does not identify the delivery route."
        },
        affected: ["operations"]
      }
    }),
    (error) => error.code === "INVALID_AUTHORING_INPUT"
      && error.details.some((detail) => detail.includes("supported: outcome, architecture"))
  );

  const recorded = await recordClarificationCandidate(packagePath, {
    stateRoot: stateDirectory,
    expectedRevision: before.workspace.revision,
    candidate: {
      kind: "clarification",
      issue: "The source permits two delivery routes for the weekly summary.",
      alternatives: ["Deliver by email", "Deliver through a team channel"],
      assumed_default: "Deliver by email",
      basis: {
        actor: "authoring-agent",
        source_claims: [{
          reference: "definition/workflow.md",
          statement: "Send the summary each Friday."
        }],
        inference: "The source does not identify the delivery route."
      },
      materiality: "material",
      affected: ["architecture", "resources", "verification"],
      recommended_disposition: "ask"
    }
  });
  assert.equal(recorded.candidate.status, "open");
  assert.equal(recorded.candidate.pass, opened.current.id);
  assert.match(recorded.candidate.id, /^candidate-[0-9a-f-]{36}$/u);
  assert.equal(await readFile(documentPath, "utf8"), beforeContent);
  const recordedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(recordedStatus.review.candidates.open, 1);
  assert.equal(recordedStatus.review.candidates.items[0].basis.source_claims.length, 1);
  assert.equal(recorded.snapshot, undefined);

  await assert.rejects(
    reviewArea(packagePath, {
      stateRoot: stateDirectory,
      summary: "The author reviewed closure behavior.",
      disposition: "good-enough"
    }),
    (error) => error.code === "AUTHORING_CANDIDATE_PENDING"
  );

  const accepted = await decideClarificationCandidate(packagePath, {
    stateRoot: stateDirectory,
    expectedRevision: recorded.workspace.revision,
    candidateId: recorded.candidate.id,
    decision: "accept",
    meaning: "Deliver the weekly summary by email.",
    rationale: "Team leads use email for project reporting."
  });
  assert.equal(accepted.candidate.status, "accepted");
  assert.equal(accepted.candidate.disposition.by, "author");
  assert.equal(await readFile(documentPath, "utf8"), beforeContent);

  const blockedPublish = await publishCheckPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0"
  });
  assert.equal(blockedPublish.ready, false);
  assert.equal(
    blockedPublish.checks.find(({ id }) => id === "accepted-clarification-meaning").status,
    "failed"
  );

  await assert.rejects(
    proposeDocumentChange(packagePath, {
      stateRoot: stateDirectory,
      proposal: {
        path: "definition/workflow.md",
        summary: "Use the accepted email delivery route",
        content: `${beforeContent}\n\nDeliver the weekly summary by email.\n`,
        basis: { kind: "agent-proposal", references: [recorded.candidate.id] }
      }
    }),
    (error) => error.code === "AUTHORING_CANDIDATE_AUTHORITY_MISMATCH"
  );

  const proposed = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "definition/workflow.md",
      summary: "Use the accepted email delivery route",
      content: `${beforeContent}\n\nDeliver the weekly summary by email.\n`,
      basis: { kind: "author-answer", references: [recorded.candidate.id] }
    }
  });
  const proposedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  const linked = proposedStatus.review.candidates.items.find(
    ({ id }) => id === recorded.candidate.id
  );
  assert.deepEqual(linked.proposal_ids, [proposed.proposal.id]);

  const proposalAccepted = await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposed.proposal.id,
    decision: "accept"
  });
  await applyDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposalAccepted.proposal.id
  });
  assert.equal(await readFile(documentPath, "utf8"), `${beforeContent}\n\nDeliver the weekly summary by email.\n`);

  const acceptancePath = path.join(packagePath, "acceptance.md");
  const acceptanceBefore = await readFile(acceptancePath, "utf8");
  const coordinated = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "acceptance.md",
      summary: "Observe the accepted email delivery route",
      content: `${acceptanceBefore}\nThe Friday summary is delivered by email.\n`,
      basis: { kind: "author-answer", references: [recorded.candidate.id] }
    }
  });
  const coordinatedAccepted = await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: coordinated.proposal.id,
    decision: "accept"
  });
  await applyDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: coordinatedAccepted.proposal.id
  });
  assert.equal(
    await readFile(acceptancePath, "utf8"),
    `${acceptanceBefore}\nThe Friday summary is delivered by email.\n`
  );

  const ready = await publishCheckPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0"
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.review.accepted_unapplied_candidates, 0);
  const afterApply = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(afterApply.review.candidates.stale, 0);
  assert.deepEqual(
    afterApply.review.candidates.items.find(({ id }) => id === recorded.candidate.id).proposal_ids,
    [proposed.proposal.id, coordinated.proposal.id]
  );

  const closed = await reviewArea(packagePath, {
    stateRoot: stateDirectory,
    summary: "Weekly summaries use email delivery.",
    disposition: "improved"
  });
  assert.equal(closed.reviewed.pass, opened.current.id);

  const ledger = parseYaml(
    await readFile(path.join(stateDirectory, "candidates", "index.yaml"), "utf8")
  );
  const validateLedger = compileConfigurationSchema(await readAuthoringSchema("candidates"));
  assert.equal(validateLedger(ledger), true, formatSchemaErrors(validateLedger.errors).join("\n"));
  assert.equal(ledger.authoring_candidates_version, AUTHORING_CANDIDATE_FORMAT);
});

test("stale clarification candidates cannot add intent and can still be declined", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(ambiguousAuthoring, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });

  const recorded = await recordClarificationCandidate(packagePath, {
    stateRoot: stateDirectory,
    candidate: {
      issue: "The source permits two delivery routes.",
      alternatives: ["Email", "Team channel"],
      assumed_default: "Email",
      basis: {
        actor: "receiving-model",
        source_claims: [{
          reference: "definition/workflow.md",
          statement: "Send the summary each Friday."
        }],
        inference: "The delivery route is unspecified."
      },
      materiality: "material",
      affected: ["architecture"],
      recommended_disposition: "ask"
    }
  });
  const documentPath = path.join(packagePath, "definition", "workflow.md");
  const content = await readFile(documentPath, "utf8");
  await writeFile(documentPath, `${content}\n\nThe author independently clarified another point.\n`, "utf8");

  await assert.rejects(
    decideClarificationCandidate(packagePath, {
      stateRoot: stateDirectory,
      candidateId: recorded.candidate.id,
      decision: "accept",
      meaning: "Deliver by email."
    }),
    (error) => error.code === "AUTHORING_CANDIDATE_STALE"
  );

  const declined = await decideClarificationCandidate(packagePath, {
    stateRoot: stateDirectory,
    candidateId: recorded.candidate.id,
    decision: "decline",
    rationale: "The changed source makes this question obsolete."
  });
  assert.equal(declined.candidate.status, "declined");
  const snapshot = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(snapshot.review.candidates.open, 0);
  assert.equal(snapshot.review.candidates.stale, 1);

  await reviewArea(packagePath, {
    stateRoot: stateDirectory,
    summary: "The stale delivery question was declined.",
    disposition: "good-enough"
  });
  const publish = await publishCheckPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0"
  });
  assert.equal(publish.ready, true);
});

test("accepted meaning reuse requires an unchanged applied document anchor", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(ambiguousAuthoring, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });

  const recorded = await recordClarificationCandidate(packagePath, {
    stateRoot: stateDirectory,
    candidate: {
      issue: "The weekly summary has no delivery route.",
      alternatives: ["Email", "Team channel"],
      assumed_default: "Email",
      basis: {
        source_claims: [{
          reference: "definition/workflow.md",
          statement: "Send the summary each Friday."
        }],
        inference: "The route changes observable delivery behavior."
      }
    }
  });
  await decideClarificationCandidate(packagePath, {
    stateRoot: stateDirectory,
    candidateId: recorded.candidate.id,
    decision: "accept",
    meaning: "Deliver the weekly summary by email."
  });

  const workflowPath = path.join(packagePath, "definition", "workflow.md");
  const workflowBefore = await readFile(workflowPath, "utf8");
  const proposed = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "definition/workflow.md",
      summary: "Apply the accepted route",
      content: `${workflowBefore}\n\nDeliver the weekly summary by email.\n`,
      basis: { kind: "author-answer", references: [recorded.candidate.id] }
    }
  });
  await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposed.proposal.id,
    decision: "accept"
  });
  await applyDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposed.proposal.id
  });

  await writeFile(
    workflowPath,
    `${workflowBefore}\n\nThe delivery route is unresolved again.\n`,
    "utf8"
  );
  const acceptanceBefore = await readFile(path.join(packagePath, "acceptance.md"), "utf8");
  await assert.rejects(
    proposeDocumentChange(packagePath, {
      stateRoot: stateDirectory,
      proposal: {
        path: "acceptance.md",
        summary: "Reuse meaning after its anchor changed",
        content: `${acceptanceBefore}\nThe summary arrives by email.\n`,
        basis: { kind: "author-answer", references: [recorded.candidate.id] }
      }
    }),
    (error) => (
      error.code === "AUTHORING_CANDIDATE_STALE"
      && error.details.includes("No unchanged applied document currently anchors this accepted meaning.")
    )
  );
});

test("authoring probe fixtures separate ambiguity from explicit delegated variation", async () => {
  const [ambiguous, delegated] = await Promise.all([
    validatePackage(ambiguousAuthoring),
    validatePackage(delegatedAuthoring)
  ]);
  const ambiguousIntent = await readFile(
    path.join(ambiguousAuthoring, "definition", "workflow.md"),
    "utf8"
  );
  const delegatedIntent = await readFile(
    path.join(delegatedAuthoring, "definition", "workflow.md"),
    "utf8"
  );
  assert.equal(ambiguous.manifest.kind, "workflow");
  assert.equal(delegated.manifest.kind, "workflow");
  assert.match(ambiguousIntent, /Send the summary each Friday/u);
  assert.doesNotMatch(ambiguousIntent, /email or a team channel/u);
  assert.match(delegatedIntent, /email or a team channel/u);
  assert.match(delegatedIntent, /implementation may select either route/u);
});

function clarificationProbeConfiguration() {
  return {
    model: { provider: "anthropic", id: "claude-sonnet-5" },
    runner: {
      id: "claude-code-cli",
      version: "2.0.64",
      enforces_output_token_limit: false,
      enforces_spend_limit: false
    },
    settings: { effort: "medium", tools: [] },
    limits: {
      model_context_tokens: 1_000_000,
      max_input_tokens: 10_000,
      max_output_tokens: 4_000,
      max_attempts: 1,
      max_retries: 0,
      max_duration_ms: 120_000,
      max_spend_usd: 0.25
    },
    pricing: {
      currency: "USD",
      basis: "subscription-list-price-equivalent",
      input_per_million_usd: 2,
      output_per_million_usd: 10,
      source: "https://www.anthropic.com/claude/sonnet",
      observed_at: "2026-08-03T12:00:00.000Z"
    }
  };
}

async function writeProbeExecution(bundle, brief, runId, result) {
  await Promise.all([
    writeFile(path.join(bundle, "probe-execution.json"), `${JSON.stringify({
      authoring_probe_execution_version: "1",
      run_id: runId,
      brief_id: brief.id,
      provider: "anthropic",
      requested_model: "claude-sonnet-5",
      served_model: "claude-sonnet-5",
      runner: { id: "claude-code-cli", version: "2.0.64" },
      status: "succeeded",
      attempt: 1,
      retry: false,
      tools: [],
      started_at: "2026-08-03T12:01:00.000Z",
      finished_at: "2026-08-03T12:01:03.000Z",
      usage: {
        capture: "provider-reported",
        input_tokens: 1800,
        cached_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 240,
        total_tokens: 2040,
        cost_usd: 0.006
      },
      limitations: ["The runner did not enforce an output-token stop."]
    }, null, 2)}\n`, "utf8"),
    writeFile(path.join(bundle, "probe-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8"),
    writeFile(path.join(bundle, "raw-response.txt"), `${JSON.stringify(result)}\n`, "utf8")
  ]);
}

test("a frozen probe records one candidate occurrence without a comparison claim", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  const bundle = path.join(output, "probe-bundle");
  await cp(ambiguousAuthoring, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });
  const before = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  const prepared = await prepareClarificationProbe(packagePath, {
    stateRoot: stateDirectory,
    outputDirectory: bundle,
    probe: clarificationProbeConfiguration(),
    expectedRevision: before.workspace.revision,
    now: () => "2026-08-03T12:00:00.000Z"
  });
  assert.equal(prepared.brief.preflight.status, "ready");
  assert.equal(prepared.brief.execution.permitted_tools.length, 0);
  assert.equal(prepared.brief.budget.limits.max_attempts, 1);
  assert.equal(prepared.brief.visibility.no_authoritative_material_silently_truncated, true);
  const transportSchema = JSON.parse(
    await readFile(path.join(bundle, "result.schema.json"), "utf8")
  );
  assert.deepEqual(
    transportSchema.properties.authoring_probe_result_version,
    {
      type: "string",
      enum: ["1"],
      description: 'The JSON string "1", not a number.'
    }
  );
  assert.deepEqual(
    transportSchema.properties.candidate.anyOf[1].required,
    [
      "kind",
      "issue",
      "question",
      "alternatives",
      "assumed_default",
      "materiality",
      "affected",
      "recommended_disposition"
    ]
  );
  assert.equal(
    (await inspectAuthoringWorkspace(packagePath, { stateDirectory })).workspace.revision,
    before.workspace.revision,
    "preparing an external frozen bundle must not mutate authoring state"
  );
  const preflight = await verifyClarificationProbe(packagePath, {
    stateRoot: stateDirectory,
    bundleDirectory: bundle
  });
  assert.equal(preflight.ready, true);
  await writeProbeExecution(bundle, prepared.brief, "run-ambiguous-delivery-1", {
    authoring_probe_result_version: "1",
    outcome: "candidate",
    interpretation: "Prepare and deliver one summary to each team lead every Friday.",
    materially_different_interpretations: [
      "Send the summary by email.",
      "Post the summary in a team channel."
    ],
    source_claims: [{
      reference: "package:definition/workflow.md",
      statement: "The workflow says to send the summary each Friday."
    }],
    inference: "The delivery route is unspecified and changes the integration and operational setup.",
    candidate: {
      kind: "clarification",
      issue: "The delivery route is not established.",
      question: "Should each weekly summary be delivered by email or through a team channel?",
      alternatives: ["Email", "Team channel"],
      assumed_default: "Email",
      materiality: "material",
      affected: ["architecture", "configuration", "operational-ownership"],
      recommended_disposition: "ask"
    },
    no_action: null
  });
  const recorded = await recordClarificationProbeRun(packagePath, {
    stateRoot: stateDirectory,
    bundleDirectory: bundle,
    expectedRevision: before.workspace.revision,
    now: () => "2026-08-03T12:02:00.000Z"
  });
  assert.equal(recorded.run.outcome, "candidate");
  assert.match(recorded.run.occurrence_id, /^occurrence-/u);
  assert.deepEqual(recorded.run.comparison_group_ids, []);
  const recordedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  const retainedCandidate = recordedStatus.review.candidates.items[0];
  assert.equal(retainedCandidate.occurrence.id, recorded.run.occurrence_id);
  assert.deepEqual(retainedCandidate.occurrence.comparison_group_ids, []);
  assert.equal(recordedStatus.review.probes.candidates, 1);
  assert.equal(recordedStatus.review.candidates.open, 1);
  assert.equal(recorded.snapshot, undefined);

  const briefSchema = compileConfigurationSchema(await readAuthoringSchema("probe-brief"));
  assert.equal(briefSchema(prepared.brief), true, formatSchemaErrors(briefSchema.errors).join("\n"));
  const resultSchema = compileConfigurationSchema(await readAuthoringSchema("probe-result"));
  const result = JSON.parse(await readFile(path.join(bundle, "probe-result.json"), "utf8"));
  assert.equal(resultSchema(result), true, formatSchemaErrors(resultSchema.errors).join("\n"));
  const runSchema = compileConfigurationSchema(await readAuthoringSchema("probe-runs"));
  const runs = parseYaml(await readFile(path.join(stateDirectory, "probes", "index.yaml"), "utf8"));
  assert.equal(runSchema(runs), true, formatSchemaErrors(runSchema.errors).join("\n"));
  assert.equal(runs.authoring_probe_runs_version, AUTHORING_PROBE_RUN_FORMAT);
  const candidateSchema = compileConfigurationSchema(await readAuthoringSchema("candidates"));
  const candidates = parseYaml(
    await readFile(path.join(stateDirectory, "candidates", "index.yaml"), "utf8")
  );
  assert.equal(candidateSchema(candidates), true, formatSchemaErrors(candidateSchema.errors).join("\n"));
});

test("an explicit implementation choice produces a durable no-action probe result", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  const bundle = path.join(output, "probe-bundle");
  await cp(delegatedAuthoring, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });
  const before = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  const prepared = await prepareClarificationProbe(packagePath, {
    stateRoot: stateDirectory,
    outputDirectory: bundle,
    probe: clarificationProbeConfiguration(),
    now: () => "2026-08-03T13:00:00.000Z"
  });
  await writeProbeExecution(bundle, prepared.brief, "run-delegated-delivery-1", {
    authoring_probe_result_version: "1",
    outcome: "no-action",
    interpretation: "The implementation selects email or a team channel for the actual environment.",
    materially_different_interpretations: [],
    source_claims: [{
      reference: "package:definition/workflow.md",
      statement: "The package explicitly permits either route and delegates selection to implementation."
    }],
    inference: "The route changes implementation details but not authored intent because authority is delegated.",
    candidate: null,
    no_action: {
      reason: "The consequential variation is explicitly delegated to implementation.",
      retained_latitude: ["Email or team-channel delivery"]
    }
  });
  const recorded = await recordClarificationProbeRun(packagePath, {
    stateRoot: stateDirectory,
    bundleDirectory: bundle,
    expectedRevision: before.workspace.revision,
    now: () => "2026-08-03T13:02:00.000Z"
  });
  assert.equal(recorded.run.outcome, "no-action");
  assert.equal(recorded.run.occurrence_id, null);
  assert.equal(recorded.candidate, null);
  const recordedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(recordedStatus.review.probes.no_action, 1);
  assert.equal(recordedStatus.review.candidates.total, 0);
});

test("document proposals require an explicit author decision before engine application", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  const opened = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });
  const documentPath = path.join(packagePath, "definition", "feature.md");
  const beforeContent = await readFile(documentPath, "utf8");
  const afterContent = `${beforeContent}\n\nClosed goals cannot be reopened.\n`;
  const before = await inspectAuthoringWorkspace(packagePath, { stateDirectory });

  const proposed = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    expectedRevision: before.workspace.revision,
    proposal: {
      path: "definition/feature.md",
      summary: "State the finality of closed goals",
      content: afterContent,
      basis: {
        kind: "author-answer",
        references: ["question-closed-goal"]
      }
    }
  });
  assert.equal(proposed.proposal.status, "proposed");
  assert.equal(proposed.proposal.pass, opened.current.id);
  assert.equal(proposed.proposal.document.before_content, undefined);
  assert.equal(proposed.proposal.document.after_content, undefined);
  assert.equal(await readFile(documentPath, "utf8"), beforeContent);
  const proposedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(proposedStatus.review.proposals.proposed, 1);
  assert.equal(proposedStatus.review.proposals.items[0].document.before_content, beforeContent);
  assert.equal(proposedStatus.review.proposals.items[0].document.after_content, afterContent);
  assert.equal(proposed.snapshot, undefined);

  await assert.rejects(
    reviewArea(packagePath, {
      stateRoot: stateDirectory,
      summary: "The author accepted a clarification.",
      disposition: "improved"
    }),
    (error) => error.code === "AUTHORING_CHANGE_PENDING"
  );

  const accepted = await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    expectedRevision: proposed.workspace.revision,
    proposalId: proposed.proposal.id,
    decision: "accept",
    rationale: "This is the intended lifecycle."
  });
  assert.equal(accepted.proposal.status, "accepted");
  assert.equal(accepted.proposal.decision.by, "author");
  assert.equal(accepted.proposal.decisions, undefined);
  assert.equal(await readFile(documentPath, "utf8"), beforeContent);

  const blockedPublish = await publishCheckPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0"
  });
  assert.equal(blockedPublish.ready, false);
  assert.equal(
    blockedPublish.checks.find(({ id }) => id === "accepted-authoring-changes").status,
    "failed"
  );

  const applied = await applyDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    expectedRevision: accepted.workspace.revision,
    proposalId: proposed.proposal.id
  });
  assert.equal(applied.proposal.status, "applied");
  assert.equal(applied.recovered, false);
  assert.equal(await readFile(documentPath, "utf8"), afterContent);
  const appliedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(appliedStatus.review.proposals.applied, 1);
  assert.equal(appliedStatus.review.proposals.proposed, 0);
  assert.equal(appliedStatus.review.proposals.accepted, 0);

  const result = parseYaml(await readFile(opened.current.result, "utf8"));
  assert.ok(result.changes.proposed.includes(proposed.proposal.id));
  assert.ok(result.changes.applied.includes(proposed.proposal.id));

  const closed = await reviewArea(packagePath, {
    stateRoot: stateDirectory,
    summary: "Closed goals are final.",
    disposition: "improved"
  });
  assert.equal(closed.reviewed.pass, opened.current.id);
});

test("an applied manifest identity change keeps the authoring workspace bound", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });

  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.id = "org.example.renamed-feature";
  manifest.name = "Renamed Feature";
  const proposed = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "seedspec.yaml",
      summary: "Replace the starter package identity",
      content: stringifyYaml(manifest),
      basis: { kind: "author-answer", references: [] }
    }
  });
  const accepted = await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposed.proposal.id,
    decision: "accept"
  });
  const applied = await applyDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    expectedRevision: accepted.workspace.revision,
    proposalId: proposed.proposal.id
  });

  const appliedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(appliedStatus.package.id, manifest.id);
  assert.ok(applied.changed.some(({ kind }) => kind === "workspace"));
  const workspace = parseYaml(await readFile(path.join(stateDirectory, "workspace.yaml"), "utf8"));
  assert.equal(workspace.package.id, manifest.id);
  const resumed = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0",
    statusOnly: true
  });
  assert.equal(resumed.package.id, manifest.id);
});

test("accepted proposals for independent documents can apply in sequence", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });

  const featurePath = path.join(packagePath, "definition", "feature.md");
  const featureBefore = await readFile(featurePath, "utf8");
  const featureAfter = `${featureBefore}\n\nClosed goals remain closed.\n`;
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.id = "org.example.independent-changes";
  manifest.name = "Independent Changes";
  const manifestAfter = stringifyYaml(manifest);

  const featureProposal = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "definition/feature.md",
      summary: "Clarify goal closure",
      content: featureAfter,
      basis: { kind: "author-answer", references: [] }
    }
  });
  const manifestProposal = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "seedspec.yaml",
      summary: "Set the package identity",
      content: manifestAfter,
      basis: { kind: "author-answer", references: [] }
    }
  });

  await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: featureProposal.proposal.id,
    decision: "accept"
  });
  await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: manifestProposal.proposal.id,
    decision: "accept"
  });
  await applyDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: featureProposal.proposal.id
  });
  const manifestApplied = await applyDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: manifestProposal.proposal.id
  });

  assert.equal(await readFile(featurePath, "utf8"), featureAfter);
  assert.equal(await readFile(manifestPath, "utf8"), manifestAfter);
  assert.equal(manifestApplied.proposal.status, "applied");
  const appliedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  assert.equal(appliedStatus.review.proposals.applied, 2);
  assert.equal(appliedStatus.review.proposals.accepted, 0);
  assert.equal(appliedStatus.package.id, manifest.id);
  const workspace = parseYaml(await readFile(path.join(stateDirectory, "workspace.yaml"), "utf8"));
  assert.equal(workspace.package.id, manifest.id);
});

test("rejected and stale document proposals never change package bytes", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });
  const documentPath = path.join(packagePath, "definition", "feature.md");
  const beforeContent = await readFile(documentPath, "utf8");

  const rejectedProposal = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "definition/feature.md",
      summary: "Rejected wording",
      content: `${beforeContent}\nRejected wording.\n`,
      basis: { kind: "agent-proposal", references: [] }
    }
  });
  const rejected = await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: rejectedProposal.proposal.id,
    decision: "reject"
  });
  assert.equal(rejected.proposal.status, "rejected");
  await assert.rejects(
    applyDocumentChange(packagePath, {
      stateRoot: stateDirectory,
      proposalId: rejectedProposal.proposal.id
    }),
    (error) => error.code === "AUTHORING_CHANGE_NOT_ACCEPTED"
  );
  assert.equal(await readFile(documentPath, "utf8"), beforeContent);

  const staleProposal = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "definition/feature.md",
      summary: "Stale wording",
      content: `${beforeContent}\nStale wording.\n`,
      basis: { kind: "author-answer", references: [] }
    }
  });
  await writeFile(documentPath, `${beforeContent}\nExternal edit.\n`, "utf8");
  await assert.rejects(
    decideDocumentChange(packagePath, {
      stateRoot: stateDirectory,
      proposalId: staleProposal.proposal.id,
      decision: "accept"
    }),
    (error) => error.code === "AUTHORING_CHANGE_STALE"
  );
  assert.equal(await readFile(documentPath, "utf8"), `${beforeContent}\nExternal edit.\n`);
});

test("an author can retract an accepted change that can no longer be applied", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });
  const documentPath = path.join(packagePath, "definition", "feature.md");
  const beforeContent = await readFile(documentPath, "utf8");

  const proposed = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "definition/feature.md",
      summary: "Clarify closure",
      content: `${beforeContent}\nClosed goals remain closed.\n`,
      basis: { kind: "author-answer", references: [] }
    }
  });
  const accepted = await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposed.proposal.id,
    decision: "accept",
    rationale: "Use this wording."
  });
  await writeFile(documentPath, `${beforeContent}\nA different authored clarification.\n`, "utf8");

  await assert.rejects(
    applyDocumentChange(packagePath, {
      stateRoot: stateDirectory,
      proposalId: accepted.proposal.id
    }),
    (error) => error.code === "AUTHORING_CHANGE_STALE"
  );
  const retracted = await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: accepted.proposal.id,
    decision: "reject",
    rationale: "The author replaced it with different wording."
  });
  assert.equal(retracted.proposal.status, "rejected");
  const retractedStatus = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  const retainedProposal = retractedStatus.review.proposals.items.find(
    ({ id }) => id === retracted.proposal.id
  );
  assert.deepEqual(
    retainedProposal.decisions.map(({ outcome }) => outcome),
    ["accepted", "rejected"]
  );
  assert.equal(await readFile(documentPath, "utf8"), `${beforeContent}\nA different authored clarification.\n`);
  const publish = await publishCheckPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.3.0"
  });
  assert.equal(publish.ready, true);
  const ledger = parseYaml(await readFile(path.join(stateDirectory, "change-proposals.yaml"), "utf8"));
  const validateLedger = compileConfigurationSchema(await readAuthoringSchema("changes"));
  assert.equal(validateLedger(ledger), true, formatSchemaErrors(validateLedger.errors).join("\n"));
});

test("authoring change paths stay inside existing package directories", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.3.0" });

  await assert.rejects(
    proposeDocumentChange(packagePath, {
      stateRoot: stateDirectory,
      proposal: {
        path: "../outside.md",
        summary: "Escape the package",
        content: "unsafe",
        basis: { kind: "agent-proposal", references: [] }
      }
    }),
    (error) => error.code === "INVALID_AUTHORING_INPUT"
  );
  await assert.rejects(
    proposeDocumentChange(packagePath, {
      stateRoot: stateDirectory,
      proposal: {
        path: "missing/new.md",
        summary: "Create under a missing directory",
        content: "new",
        basis: { kind: "author-answer", references: [] }
      }
    }),
    (error) => error.code === "INVALID_AUTHORING_DOCUMENT_PATH"
  );
});

test("authoring document changes cannot enter fixed context module bodies", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(contextModulesFixture, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.19.0-test" });

  for (const documentPath of [
    "context/refund-safety/BEHAVIOR.md",
    "context/refund-safety/references/traces.md",
    "context/review-behavior/SKILL.md"
  ]) {
    const current = await readFile(path.join(packagePath, ...documentPath.split("/")), "utf8");
    await assert.rejects(
      proposeDocumentChange(packagePath, {
        stateRoot: stateDirectory,
        proposal: {
          path: documentPath,
          summary: "Rewrite declared context",
          content: `${current}\nAuthoring rewrite.\n`,
          basis: { kind: "author-answer", references: [] }
        }
      }),
      (error) => (
        error.code === "AUTHORING_CONTEXT_MODULE_READ_ONLY"
        && error.message.includes(documentPath)
      )
    );
  }

  const primaryPath = path.join(packagePath, "definition", "solution.md");
  const primary = await readFile(primaryPath, "utf8");
  const proposal = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "definition/solution.md",
      summary: "Clarify primary intent",
      content: `${primary}\nPrimary intent clarification.\n`,
      basis: { kind: "author-answer", references: [] }
    }
  });
  assert.equal(proposal.proposal.status, "proposed");
  assert.equal(await readFile(primaryPath, "utf8"), primary);

  const resourcePackagePath = path.join(output, "resource-package");
  const resourceStateDirectory = path.join(output, "resource-authoring-state");
  await cp(resourcesFixture, resourcePackagePath, { recursive: true });
  const resourceManifestPath = path.join(resourcePackagePath, "seedspec.yaml");
  const resourceManifest = parseYaml(await readFile(resourceManifestPath, "utf8"));
  resourceManifest.context.modules.push({
    id: "authorization-guidance",
    format: "io.agentskills.skill",
    description: "Authorization guidance supplied as fixed context.",
    entrypoint: "SKILL.md",
    source: { kind: "resource", id: "org.example.guidance.authorization" }
  });
  await writeFile(resourceManifestPath, stringifyYaml(resourceManifest), "utf8");
  await auditPackage(resourcePackagePath, {
    stateDirectory: resourceStateDirectory,
    toolVersion: "0.19.0-test"
  });
  const resourceBody = await readFile(
    path.join(resourcePackagePath, "guidance", "authorization", "SKILL.md"),
    "utf8"
  );
  await assert.rejects(
    proposeDocumentChange(resourcePackagePath, {
      stateRoot: resourceStateDirectory,
      proposal: {
        path: "guidance/authorization/SKILL.md",
        summary: "Rewrite resource-backed context",
        content: `${resourceBody}\nAuthoring rewrite.\n`,
        basis: { kind: "author-answer", references: [] }
      }
    }),
    (error) => error.code === "AUTHORING_CONTEXT_MODULE_READ_ONLY"
  );

  const artifactPackagePath = path.join(output, "artifact-package");
  const artifactStateDirectory = path.join(output, "artifact-authoring-state");
  await cp(allowance, artifactPackagePath, { recursive: true });
  const artifactManifestPath = path.join(artifactPackagePath, "seedspec.yaml");
  const artifactManifest = parseYaml(await readFile(artifactManifestPath, "utf8"));
  artifactManifest.context.modules.push({
    id: "chore-reference-context",
    format: "org.example.context.reference",
    description: "Chore reference supplied as fixed context.",
    entrypoint: "chores-1.0.0.md",
    source: { kind: "artifact", id: "chore-reference" }
  });
  await writeFile(artifactManifestPath, stringifyYaml(artifactManifest), "utf8");
  await auditPackage(artifactPackagePath, {
    stateDirectory: artifactStateDirectory,
    toolVersion: "0.19.0-test"
  });
  const artifactBody = await readFile(
    path.join(artifactPackagePath, "reference", "capabilities", "chores-1.0.0.md"),
    "utf8"
  );
  await assert.rejects(
    proposeDocumentChange(artifactPackagePath, {
      stateRoot: artifactStateDirectory,
      proposal: {
        path: "reference/capabilities/chores-1.0.0.md",
        summary: "Rewrite artifact-backed context",
        content: `${artifactBody}\nAuthoring rewrite.\n`,
        basis: { kind: "author-answer", references: [] }
      }
    }),
    (error) => error.code === "AUTHORING_CONTEXT_MODULE_READ_ONLY"
  );
});

test("application rechecks the fixed context module boundary", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(contextModulesFixture, packagePath, { recursive: true });

  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const originalManifest = await readFile(manifestPath, "utf8");
  const undeclaredManifest = parseYaml(originalManifest);
  undeclaredManifest.context.modules = undeclaredManifest.context.modules.filter(
    ({ id }) => id === undeclaredManifest.definition.module
  );
  await writeFile(manifestPath, stringifyYaml(undeclaredManifest), "utf8");
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.19.0-test" });

  const modulePath = path.join(packagePath, "context", "refund-safety", "BEHAVIOR.md");
  const before = await readFile(modulePath, "utf8");
  const proposed = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "context/refund-safety/BEHAVIOR.md",
      summary: "Change currently undeclared material",
      content: `${before}\nQueued rewrite.\n`,
      basis: { kind: "author-answer", references: [] }
    }
  });
  await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposed.proposal.id,
    decision: "accept"
  });

  await writeFile(manifestPath, originalManifest, "utf8");
  await assert.rejects(
    applyDocumentChange(packagePath, {
      stateRoot: stateDirectory,
      proposalId: proposed.proposal.id
    }),
    (error) => error.code === "AUTHORING_CONTEXT_MODULE_READ_ONLY"
  );
  assert.equal(await readFile(modulePath, "utf8"), before);
});

test("the context boundary still permits a manifest repair proposal", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(contextModulesFixture, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.19.0-test" });

  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const validManifest = await readFile(manifestPath, "utf8");
  await writeFile(manifestPath, "protocol_version: [invalid\n", "utf8");
  const proposed = await proposeDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposal: {
      path: "seedspec.yaml",
      summary: "Restore the valid manifest",
      content: validManifest,
      basis: { kind: "author-answer", references: [] }
    }
  });
  await decideDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposed.proposal.id,
    decision: "accept"
  });
  await applyDocumentChange(packagePath, {
    stateRoot: stateDirectory,
    proposalId: proposed.proposal.id
  });

  assert.equal(await readFile(manifestPath, "utf8"), validManifest);
  assert.equal((await validatePackage(packagePath)).manifest.id, "org.seedspec.fixtures.context-modules");
});

test("the published authoring change schema remains outside protocol conformance", async () => {
  const schema = await readAuthoringSchema("changes");
  assert.equal(schema.properties.authoring_change_proposals_version.const, AUTHORING_CHANGE_PROPOSAL_FORMAT);
  assert.match(schema.description, /never SeedSpec Protocol conformance surface/u);
});

test("a mutation rejects a revision that no longer describes the workspace", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

  // The revision reported by status must be the one operations accept, or
  // optimistic concurrency fails closed on every honest caller.
  const before = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  const applied = await recordObservations(packagePath, {
    stateRoot: stateDirectory,
    entries: [{ type: "inventory", item: "definition/feature.md" }],
    expectedRevision: before.workspace.revision
  });
  assert.equal(applied.revision_checked, true);
  assert.notEqual(applied.workspace.revision, before.workspace.revision);

  await assert.rejects(
    recordObservations(packagePath, {
      stateRoot: stateDirectory,
      entries: [{ type: "inventory", item: "acceptance/criteria.md" }],
      expectedRevision: before.workspace.revision
    }),
    (error) => error.code === "AUTHORING_REVISION_CONFLICT"
  );
});

test("the local authoring mutation lock rejects concurrent writers", async (t) => {
  const output = await temporaryDirectory(t);
  const stateDirectory = path.join(output, "authoring");
  let release;
  const held = withAuthoringWorkspaceMutationLock(
    stateDirectory,
    () => new Promise((resolve) => { release = resolve; })
  );
  const lockPath = authoringWorkspaceLockPath(stateDirectory);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await access(lockPath);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  await access(lockPath);

  await assert.rejects(
    withAuthoringWorkspaceMutationLock(stateDirectory, async () => {}),
    (error) => error.code === "AUTHORING_WORKSPACE_BUSY"
  );

  release();
  await held;
  await assert.rejects(access(lockPath), { code: "ENOENT" });
});

test("workspace revision has exactly one implementation", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

  // Decision 0013 forbids a second engine. The revision an operation checks and
  // the revision `author status` reports must be the same value computed the
  // same way, or optimistic concurrency fails closed on every honest caller.
  const snapshot = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  const direct = await computeWorkspaceRevision(packagePath, stateDirectory);
  assert.equal(direct, snapshot.workspace.revision);

  // It must also move when either side changes, and only then.
  const unchanged = await computeWorkspaceRevision(packagePath, stateDirectory);
  assert.equal(unchanged, direct);
  await recordObservations(packagePath, {
    stateRoot: stateDirectory,
    entries: [{ type: "inventory", item: "definition/feature.md" }]
  });
  assert.notEqual(await computeWorkspaceRevision(packagePath, stateDirectory), direct);

  const afterPackageEdit = await computeWorkspaceRevision(packagePath, stateDirectory);
  await writeFile(
    path.join(packagePath, "definition", "feature.md"),
    `${await readFile(path.join(packagePath, "definition", "feature.md"), "utf8")}\n\nA clarification.\n`,
    "utf8"
  );
  assert.notEqual(await computeWorkspaceRevision(packagePath, stateDirectory), afterPackageEdit);
});

test("the operation layer stays free of node built-ins", async () => {
  // core/ must remain portable so the same operations can run over a hosted
  // store without a second implementation. Storage belongs behind the adapter.
  const core = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "authoring",
    "core"
  );
  for (const entry of await readdir(core)) {
    if (!entry.endsWith(".js")) continue;
    const source = await readFile(path.join(core, entry), "utf8");
    const imports = source.match(/from "node:[a-z/]+"/g) ?? [];
    assert.deepEqual(imports, [], `authoring/core/${entry} must not import node built-ins`);
  }
});

test("every closing resolution disappears from the open count", async (t) => {
  // The write path and the read surfaces must share one definition of "closed".
  // Two resolutions were once accepted by the operation and unknown to every
  // reader, so a closed question reported itself open forever.
  for (const resolution of QUESTION_RESOLUTIONS) {
    const output = await temporaryDirectory(t);
    const packagePath = path.join(output, `package-${resolution}`);
    const stateDirectory = path.join(output, `state-${resolution}`);
    await cp(savings, packagePath, { recursive: true });
    await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

    const recorded = await recordObservations(packagePath, {
      stateRoot: stateDirectory,
      entries: [{ type: "question", question: `Closed via ${resolution}?` }]
    });
    const before = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
    assert.equal(before.review.questions.open, 1, `${resolution}: should start open`);

    await answerQuestion(packagePath, {
      stateRoot: stateDirectory,
      questionId: recorded.recorded[0].id,
      answer: "An answer.",
      resolution
    });

    // Assert through the read surfaces, not the operation's return value.
    const snapshot = await inspectAuthoringWorkspace(packagePath, { stateDirectory });
    assert.equal(snapshot.review.questions.open, 0, `${resolution}: must not remain open`);
    assert.equal(snapshot.review.questions.resolved, 1, `${resolution}: must count as resolved`);

    const audit = await auditPackage(packagePath, {
      stateDirectory,
      toolVersion: "0.2.0",
      statusOnly: true
    });
    assert.equal(audit.questions.open, 0, `${resolution}: audit must agree`);
    assert.equal(audit.questions.resolved, 1, `${resolution}: audit must agree`);
  }
});

test("a malformed active pass never blocks the commands that recover it", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  const stateDirectory = path.join(output, "authoring-state");
  await cp(savings, packagePath, { recursive: true });
  const opened = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

  // Semantically malformed: the outcome stays a valid in-flight value, so the
  // pass is genuinely active, but the record breaks its contract.
  const result = parseYaml(await readFile(opened.current.result, "utf8"));
  result.disposition = "bogus";
  await writeFile(opened.current.result, stringifyYaml(result), "utf8");

  // Every command must keep working, including the two that must run for the
  // author to make progress.
  const review = await auditPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });
  const check = await auditPackage(packagePath, {
    stateDirectory,
    toolVersion: "0.2.0",
    statusOnly: true
  });
  await inspectAuthoringWorkspace(packagePath, { stateDirectory });
  await publishCheckPackage(packagePath, { stateDirectory, toolVersion: "0.2.0" });

  // The author is told what happened and what to do, and work continues.
  const notice = check.notices.find(({ code }) => code === "AUTHORING_PASS_UNREADABLE");
  assert.ok(notice, "an unreadable pass must be reported");
  assert.equal(notice.severity, "advisory");
  assert.match(notice.message, /does not satisfy the pass contract/);
  assert.match(notice.recovery, /new pass/);
  assert.equal(notice.result, opened.current.result);

  assert.equal(review.current.area, "seed");
  assert.notEqual(review.current.id, opened.current.id);

  // The broken record is preserved exactly, not repaired or deleted.
  const preserved = parseYaml(await readFile(opened.current.result, "utf8"));
  assert.equal(preserved.disposition, "bogus");
});

test("standing rules moved out of the guide are still delivered", async () => {
  // The per-project guide carries the rules that change a decision where it is
  // made; the rest live in the shared implementing guide so boilerplate stops
  // outweighing intent. Nothing may be dropped in the move.
  const guide = await readFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..", "..", "cli", "docs", "implementing.md"
    ),
    "utf8"
  );
  for (const rule of [
    "kind as a hint",
    "conformance suite",
    "Even a selected artifact",
    "obtain specific user direction at activation time",
    "ordered implementation reminders",
    "cherry-picking",
    "expected`, `recommended`, and `available`"
  ]) {
    assert.ok(guide.includes(rule), `implementing.md must still carry: ${rule}`);
  }
});

test("a package waiting for a host is not reported as a defect", async (t) => {
  const output = await temporaryDirectory(t);
  const workspace = path.join(output, "solo");
  // A feature declaring the host concepts it expects is in its designed state.
  // Reporting that at high severity made a correct package look broken and
  // taught agents that severity carries no information.
  const result = await resolveProject(savings, {
    outputDirectory: workspace,
    configurationSelections: { packages: [{ package: "org.seedspec.fixtures.portable-feature", selection: "example" }] }
  });
  const guide = await readFile(path.join(result.workspace, "agent-guide.md"), "utf8");
  assert.doesNotMatch(guide, /HIGH \/ no-declared-provider/);
  assert.match(guide, /## Host concepts this package expects/);
  assert.match(guide, /org\.seedspec\.core\.actors/);

  // The declarations are still preserved verbatim in machine state.
  const lock = parseYaml(await readFile(path.join(result.workspace, "dependencies.lock.yaml"), "utf8"));
  const unmet = lock.requirements.filter(({ issues }) => issues?.includes("no-declared-provider"));
  assert.equal(unmet.length, 3, "requirements stay recorded regardless of framing");
  assert.ok(
    lock.reviews.filter(({ code }) => code === "no-declared-provider").every(({ severity }) => severity === "low"),
    "an unjoined expectation is low severity"
  );
});

test("provider discovery answers the question feature discovery cannot", async () => {
  // discoverFeatures asks "what can I add to this application?". Composition
  // also needs "who could satisfy what this package expects?", which had no
  // command at all.
  const result = await discoverProviders(savings, [
    path.join(root, "conformance/fixtures")
  ]);
  assert.equal(result.consumer.id, "org.seedspec.fixtures.portable-feature");
  assert.equal(result.expectations.length, 3);
  const actors = result.expectations.find(({ capability }) => capability === "org.seedspec.core.actors");
  assert.ok(actors, "the expectation is reported");
  assert.ok(
    actors.providers.some(({ id }) => id === "org.seedspec.fixtures.comprehensive-application"),
    "a catalog package declaring the capability is offered as a candidate"
  );
  assert.equal(actors.status, "declared-provider-found");
});

test("a bundled resource can be read in full before anything consults it", async () => {
  // Bundled bytes are digest-bound and therefore reviewable, but reviewable in
  // principle is not reviewed in practice unless something shows a person the
  // text. Only the author's short description was ever visible.
  const listing = await listPackageImplementationResources(path.join(root, "conformance/fixtures/implementation-resources"));
  const skill = listing.resources.find(({ kind }) => kind === "skill");
  assert.ok(skill.declares?.name, "the skill's own frontmatter name is surfaced");
  assert.ok(skill.declares?.description, "the skill's own description is surfaced");

  const shown = await readBundledResource(resourcesFixture, skill.id);
  assert.equal(shown.verified_digest, shown.resource.digest);
  assert.match(shown.text, /^---\n/, "the exact entrypoint text is returned");
  assert.match(formatBundledResource(shown), /match the digest the package declares/);

  await assert.rejects(
    readBundledResource(resourcesFixture, "org.example.not-a-resource"),
    (error) => error.code === "IMPLEMENTATION_RESOURCE_NOT_FOUND"
  );
});

test("declaring capabilities without success material is flagged, and naming is not", async (t) => {
  // A declared capability is a promise to whoever composes this package. The
  // check is the mechanical fact -- promised, nothing to check it against --
  // never a guess from vocabulary, which misfired on well-named capabilities.
  const withAcceptance = await lintPackage(savings);
  assert.equal(
    withAcceptance.diagnostics.filter(({ code }) => code === "CAPABILITY_WITHOUT_ACCEPTANCE_COVERAGE").length,
    0,
    "a package with acceptance material is not flagged for wording"
  );

  const output = await temporaryDirectory(t);
  const stripped = path.join(output, "package");
  await cp(savings, stripped, { recursive: true });
  const manifestPath = path.join(stripped, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  delete manifest.components.acceptance;
  await writeFile(manifestPath, stringifyYaml(manifest), "utf8");

  const withoutAcceptance = await lintPackage(stripped);
  assert.equal(
    withoutAcceptance.diagnostics.filter(({ code }) => code === "CAPABILITY_WITHOUT_ACCEPTANCE_COVERAGE").length,
    1
  );
});
