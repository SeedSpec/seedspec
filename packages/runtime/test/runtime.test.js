import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  beginPackage,
  completionScopeDigest,
  computeDirectoryDigest,
  discoverFeatures,
  formatBuyerAgentPrompt,
  formatPackageBeginning,
  inspectPackage,
  inspectProjectCompletion,
  initPackage,
  listArtifactAdapters,
  listPackageArtifacts,
  listPackageImplementationResources,
  lintPackage,
  recordImplementationResourceUse,
  resolveImplementationResources,
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
const allowance = path.join(root, "conformance/fixtures/comprehensive-application");
const savings = path.join(root, "conformance/fixtures/portable-feature");
const streaks = path.join(root, "conformance/fixtures/revision-feature");
const hubspotMetric = path.join(root, "conformance/fixtures/profiled-workflow");
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
  assert.equal(application.manifest.artifacts[0].type, "org.seedspec.artifact.product-spec");
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

test("kind-aware linting separates protocol validity from authoring feedback", async (t) => {
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
    path.join(packagePath, manifest.definition.entrypoint),
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
});

test("implementation profiles require user choice when ambiguous and preserve profile state", async (t) => {
  const output = await temporaryDirectory(t);
  const configurationSelectionsPath = await writeExampleConfigurationSelections(
    output,
    [hubspotMetric]
  );
  const unresolved = await resolveProject(hubspotMetric, {
    configurationSelectionsPath,
    outputDirectory: path.join(output, "unresolved")
  });
  const unresolvedGuide = await readFile(
    path.join(unresolved.workspace, "agent-guide.md"),
    "utf8"
  );

  assert.equal(unresolved.project.status, "needs-input");
  assert.equal(unresolved.project.implementation_profile_status, "review");
  assert.match(unresolvedGuide, /Do not choose silently/);
  assert.match(unresolvedGuide, /ask the end user which direction to prefer/);

  const preferred = await resolveProject(hubspotMetric, {
    configurationSelectionsPath,
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

  assert.equal(beginning.package.id, "org.seedspec.fixtures.comprehensive-application");
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
  assert.match(prompt, /bundled compatible workflow instructions.*fallback reason/i);
  assert.doesNotMatch(prompt, /npx|npm install/);
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
  assert.ok(await readFile(
    path.join(result.workspace, resource.bundled.path, resource.entrypoint),
    "utf8"
  ));
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /resolve-resources.*report fallback use.*inspect skill frontmatter/is
  );
  assert.match(
    await readFile(path.join(result.workspace, "agent-guide.md"), "utf8"),
    /implementation resource org\.seedspec\.fixtures\.comprehensive-application\/org\.seedspec\.guidance\.authorization-decisions/
  );

  const fileDigest = `sha256:${createHash("sha256").update(fixture.skillSource).digest("hex")}`;
  const remoteManifest = {
    protocol_version: "0.1",
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
    { fetchImpl }
  );
  assert.equal(resolvedState.status, "resolved");
  assert.equal(resolvedState.resources[0].resolution_status, "online");
  assert.equal(resolvedState.resources[0].resolved_version, "0.1.0");
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
      useStatus: "loaded",
      reason: "Relevant to the selected actor and target decisions."
    }
  );
  assert.equal(useRecord.use_status, "loaded");
  assert.match(useRecord.use_reason, /selected actor and target/);

  const rerun = await resolveProject(fixture.packagePath, {
    outputDirectory: path.join(fixture.output, "project"),
    technicalPreferencesPath
  });
  const preservedState = parseYaml(await readFile(
    path.join(rerun.workspace, "implementation-resource-state.yaml"),
    "utf8"
  ));
  assert.equal(preservedState.resources[0].use_status, "loaded");
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
    })
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
    }
  });

  assert.equal(fetchCalls, 1);
  assert.equal(state.resources[0].resolution_status, "bundled-fallback");
  assert.equal(state.resources[0].reason_code, "INVALID_IMPLEMENTATION_RESOURCE");
  assert.match(state.resources[0].reason, /local or private network host/);
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
    protocol_version: "0.1",
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
    fetchImpl: async () => new Response(JSON.stringify(remoteManifest), { status: 200 })
  });

  assert.equal(state.resources[0].resolution_status, "bundled-fallback");
  assert.equal(state.resources[0].reason_code, "IMPLEMENTATION_RESOURCE_VERSION_MISMATCH");
  assert.match(state.resources[0].reason, /older version/);
});

