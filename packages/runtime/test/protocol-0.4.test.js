import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  computePackageDigest,
  flattenManifest,
  inspectPackage,
  validatePackage
} from "../src/index.js";

async function workspace() {
  return mkdtemp(path.join(os.tmpdir(), "seedspec-0.4-"));
}

async function put(root, relativePath, content) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return target;
}

function minimumFrontmatter(id = "minimum") {
  return `id: ${id}
name: Minimum
kind: application
version: "1.0.0"`;
}

test("a single SPEC.md with a dotted ID and custom kind is a complete package", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
id: acme.dashboard-builder
name: Minimum
kind: product-spec
version: "1.0.0"
---
# Minimum

Keep the package small.
`);

  const record = await validatePackage(root);
  assert.equal(record.manifest.id, "acme.dashboard-builder");
  assert.equal(record.manifest.name, "Minimum");
  assert.equal(record.manifest.kind, "product-spec");
  assert.equal(record.manifest.version, "1.0.0");
  assert.equal(record.manifest.target_protocol, undefined);
  assert.equal(record.manifestPath, null);
  assert.match(record.definition, /Keep the package small/u);
  assert.equal(record.digest, await computePackageDigest(root));
});

test("kind may be omitted from a complete package", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
id: no-kind
name: No kind
version: "1.0.0"
---
# No kind

Keep the package small.
`);
  const record = await validatePackage(root);
  assert.equal(record.manifest.kind, undefined);
  const inspection = await inspectPackage(root);
  assert.equal(inspection.kind, null);
});

test("SPEC.md overrides the base manifest and arrays replace", async () => {
  const root = await workspace();
  await put(root, "seedspec.yaml", `id: merged
name: Base name
kind: workflow
version: "1.0.0"
target_protocol: "0.4"
configuration:
  variables:
    - id: base-value
      type: string
      description: Base value.
`);
  await put(root, "SPEC.md", `---
name: Frontmatter name
configuration:
  variables:
    - id: selected-value
      type: boolean
      description: Selected value.
      default: false
      example: true
---
# Merged
`);

  const record = await validatePackage(root);
  assert.equal(record.manifest.version, "1.0.0");
  assert.equal(record.manifest.name, "Frontmatter name");
  assert.deepEqual(
    record.manifest.configuration.variables.map(({ id }) => id),
    ["selected-value"]
  );
  assert.deepEqual(
    record.provenance.overrides.map(({ path: field }) => field).sort(),
    ["$.configuration.variables", "$.name"]
  );
  assert.match(record.provenance.sources["$.version"].file, /seedspec\.yaml$/u);
  assert.match(record.provenance.sources["$.name"].file, /SPEC\.md$/u);

  const inspection = await inspectPackage(root);
  assert.equal(inspection.overrides.length, 2);
  assert.equal(inspection.resolved_manifest.name, "Frontmatter name");
  assert.match(inspection.sources.values["$.version"].file, /seedspec\.yaml$/u);
});

