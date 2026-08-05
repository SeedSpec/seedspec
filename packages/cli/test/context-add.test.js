import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const cli = path.join(repositoryRoot, "packages/cli/bin/seedspec.js");
const fixture = path.join(
  repositoryRoot,
  "conformance/fixtures/comprehensive-application"
);

function run(arguments_, cwd) {
  return spawnSync(process.execPath, [cli, ...arguments_], {
    cwd,
    encoding: "utf8"
  });
}

test("context add reads Skill defaults and writes only with --write", async (t) => {
  const output = await mkdtemp(path.join(tmpdir(), "seedspec-cli-context-add-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  const packagePath = path.join(output, "package");
  const skillPath = path.join(output, "skill");
  await cp(fixture, packagePath, { recursive: true });
  await mkdir(path.join(skillPath, "references"), { recursive: true });
  await writeFile(
    path.join(skillPath, "SKILL.md"),
    `---
name: cli-engineer
description: Implement SeedSpec packages through a bounded engineering loop.
---

# CLI engineer
`,
    "utf8"
  );
  await writeFile(path.join(skillPath, "references/gates.md"), "# Gates\n", "utf8");
  await writeFile(
    path.join(skillPath, "seedspec.yaml"),
    `skill:
  entrypoint: SKILL.md
  include:
    - SKILL.md
    - references/
  defaults:
    applies_to:
      purposes: [implement]
      audiences: [implementing-agent]
`,
    "utf8"
  );
  const manifestPath = path.join(packagePath, "seedspec.yaml");
  const original = await readFile(manifestPath, "utf8");

  const planned = run([
    "context",
    "add",
    packagePath,
    "--skill",
    skillPath,
    "--json"
  ], output);
  assert.equal(planned.status, 0, planned.stderr);
  const plan = JSON.parse(planned.stdout);
  assert.deepEqual(plan.module.declaration.applies_to, {
    purposes: ["implement"],
    audiences: ["implementing-agent"]
  });
  assert.equal(await readFile(manifestPath, "utf8"), original);

  const conflictingMode = run([
    "context",
    "add",
    packagePath,
    "--skill",
    skillPath,
    "--write",
    "--dry-run"
  ], output);
  assert.notEqual(conflictingMode.status, 0);
  assert.match(conflictingMode.stderr, /Choose either --write or --dry-run/u);

  const applied = run([
    "context",
    "add",
    packagePath,
    "--skill",
    skillPath,
    "--purpose",
    "verify",
    "--audience",
    "implementing-agent",
    "--write",
    "--json"
  ], output);
  assert.equal(applied.status, 0, applied.stderr);
  const result = JSON.parse(applied.stdout);
  assert.equal(result.module.applies_to.purposes[0], "verify");

  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  const module = manifest.context.modules.find((candidate) => candidate.id === "cli-engineer");
  assert.deepEqual(module.applies_to, {
    purposes: ["verify"],
    audiences: ["implementing-agent"]
  });
  assert.equal(
    await readFile(path.join(packagePath, module.source.path, "SKILL.md"), "utf8"),
    await readFile(path.join(skillPath, "SKILL.md"), "utf8")
  );
});