test("required unavailable resources fail after recording resolution state", async (t) => {
  const fixture = await createImplementationResourcePackage(t, {
    includeBundled: false,
    usage: "required"
  });
  const projectPath = path.join(fixture.output, "project");
  const result = await resolveProject(fixture.packagePath, { outputDirectory: projectPath });

  await assert.rejects(
    resolveImplementationResources(projectPath, {
      fetchImpl: async () => new Response("unavailable", { status: 503 })
    }),
    (error) => error.code === "REQUIRED_IMPLEMENTATION_RESOURCE_UNAVAILABLE"
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
    (error) => error.code === "INVALID_REFERENCES"
      && error.details.some((detail) => detail.includes("definition.entrypoint"))
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
  assert.equal(result.project.artifact_status, "review");
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
      package: "org.seedspec.fixtures.comprehensive-application",
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
          package: "org.seedspec.fixtures.comprehensive-application",
          artifact: "product-spec"
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
  assert.match(guide, /artifact org\.seedspec\.fixtures\.comprehensive-application\/product-spec/);
  assert.match(guide, /Even a selected artifact does not authorize/);
});

test("invalid artifact and implementation-target references fail before handoff", async (t) => {
  const output = await temporaryDirectory(t);
  const invalidSelectionsPath = path.join(output, "invalid-artifact-selections.yaml");
  const preferencesPath = path.join(output, "technical-preferences.yaml");
  await writeFile(invalidSelectionsPath, stringifyYaml({
    protocol_version: "0.1",
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
      package: "org.seedspec.fixtures.comprehensive-application",
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

test("the comprehensive application composes with a portable feature into a stable workspace", async (t) => {
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
    "resolved-config.yaml",
    "components.yaml",
    "artifacts.yaml",
    "implementation-resources.yaml",
    "implementation-resource-state.yaml",
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
  const exampleResult = await resolveProject(allowance, {
    outputDirectory: path.join(output, "example-project"),
    configurationSelectionsPath: examplePath
  });
  assert.equal(exampleResult.project.status, "ready");
  assert.equal(exampleResult.project.configuration_status, "selected");
  assert.equal(exampleResult.resolvedConfiguration.root.selection, "example");

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
  assert.equal(customResult.resolvedConfiguration.root.selection, "custom");
  assert.equal(customResult.resolvedConfiguration.root.values.approval_required, false);

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
        packages: [{ package: "org.seedspec.fixtures.comprehensive-application", selection: "example" }]
      },
      code: "MISSING_CONFIGURATION_SELECTION"
    },
    {
      name: "duplicate",
      input: {
        protocol_version: "0.1",
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
        protocol_version: "0.1",
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
  const completionScopePath = path.join(output, "completion-input.yaml");
  await writeFile(completionScopePath, stringifyYaml({
    protocol_version: "0.1",
    items: [
      {
        kind: "component",
        id: "allowance-acceptance",
        package: "org.seedspec.fixtures.comprehensive-application",
        component: "acceptance",
        selection: "all"
      },
      {
        kind: "component",
        id: "savings-acceptance",
        package: "org.seedspec.fixtures.portable-feature",
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
      package: "org.seedspec.fixtures.comprehensive-application",
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
      package: "org.seedspec.fixtures.comprehensive-application",
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
      package: "org.seedspec.fixtures.comprehensive-application",
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
  const expectedSection = new Map([
    ["solution", "## Boundaries"],
    ["application", "## Actors and permissions"],
    ["feature", "## Host boundary"],
    ["workflow", "## Stages and handoffs"],
    ["automation", "## Trigger or schedule"],
    ["configuration", "## Desired state"],
    ["integration", "## Concept and data mappings"]
  ]);
  for (const [kind, section] of expectedSection) {
    const packagePath = path.join(output, kind);
    await initPackage(kind, packagePath);
    const record = await validatePackage(packagePath);
    assert.equal(record.manifest.kind, kind);
    assert.match(record.definition, new RegExp(section));
  }
});

test("CLI validates and inspects the comprehensive application fixture", async () => {
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const validation = await execFileAsync(process.execPath, [cli, "validate", allowance]);
  const prompt = await execFileAsync(process.execPath, [cli, "prompt"]);
  const beginning = await execFileAsync(process.execPath, [cli, "begin", allowance]);
  const inspection = await execFileAsync(process.execPath, [cli, "inspect", savings]);
  const lint = await execFileAsync(process.execPath, [cli, "lint", hubspotMetric]);
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
    path.join(root, "conformance/fixtures")
  ]);

  assert.match(validation.stdout, /Valid SeedSpec package: org\.seedspec\.fixtures\.comprehensive-application/);
  assert.match(validation.stdout, /Kind hint: application/);
  assert.match(prompt.stdout, /Use this SeedSpec package/);
  assert.match(beginning.stdout, /Do not begin implementation yet/);
  assert.match(beginning.stdout, /CONFIGURATION_EXAMPLE_REQUIRES_REVIEW/);
  assert.match(beginning.stdout, /Discovery does not activate optional material/);
  assert.match(inspection.stdout, /Requires: org\.seedspec\.core\.actors \(tested against 1\.0\.0\)/);
  assert.match(lint.stdout, /Kind-aware authoring review: Profiled Workflow Fixture/);
  assert.match(lint.stdout, /Kind hint: workflow/);
  assert.match(inspection.stdout, /Components: acceptance, integration/);
  assert.match(artifacts.stdout, /ProductSpec/);
  assert.match(productSpec.stdout, /Valid ProductSpec artifact/);
  assert.match(discovery.stdout, /Portable Feature Fixture.*candidate/);
});

test("CLI -i records a preferred implementation profile", async (t) => {
  const output = await temporaryDirectory(t);
  const cli = path.join(root, "packages/cli/bin/seedspec.js");
  const result = await execFileAsync(process.execPath, [
    cli,
    "resolve",
    hubspotMetric,
    "-i",
    "hubspot-native",
    "--configuration-selections",
    path.join(fixtures, "profiled-workflow-configuration-selection.yaml"),
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
    "loaded",
    "--reason",
    "Relevant test fixture"
  ]);

  assert.match(listing.stdout, /authorization-decisions.*recommended/);
  assert.equal(digest.stdout.trim(), fixture.digest);
  assert.match(resolution.stdout, /authorization-decisions: bundled/);
  assert.match(usage.stdout, /loaded.*Relevant test fixture/);
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

test("alpha format suite passes every declared case", async () => {
  const result = await runConformanceSuite(path.join(root, "conformance/cases.yaml"));
  assert.equal(result.failed, 0, JSON.stringify(result.results.filter((item) => !item.passed), null, 2));
  assert.ok(result.total >= 15);
});