test("external sections expand in declaration order for every structured subject", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
${minimumFrontmatter("sections")}
configuration:
  sections:
    - id: inline-config
      variables:
        - id: enabled
          type: boolean
          description: Enable the feature.
          default: true
    - id: external-config
      path: configuration/external.yaml
success:
  sections:
    - id: acceptance
      path: success/acceptance.yaml
capabilities:
  sections:
    - id: behavior
      path: capabilities/behavior.yaml
tasks:
  sections:
    - id: first
      items:
        - id: inspect
          instruction: Inspect the package.
          capabilities: [reporting]
          success_criteria: [complete]
    - id: second
      path: tasks/second.yaml
---
# Sections [success:complete]

Implement the declared behavior.
`);
  await put(root, "configuration/external.yaml", `variables:
  - id: recipients
    type: array
    items:
      type: string
    description: Report recipients.
    example: [operations]
`);
  await put(root, "success/acceptance.yaml", `criteria:
  - id: complete
    description: The implementation is complete.
`);
  await put(root, "capabilities/behavior.yaml", `items:
  - id: reporting
    name: Reporting
    description: Produces the report.
    outcomes:
      - id: result
        description: A report is available.
    success_criteria: [complete]
`);
  await put(root, "tasks/second.yaml", `items:
  - id: implement
    instruction: Implement the package.
    capabilities: [reporting]
    success_criteria: [complete]
`);

  const record = await validatePackage(root);
  assert.deepEqual(
    record.manifest.configuration.variables.map(({ id }) => id),
    ["enabled", "recipients"]
  );
  assert.deepEqual(record.manifest.tasks.items.map(({ id }) => id), ["inspect", "implement"]);
  assert.deepEqual(record.manifest.capabilities.items.map(({ id }) => id), ["reporting"]);
  assert.equal(record.provenance.sections.length, 6);
});

test("configuration defaults, examples, options, and arrays are type checked", async () => {
  const valid = await workspace();
  await put(valid, "SPEC.md", `---
${minimumFrontmatter("configuration")}
configuration:
  variables:
    - id: frequency
      name: Frequency
      type: string
      description: Report frequency.
      required: true
      default: daily
      example: weekly
      options: [daily, weekly]
    - id: recipients
      type: array
      items:
        type: string
      description: Report recipients.
      default: [operations]
---
# Configuration
`);
  await validatePackage(valid);

  const invalid = await workspace();
  await put(invalid, "SPEC.md", `---
${minimumFrontmatter("invalid-configuration")}
configuration:
  variables:
    - id: frequency
      type: string
      description: Report frequency.
      default: monthly
      options: [daily, weekly]
---
# Invalid configuration
`);
  await assert.rejects(validatePackage(invalid), { code: "INVALID_CONFIGURATION_VALUE" });
});

test("success anchors connect prose to criteria and ignore code", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
${minimumFrontmatter("anchors")}
success:
  criteria:
    - id: configured-destination
      description: Delivery uses the configured destination.
    - id: unanchored
      description: Another condition holds.
---
# Delivery [success:configured-destination]

Use the configured destination.

\`[success:not-an-anchor]\`

\\[success:also-not-an-anchor]

\`\`\`
[success:fenced-anchor]
\`\`\`
`);

  const inspection = await inspectPackage(root);
  assert.deepEqual(
    inspection.success_anchors.map(({ id, scope }) => ({ id, scope })),
    [{ id: "configured-destination", scope: "section" }]
  );
  assert.deepEqual(inspection.unanchored_success_criteria, ["unanchored"]);

  const invalid = await workspace();
  await put(invalid, "SPEC.md", `---
${minimumFrontmatter("unknown-anchor")}
---
# Invalid [success:missing]
`);
  await assert.rejects(validatePackage(invalid), { code: "INVALID_SUCCESS_ANCHOR" });
});

test("context modules use direct entrypoints, optional formats, and local applicability", async () => {
  const root = await workspace();
  await put(root, "SPEC.md", `---
${minimumFrontmatter("context")}
success:
  criteria:
    - id: complete
      description: The work is complete.
capabilities:
  items:
    - id: reporting
      name: Reporting
      description: Produces a report.
      success_criteria: [complete]
context_modules:
  - id: implementation-guidance
    type: skill
    description: Implementation guidance.
    path: context-modules/implementation-guidance/SKILL.md
    format:
      id: agent-skills
      path: formats/agent-skills.md
      url: https://agentskills.io/specification
    applies_to:
      stages: [implementation]
      capabilities: [reporting]
  - id: cloudflare-worker
    type: implementation-profile
    description: Realize the package on Cloudflare Workers.
    path: context-modules/cloudflare-worker/PROFILE.md
  - id: evaluation
    type: evaluation
    description: Evaluate completion.
    path: context-modules/evaluation/EVAL.md
    applies_to:
      stages: [verification]
      success_criteria: [complete]
---
# Context [success:complete]
`);
  await put(root, "context-modules/implementation-guidance/SKILL.md", "# Guidance\n");
  await put(
    root,
    "context-modules/cloudflare-worker/PROFILE.md",
    "Use Cloudflare Workers. No profile headings are required.\n"
  );
  await put(root, "context-modules/evaluation/EVAL.md", "# Evaluation\n");
  await put(root, "formats/agent-skills.md", "# Agent Skills format\n");

  const record = await validatePackage(root);
  assert.deepEqual(
    record.manifest.context_modules.map(({ type }) => type),
    ["skill", "implementation-profile", "evaluation"]
  );

  const invalid = await workspace();
  await put(invalid, "SPEC.md", `---
${minimumFrontmatter("invalid-profile")}
context_modules:
  - id: profile
    type: implementation-profile
    description: Invalid profile entrypoint.
    path: context-modules/profile/SKILL.md
---
# Invalid profile
`);
  await put(invalid, "context-modules/profile/SKILL.md", "# Not a profile\n");
  await assert.rejects(validatePackage(invalid), { code: "INVALID_CONTEXT_MODULE_PATH" });
});

