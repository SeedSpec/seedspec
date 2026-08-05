import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  applySkillImportPlan,
  planSkillImport,
  validatePackage
} from "../src/index.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const packageFixture = path.join(
  repositoryRoot,
  "conformance/fixtures/comprehensive-application"
);

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "seedspec-skill-import-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function createSkillSource(root, { configuration = true } = {}) {
  const source = path.join(root, "skill-source");
  await mkdir(path.join(source, "references"), { recursive: true });
  await mkdir(path.join(source, "agents"), { recursive: true });
  await writeFile(path.join(source, "LICENSE"), "Example license\n", "utf8");
  await writeFile(path.join(source, "README.md"), "Repository documentation\n", "utf8");
  await writeFile(
    path.join(source, "SKILL.md"),
    `---
name: example-engineer
description: Implement a SeedSpec package through explicit engineering gates.
---

# Example engineer

Read [gate.md](references/gate.md) before implementation.
`,
    "utf8"
  );
  await writeFile(path.join(source, "references/gate.md"), "# Gate\n", "utf8");
  await writeFile(path.join(source, "agents/openai.yaml"), "interface: {}\n", "utf8");
  if (configuration) {
    await writeFile(
      path.join(source, "seedspec.yaml"),
      `skill:
  entrypoint: SKILL.md
  include:
    - LICENSE
    - SKILL.md
    - agents/
    - references/
  defaults:
    applies_to:
      purposes:
        - implement
      audiences:
        - implementing-agent
`,
      "utf8"
    );
  }
  return source;
}

test("task Skill imports use repository defaults and remain dry-run first", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  await cp(packageFixture, packagePath, { recursive: true });
  const source = await createSkillSource(output);
  const before = await validatePackage(packagePath);

  const plan = await planSkillImport(packagePath, source);
  assert.deepEqual(plan.module.declaration.applies_to, {
    purposes: ["implement"],
    audiences: ["implementing-agent"]
  });
  assert.equal(plan.source.configuration.path, "seedspec.yaml");
  assert.equal((await validatePackage(packagePath)).digest, before.digest);
  await assert.rejects(access(path.join(packagePath, plan.module.destination)));

  const applied = await applySkillImportPlan(plan);
  const updated = await validatePackage(packagePath);
  assert.equal(applied.digest, updated.digest);
  assert.deepEqual(
    updated.manifest.context.modules.find((module) => module.id === "example-engineer"),
    plan.module.declaration
  );
  assert.equal(
    await readFile(path.join(packagePath, plan.module.destination, "SKILL.md"), "utf8"),
    await readFile(path.join(source, "SKILL.md"), "utf8")
  );
  await access(path.join(packagePath, plan.module.destination, "LICENSE"));
  await access(path.join(packagePath, plan.module.destination, "references/gate.md"));
  await assert.rejects(access(path.join(packagePath, plan.module.destination, "README.md")));
  await assert.rejects(access(path.join(packagePath, plan.module.destination, "seedspec.yaml")));

  const repeatedPlan = await planSkillImport(packagePath, source);
  assert.equal(repeatedPlan.module.install, false);
  assert.equal(repeatedPlan.module.declare, false);
  const repeated = await applySkillImportPlan(repeatedPlan);
  assert.equal(repeated.digest, updated.digest);
  assert.equal(repeated.installed, false);
  assert.equal(repeated.declared, false);
});

test("explicit import values override repository applicability defaults", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  await cp(packageFixture, packagePath, { recursive: true });
  const source = await createSkillSource(output);

  const plan = await planSkillImport(packagePath, source, {
    purposes: ["review"],
    audiences: ["reviewer"]
  });
  assert.deepEqual(plan.module.declaration.applies_to, {
    purposes: ["review"],
    audiences: ["reviewer"]
  });
});

test("task Skill imports are unrestricted when the repository has no defaults", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  await cp(packageFixture, packagePath, { recursive: true });
  const source = await createSkillSource(output, { configuration: false });

  const plan = await planSkillImport(packagePath, source);
  assert.equal(plan.source.configuration, null);
  assert.equal(plan.module.declaration.applies_to, undefined);
  assert.deepEqual(plan.source.include, ["LICENSE", "SKILL.md", "agents", "references"]);
});

test("task Skill import rejects malformed repository defaults", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  await cp(packageFixture, packagePath, { recursive: true });
  const source = await createSkillSource(output);
  await writeFile(
    path.join(source, "seedspec.yaml"),
    `skill:
  defaults:
    applies_to:
      purposes: []
`,
    "utf8"
  );

  await assert.rejects(
    planSkillImport(packagePath, source),
    (error) => error.code === "INVALID_SKILL_SOURCE_CONFIG"
  );
});

test("task Skill import rejects source changes after planning", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  await cp(packageFixture, packagePath, { recursive: true });
  const source = await createSkillSource(output);
  const before = await validatePackage(packagePath);
  const plan = await planSkillImport(packagePath, source);
  await writeFile(path.join(source, "references/gate.md"), "# Changed gate\n", "utf8");

  await assert.rejects(
    applySkillImportPlan(plan),
    (error) => error.code === "STALE_SKILL_IMPORT_PLAN"
  );
  assert.equal((await validatePackage(packagePath)).digest, before.digest);
  await assert.rejects(access(path.join(packagePath, plan.module.destination)));
});

test("applied task Skill declarations remain valid package YAML", async (t) => {
  const output = await temporaryDirectory(t);
  const packagePath = path.join(output, "package");
  await cp(packageFixture, packagePath, { recursive: true });
  const source = await createSkillSource(output);
  await applySkillImportPlan(await planSkillImport(packagePath, source));

  const manifest = parseYaml(await readFile(path.join(packagePath, "seedspec.yaml"), "utf8"));
  assert.equal(manifest.context.modules.at(-1).format, "io.agentskills.skill");
});
