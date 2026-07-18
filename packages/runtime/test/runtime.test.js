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
  discoverFeatures,
  inspectPackage,
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
  const result = await resolveProject(allowance, {
    featurePaths: [streaks],
    outputDirectory: output
  });
  const binding = result.lock.requirements.find(
    (requirement) => requirement.capability === "org.seedspec.core.chores"
  );

  assert.equal(result.project.status, "ready");
  assert.equal(result.project.integration_status, "review");
  assert.equal(binding.tested_against, "1.0.0");
  assert.equal(binding.provided_version, "1.1.0");
  assert.equal(binding.status, "review");
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

test("feature discovery explains compatibility without selecting features", async () => {
  const result = await discoverFeatures(allowance, [path.join(root, "examples")]);
  const savingsCandidate = result.candidates.find((candidate) => (
    candidate.id === "org.seedspec.savings-goals"
  ));
  const streakCandidate = result.candidates.find((candidate) => (
    candidate.id === "org.seedspec.chore-streaks"
  ));

  assert.equal(savingsCandidate.status, "compatible");
  assert.equal(streakCandidate.status, "review");
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
  assert.equal(result.lock.application.id, "org.seedspec.examples.allowance-tracker");
  assert.ok(result.lock.capabilities.some(
    (capability) => capability.id === "org.seedspec.core.chores"
  ));
  assert.equal(result.artifactIndex.artifacts.length, 1);
  assert.ok(await readFile(
    path.join(result.workspace, result.artifactIndex.artifacts[0].path),
    "utf8"
  ));
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /ask the end user before adopting that workflow/
  );
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
  assert.match(firstSpec, /Capability integration review/);
});

test("missing required capabilities fail resolution clearly", async (t) => {
  const output = await temporaryDirectory(t);

  await assert.rejects(
    resolveProject(allowance, {
      featurePaths: [path.join(fixtures, "unmet-feature")],
      outputDirectory: output
    }),
    (error) => error.code === "MISSING_CAPABILITIES"
      && error.details.some((detail) => detail.includes("org.example.capability.teleportation"))
  );
});

test("configuration overrides are merged then validated", async (t) => {
  const output = await temporaryDirectory(t);

  await assert.rejects(
    resolveProject(allowance, {
      outputDirectory: output,
      applicationConfigurationPath: path.join(fixtures, "invalid-allowance-config.yaml")
    }),
    (error) => error.code === "INVALID_CONFIGURATION"
      && error.details.some((detail) => detail.includes("approval_required"))
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
  const validateArtifactIndex = await compileProtocolSchema("artifact-index.schema.json");
  const project = parseYaml(await readFile(path.join(result.workspace, "project.yaml"), "utf8"));
  const lock = parseYaml(await readFile(path.join(result.workspace, "dependencies.lock.yaml"), "utf8"));
  const resolvedConfiguration = parseYaml(
    await readFile(path.join(result.workspace, "resolved-config.yaml"), "utf8")
  );
  const artifactIndex = parseYaml(
    await readFile(path.join(result.workspace, "artifacts.yaml"), "utf8")
  );

  assert.equal(validateProject(project), true, formatSchemaErrors(validateProject.errors).join("\n"));
  assert.equal(validateLock(lock), true, formatSchemaErrors(validateLock.errors).join("\n"));
  assert.equal(
    validateResolvedConfiguration(resolvedConfiguration),
    true,
    formatSchemaErrors(validateResolvedConfiguration.errors).join("\n")
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
  assert.match(inspection.stdout, /Requires: org\.seedspec\.core\.actors \(tested against 1\.0\.0\)/);
  assert.match(inspection.stdout, /Components: acceptance, integration/);
  assert.match(artifacts.stdout, /ProductSpec/);
  assert.match(productSpec.stdout, /Valid ProductSpec artifact/);
  assert.match(discovery.stdout, /Savings Goals.*compatible/);
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

test("a dependency lock verifies exact package bytes and capability providers", async (t) => {
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
  assert.equal(verified.verifiedCapabilities.length, result.lock.capabilities.length);

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