test("optional bundled packages preserve independent identity and provenance", async () => {
  const root = await workspace();
  const child = path.join(root, "bundled-packages", "child");
  await put(child, "SPEC.md", `---
id: child
name: Child
kind: feature
version: "2.0.0"
capabilities:
  items:
    - id: ready
      name: Ready
      description: Reports readiness.
---
# Child
`);
  const childDigest = await computePackageDigest(child);
  await put(root, "SPEC.md", `---
${minimumFrontmatter("parent")}
bundled_packages:
  - id: child
    version: "2.0.0"
    digest: ${childDigest}
    path: bundled-packages/child/SPEC.md
    optional: true
---
# Parent
`);

  const record = await validatePackage(root);
  assert.equal(record.bundledPackages[0].record.manifest.id, "child");
  assert.equal(record.bundledPackages[0].record.digest, childDigest);
  const inspection = await inspectPackage(root);
  assert.equal(inspection.bundled_packages[0].optional, true);
});

test("flatten produces a self-contained manifest source", async () => {
  const root = await workspace();
  await put(root, "seedspec.yaml", `${minimumFrontmatter("flattened")}
tasks:
  sections:
    - id: work
      path: tasks/work.yaml
`);
  await put(root, "SPEC.md", "# Flattened\n");
  await put(root, "tasks/work.yaml", `items:
  - id: work
    instruction: Do the work.
`);
  const record = await validatePackage(root);
  const flattened = flattenManifest(record);
  const output = await workspace();
  await put(output, "SPEC.md", flattened);
  const flattenedRecord = await validatePackage(output);

  assert.equal(flattenedRecord.manifest.id, "flattened");
  assert.deepEqual(flattenedRecord.manifest.tasks.items.map(({ id }) => id), ["work"]);
  assert.match(await readFile(path.join(output, "SPEC.md"), "utf8"), /Generated from sha256:/u);
});

test("duplicate YAML keys and unresolved references are invalid", async () => {
  const duplicate = await workspace();
  await put(duplicate, "SPEC.md", `---
id: duplicate
id: other
name: Duplicate
kind: application
version: "1.0.0"
---
# Duplicate
`);
  await assert.rejects(validatePackage(duplicate), { code: "INVALID_YAML" });

  const reference = await workspace();
  await put(reference, "SPEC.md", `---
${minimumFrontmatter("reference")}
tasks:
  items:
    - id: work
      instruction: Do the work.
      success_criteria: [missing]
---
# Reference
`);
  await assert.rejects(validatePackage(reference), { code: "INVALID_CROSS_REFERENCE" });
});

test("referenced files cannot traverse package symlinks", async () => {
  const root = await workspace();
  const outside = await workspace();
  await put(outside, "tasks.yaml", "items: []\n");
  await put(root, "SPEC.md", `---
${minimumFrontmatter("symlink")}
tasks:
  sections:
    - id: escaped
      path: tasks/escaped.yaml
---
# Symlink
`);
  await mkdir(path.join(root, "tasks"), { recursive: true });
  await symlink(path.join(outside, "tasks.yaml"), path.join(root, "tasks", "escaped.yaml"));
  await assert.rejects(validatePackage(root), { code: "UNSAFE_PACKAGE_CONTENT" });
});
