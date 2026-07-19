import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  beginPackage,
  completionScopeDigest,
  discoverFeatures,
  formatBuyerAgentPrompt,
  inspectPackage,
  inspectProjectCompletion,
  initPackage,
  listArtifactAdapters,
  listPackageArtifacts,
  resolveProject,
  runConformanceSuite,
  validateArtifact,
  verifyProjectLock,
  validatePackage
} from "../src/index.js";
import { compileProtocolSchema, formatSchemaErrors } from "../src/schema.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(packageRoot, "../..");
const allowance = path.join(root, "examples/allowance-tracker");
const savings = path.join(root, "examples/savings-goals");
const streaks = path.join(root, "examples/chore-streaks");
const fixtures = path.join(packageRoot, "test/fixtures");

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "seedspec-v02-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writeExampleConfigurationSelections(directory, packagePaths, name = "configuration-selections.yaml") {
  const records = await Promise.all(packagePaths.map(validatePackage));
  const selectionPath = path.join(directory, name);
  await writeFile(selectionPath, stringifyYaml({
    protocol_version: "0.1",
    packages: records.map((record) => ({
      package: record.manifest.id,
      selection: "example"
    }))
  }), "utf8");
  return selectionPath;
}

test("all complete example packages validate", async () => {
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
  assert.equal(application.manifest.artifacts[0].type, "org.seedspec.artifact.product-spec");
});

test("capability revision differences request review without blocking handoff", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance, streaks]
  );
  const result = await resolveProject(allowance, {
    featurePaths: [streaks],
    configurationSelectionsPath,
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
  assert.deepEqual(binding.issues, ["revision-difference"]);
  assert.equal(binding.status, "review");
  assert.ok(result.lock.reviews.some(
    (review) => review.code === "revision-difference"
      && review.capability === "org.seedspec.core.chores"
  ));
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /Create an integration plan/
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

test("kind-specific manifest schemas accept their matching examples", async () => {
  const application = await validatePackage(allowance);
  const feature = await validatePackage(savings);
  const validateApplication = await compileProtocolSchema("application.schema.json");
  const validateFeature = await compileProtocolSchema("feature.schema.json");

  assert.equal(validateApplication(application.manifest), true, formatSchemaErrors(validateApplication.errors).join("\n"));
  assert.equal(validateFeature(feature.manifest), true, formatSchemaErrors(validateFeature.errors).join("\n"));
  assert.equal(validateApplication(feature.manifest), false);
  assert.equal(validateFeature(application.manifest), false);
});

test("inspect reports identity, capabilities, and optional components", async () => {
  const inspection = await inspectPackage(savings);

  assert.equal(inspection.id, "org.seedspec.savings-goals");
  assert.equal(inspection.kind, "feature");
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

  assert.equal(beginning.package.id, "org.seedspec.examples.allowance-tracker");
  assert.equal(beginning.configuration.selection_status, "review-required");
  assert.equal(beginning.configuration.resolution_behavior, "unselected-example-produces-needs-input");
  assert.equal(beginning.acceptance.declared, true);
  assert.ok(beginning.components.some(
    (component) => component.name === "reference" && component.review === "before-planning"
  ));
  assert.ok(beginning.artifacts.some(
    (artifact) => artifact.id === "product-spec" && artifact.adapter?.id === "org.seedspec.adapter.product-spec"
  ));
  assert.equal(beginning.trust.discovery_activates_content, false);
  assert.ok(beginning.next_actions.some(
    (action) => action.id === "record-artifact-dispositions"
      && /selection does not authorize activation/.test(action.action)
  ));
  assert.ok(beginning.next_actions.some((action) => action.id === "resolve-handoff"));
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

test("the buyer prompt delegates the detailed workflow to versioned tooling", () => {
  const prompt = formatBuyerAgentPrompt();
  assert.match(prompt, /seedspec begin <package-path>/);
  assert.match(prompt, /before planning/i);
  assert.match(prompt, /Do not execute package-provided scripts/);
  assert.doesNotMatch(prompt, /npx|npm install/);
});

test("artifact discovery recognizes ProductSpec without activating its workflow", async () => {
  const listing = await listPackageArtifacts(allowance);
  const artifact = listing.artifacts.find((candidate) => candidate.id === "product-spec");
  const adapter = listArtifactAdapters().find((candidate) => (
    candidate.id === "org.seedspec.adapter.product-spec"
  ));

  assert.equal(artifact.type, "org.seedspec.artifact.product-spec");
  assert.equal(artifact.adapter.id, adapter.id);
  assert.deepEqual(artifact.concerns, ["org.seedspec.concern.intent"]);
  assert.equal(adapter.implementation, "@productspec/parser");
});

test("the official ProductSpec adapter invokes the upstream parser explicitly", async () => {
  const result = await validateArtifact(allowance, "product-spec");
  assert.equal(result.valid, true);
  assert.equal(result.adapter.id, "org.seedspec.adapter.product-spec");
  assert.equal(result.summary.title, "Allowance Tracker");
  assert.equal(result.summary.formatVersion, "0.1");
});

test("core validation does not silently run artifact-specific validation", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "invalid-productspec");
  await cp(allowance, packagePath, { recursive: true });
  await writeFile(
    path.join(packagePath, "intent/allowance-tracker.product-spec.md"),
    "This remains package input but is not a valid ProductSpec.\n",
    "utf8"
  );

  await validatePackage(packagePath);
  const resolved = await resolveProject(packagePath, { outputDirectory: output });
  assert.ok(await readFile(
    path.join(resolved.workspace, resolved.artifactIndex.artifacts[0].path),
    "utf8"
  ));
  await assert.rejects(
    validateArtifact(packagePath, "product-spec"),
    (error) => error.code === "INVALID_ARTIFACT"
  );
});

test("artifact relationships must refer to declared local artifact IDs", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "unknown-artifact-relation");
  await cp(allowance, packagePath, { recursive: true });
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  manifest.relationships = [{
    from: "product-spec",
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

test("feature discovery exposes declaration context without compatibility verdicts", async () => {
  const result = await discoverFeatures(allowance, [path.join(root, "examples")]);
  const savingsCandidate = result.candidates.find((candidate) => (
    candidate.id === "org.seedspec.savings-goals"
  ));
  const streakCandidate = result.candidates.find((candidate) => (
    candidate.id === "org.seedspec.chore-streaks"
  ));

  assert.equal(savingsCandidate.status, "candidate");
  assert.equal(streakCandidate.status, "review");
  assert.ok(streakCandidate.reasons.some((reason) => reason.includes("tested at 1.0.0")));
  assert.ok(result.candidates.every(
    (candidate) => !["compatible", "incompatible", "conflict"].includes(candidate.status)
  ));
  assert.deepEqual(result.application.id, "org.seedspec.examples.allowance-tracker");
});

test("invalid fixture fails with a useful referenced-file error", async () => {
  await assert.rejects(
    validatePackage(path.join(fixtures, "missing-definition")),
    (error) => error.code === "INVALID_REFERENCES"
      && error.details.some((detail) => detail.includes("definition.entrypoint"))
  );
});

test("Allowance Tracker resolves without features", async (t) => {
  const output = await temporaryDirectory(t);
  const result = await resolveProject(allowance, { outputDirectory: output });
  const project = parseYaml(await readFile(path.join(result.workspace, "project.yaml"), "utf8"));

  assert.deepEqual(project.features, []);
  assert.equal(project.status, "needs-input");
  assert.equal(project.configuration_status, "review");
  assert.equal(result.resolvedConfiguration.application.selection, "example-unreviewed");
  assert.equal(result.lock.application.id, "org.seedspec.examples.allowance-tracker");
  assert.ok(result.lock.capabilities.some(
    (capability) => capability.id === "org.seedspec.core.chores"
  ));
  assert.equal(result.artifactIndex.artifacts.length, 1);
  assert.equal(result.artifactIndex.artifacts[0].disposition, "unreviewed");
  assert.equal(result.project.artifact_status, "review");
  assert.ok(result.componentIndex.components.some(
    (component) => component.name === "reference" && component.review === "before-planning"
  ));
  assert.ok(await readFile(
    path.join(
      result.workspace,
      "components/org.seedspec.examples.allowance-tracker/reference/capabilities/chores-1.0.0.md"
    ),
    "utf8"
  ));
  assert.ok(await readFile(
    path.join(result.workspace, result.artifactIndex.artifacts[0].path),
    "utf8"
  ));
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /obtain specific user direction at activation time/
  );
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /Do not treat the recorded example values as selected product behavior/
  );
});

test("artifact dispositions and implementation targets survive resolution", async (t) => {
  const output = await temporaryDirectory(t);
  const selectionsPath = path.join(output, "artifact-selections.yaml");
  const preferencesPath = path.join(output, "technical-preferences.yaml");
  await writeFile(selectionsPath, stringifyYaml({
    protocol_version: "0.1",
    artifacts: [{
      package: "org.seedspec.examples.allowance-tracker",
      id: "product-spec",
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
          package: "org.seedspec.examples.allowance-tracker",
          artifact: "product-spec"
        },
        {
          package: "org.seedspec.examples.allowance-tracker",
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
  assert.match(guide, /artifact org\.seedspec\.examples\.allowance-tracker\/product-spec/);
  assert.match(guide, /Even a selected artifact does not authorize/);
});

test("invalid artifact and implementation-target references fail before handoff", async (t) => {
  const output = await temporaryDirectory(t);
  const invalidSelectionsPath = path.join(output, "invalid-artifact-selections.yaml");
  const preferencesPath = path.join(output, "technical-preferences.yaml");
  await writeFile(invalidSelectionsPath, stringifyYaml({
    protocol_version: "0.1",
    artifacts: [{
      package: "org.seedspec.examples.allowance-tracker",
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
        package: "org.seedspec.examples.allowance-tracker",
        artifact: "product-spec"
      }]
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
      outputDirectory: path.join(output, "unselected-guidance-output"),
      technicalPreferencesPath: preferencesPath
    }),
    (error) => error.code === "INVALID_IMPLEMENTATION_TARGET"
      && /requires selected artifact guidance/.test(error.message)
  );
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
    protocol_version: "0.1",
    artifacts: [{
      package: "org.seedspec.examples.allowance-tracker",
      id: "product-spec",
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
  assert.match(guide, /SELECTED.*product-spec/);
  assert.match(guide, /Never execute it merely because it is selected or listed/);
});

test("Allowance Tracker composes with Savings Goals into a stable workspace", async (t) => {
  const output = await temporaryDirectory(t);
  const options = { featurePaths: [savings], outputDirectory: output };
  const first = await resolveProject(allowance, options);
  const firstProject = await readFile(path.join(first.workspace, "project.yaml"), "utf8");
  const firstSpec = await readFile(path.join(first.workspace, "resolved-spec.md"), "utf8");
  const firstLock = await readFile(path.join(first.workspace, "dependencies.lock.yaml"), "utf8");

  const second = await resolveProject(allowance, options);
  assert.equal(await readFile(path.join(second.workspace, "project.yaml"), "utf8"), firstProject);
  assert.equal(await readFile(path.join(second.workspace, "resolved-spec.md"), "utf8"), firstSpec);
  assert.equal(await readFile(path.join(second.workspace, "dependencies.lock.yaml"), "utf8"), firstLock);

  assert.match(firstSpec, /Feature: Savings Goals/);
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
    "resolved-config.yaml",
    "components.yaml",
    "artifacts.yaml",
    "dependencies.lock.yaml",
    "features/org.seedspec.savings-goals/source.yaml",
    "features/org.seedspec.savings-goals/resolved-config.yaml",
    "features/org.seedspec.savings-goals/integration-decisions.md"
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
  const result = await resolveProject(allowance, {
    featurePaths: [unmet],
    configurationSelectionsPath,
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
    (candidate) => candidate.consumer === "org.seedspec.examples.allowance-tracker"
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
  const exampleResult = await resolveProject(allowance, {
    outputDirectory: path.join(output, "example-project"),
    configurationSelectionsPath: examplePath
  });
  assert.equal(exampleResult.project.status, "ready");
  assert.equal(exampleResult.project.configuration_status, "selected");
  assert.equal(exampleResult.resolvedConfiguration.application.selection, "example");

  const customPath = path.join(output, "custom-selection.yaml");
  await writeFile(customPath, stringifyYaml({
    protocol_version: "0.1",
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
    configurationSelectionsPath: customPath
  });
  assert.equal(customResult.resolvedConfiguration.application.selection, "custom");
  assert.equal(customResult.resolvedConfiguration.application.values.approval_required, false);

  const partialPath = path.join(output, "partial-selection.yaml");
  await writeFile(partialPath, stringifyYaml({
    protocol_version: "0.1",
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
        protocol_version: "0.1",
        packages: [{ package: "org.seedspec.examples.allowance-tracker", selection: "example" }]
      },
      code: "MISSING_CONFIGURATION_SELECTION"
    },
    {
      name: "duplicate",
      input: {
        protocol_version: "0.1",
        packages: [
          { package: "org.seedspec.examples.allowance-tracker", selection: "example" },
          { package: "org.seedspec.examples.allowance-tracker", selection: "example" },
          { package: "org.seedspec.savings-goals", selection: "example" }
        ]
      },
      code: "INVALID_CONFIGURATION_SELECTIONS"
    },
    {
      name: "unselected",
      input: {
        protocol_version: "0.1",
        packages: [
          { package: "org.seedspec.examples.allowance-tracker", selection: "example" },
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

test("completion scope stays independent from implementation readiness", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance]
  );
  const result = await resolveProject(allowance, {
    outputDirectory: output,
    configurationSelectionsPath
  });
  const completion = await inspectProjectCompletion(output);

  assert.equal(result.project.status, "ready");
  assert.equal(result.project.completion_scope_status, "review");
  assert.deepEqual(result.completionScope.uncovered_packages, [
    "org.seedspec.examples.allowance-tracker"
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
  const completionScopePath = path.join(output, "completion-input.yaml");
  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.1",
    items: [
      {
        kind: "component",
        id: "allowance-acceptance",
        package: "org.seedspec.examples.allowance-tracker",
        component: "acceptance",
        selection: "all"
      },
      {
        kind: "component",
        id: "savings-acceptance",
        package: "org.seedspec.savings-goals",
        component: "acceptance",
        selection: "subset",
        included_references: ["1"],
        deferred_references: ["2"]
      }
    ]
  }), "utf8");

  const result = await resolveProject(allowance, {
    featurePaths: [savings],
    outputDirectory: output,
    configurationSelectionsPath,
    completionScopePath
  });
  assert.equal(result.project.completion_scope_status, "recorded");
  const statePath = path.join(result.workspace, "verification-state.yaml");
  const state = parseYaml(await readFile(statePath, "utf8"));
  state.status = "verified-with-gaps";
  state.items = state.items.map((item) => ({
    ...item,
    result: "pass",
    evidence: [`test evidence for ${item.id}`]
  }));
  await writeFile(statePath, stringifyYaml(state), "utf8");

  const completion = await inspectProjectCompletion(output);
  assert.equal(completion.status, "verified-with-gaps");
  assert.equal(completion.state.scope_digest, completionScopeDigest(completion.scope));
});

test("completion checking rejects overlapping references and stale verification", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [allowance]
  );
  const completionScopePath = path.join(output, "completion-input.yaml");
  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.1",
    items: [{
      kind: "component",
      id: "allowance-acceptance",
      package: "org.seedspec.examples.allowance-tracker",
      component: "acceptance",
      selection: "subset",
      included_references: ["1"],
      deferred_references: ["1"]
    }]
  }), "utf8");
  await assert.rejects(
    resolveProject(allowance, {
      outputDirectory: path.join(output, "invalid-project"),
      configurationSelectionsPath,
      completionScopePath
    }),
    (error) => error.code === "INVALID_COMPLETION_SCOPE"
  );

  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.1",
    items: [{
      kind: "component",
      id: "allowance-acceptance",
      package: "org.seedspec.examples.allowance-tracker",
      component: "acceptance",
      selection: "all"
    }]
  }), "utf8");
  const projectPath = path.join(output, "stale-project");
  await resolveProject(allowance, {
    outputDirectory: projectPath,
    configurationSelectionsPath,
    completionScopePath
  });

  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.1",
    items: [{
      kind: "component",
      id: "allowance-acceptance",
      package: "org.seedspec.examples.allowance-tracker",
      component: "acceptance",
      selection: "subset",
      included_references: ["1"]
    }]
  }), "utf8");
  await resolveProject(allowance, {
    outputDirectory: projectPath,
    configurationSelectionsPath,
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
  const validateComponentIndex = await compileProtocolSchema("component-index.schema.json");
  const validateArtifactIndex = await compileProtocolSchema("artifact-index.schema.json");
  const validateCompletionScope = await compileProtocolSchema("completion-scope.schema.json");
  const validateVerificationState = await compileProtocolSchema("verification-state.schema.json");
  const project = parseYaml(await readFile(path.join(result.workspace, "project.yaml"), "utf8"));
  const lock = parseYaml(await readFile(path.join(result.workspace, "dependencies.lock.yaml"), "utf8"));
  const resolvedConfiguration = parseYaml(
    await readFile(path.join(result.workspace, "resolved-config.yaml"), "utf8")
  );
  const artifactIndex = parseYaml(
    await readFile(path.join(result.workspace, "artifacts.yaml"), "utf8")
  );
  const componentIndex = parseYaml(
    await readFile(path.join(result.workspace, "components.yaml"), "utf8")
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
    validateComponentIndex(componentIndex),
    true,
    formatSchemaErrors(validateComponentIndex.errors).join("\n")
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
});

test("init creates valid application and feature starter packages", async (t) => {
  const output = await temporaryDirectory(t);
  const applicationPath = path.join(output, "pickup-coordinator");
  const featurePath = path.join(output, "notifications");

  await initPackage("application", applicationPath);
  await initPackage("feature", featurePath);

  assert.equal((await validatePackage(applicationPath)).manifest.kind, "application");
  assert.equal((await validatePackage(featurePath)).manifest.kind, "feature");
});

test("CLI validates and inspects the example package", async () => {
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const validation = await execFileAsync(process.execPath, [cli, "validate", allowance]);
  const prompt = await execFileAsync(process.execPath, [cli, "prompt"]);
  const beginning = await execFileAsync(process.execPath, [cli, "begin", allowance]);
  const inspection = await execFileAsync(process.execPath, [cli, "inspect", savings]);
  const artifacts = await execFileAsync(process.execPath, [cli, "artifacts", allowance]);
  const productSpec = await execFileAsync(process.execPath, [
    cli,
    "validate-artifact",
    allowance,
    "product-spec"
  ]);
  const discovery = await execFileAsync(process.execPath, [
    cli,
    "discover-features",
    allowance,
    "--catalog",
    path.join(root, "examples")
  ]);

  assert.match(validation.stdout, /Valid SeedSpec application package/);
  assert.match(prompt.stdout, /Use this SeedSpec package/);
  assert.match(beginning.stdout, /Do not begin implementation yet/);
  assert.match(beginning.stdout, /CONFIGURATION_EXAMPLE_REQUIRES_REVIEW/);
  assert.match(beginning.stdout, /Discovery does not activate optional material/);
  assert.match(inspection.stdout, /Requires: org\.seedspec\.core\.actors \(tested against 1\.0\.0\)/);
  assert.match(inspection.stdout, /Components: acceptance, integration/);
  assert.match(artifacts.stdout, /ProductSpec/);
  assert.match(productSpec.stdout, /Valid ProductSpec artifact/);
  assert.match(discovery.stdout, /Savings Goals.*candidate/);
});

test("CLI failures expose stable protocol error codes", async () => {
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  await assert.rejects(
    execFileAsync(process.execPath, [
      cli,
      "validate",
      path.join(fixtures, "missing-definition")
    ]),
    (error) => /\[INVALID_REFERENCES\]/.test(error.stderr)
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
    "org.seedspec.examples.catalog": { audience: "families" }
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
  assert.equal(resolved.lock.application.digest, changed.digest);
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
    "org.seedspec.examples.allowance-tracker",
    "org.seedspec.savings-goals"
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

test("alpha format suite passes every declared case", async () => {
  const result = await runConformanceSuite(path.join(root, "conformance/cases.yaml"));
  assert.equal(result.failed, 0, JSON.stringify(result.results.filter((item) => !item.passed), null, 2));
  assert.ok(result.total >= 15);
});
