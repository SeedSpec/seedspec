import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const cli = path.join(repositoryRoot, "packages/cli/bin/seedspec.js");
const fixture = path.join(repositoryRoot, "conformance/fixtures/comprehensive-application");

function run(arguments_, cwd) {
  return spawnSync(process.execPath, [cli, ...arguments_], {
    cwd,
    encoding: "utf8"
  });
}

test("capabilities prepare, check, and accept preserve author control", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-cli-capabilities-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const packagePath = path.join(temporaryRoot, "package");
  const extractionPath = path.join(temporaryRoot, "extraction");
  await cp(fixture, packagePath, { recursive: true });

  const prepared = run([
    "capabilities",
    "prepare",
    packagePath,
    "--output",
    extractionPath,
    "--json"
  ], temporaryRoot);
  assert.equal(prepared.status, 0, prepared.stderr);
  const preparation = JSON.parse(prepared.stdout);
  assert.ok(preparation.sections > 0);
  const kit = JSON.parse(await readFile(path.join(extractionPath, "extraction-kit.json"), "utf8"));
  const source = kit.sections[0].id;
  const proposalPath = path.join(temporaryRoot, "proposal.yaml");
  await writeFile(proposalPath, stringifyYaml({
    capability_bundle_version: "0.4-experimental",
    package: kit.package,
    authorship: { status: "proposed" },
    capabilities: [{
      id: "org.seedspec.experimental.observable-work",
      version: "0.1.0",
      name: "Observable work",
      description: "Work remains observable across its lifecycle.",
      source_refs: [source],
      outcomes: [{
        id: "work-is-observable",
        description: "An authorized actor can observe current work.",
        source_refs: [source],
        acceptance: [{
          id: "observe-current-work",
          description: "Inspect current work through the realized product.",
          verification: {
            kind: "agent-review",
            stability: "nondeterministic",
            rubric: "Pass only when the observed work matches current authoritative state."
          }
        }]
      }]
    }]
  }), "utf8");

  const checked = run([
    "capabilities",
    "check",
    packagePath,
    "--bundle",
    proposalPath,
    "--stage",
    "authoring",
    "--json"
  ], temporaryRoot);
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(JSON.parse(checked.stdout).status, "pass");

  const acceptedPath = path.join(temporaryRoot, "accepted.yaml");
  const accepted = run([
    "capabilities",
    "accept",
    packagePath,
    "--bundle",
    proposalPath,
    "--accepted-by",
    "package-author",
    "--output",
    acceptedPath,
    "--json"
  ], temporaryRoot);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(JSON.parse(accepted.stdout).bundle.bundle_digest, /^sha256:[a-f0-9]{64}$/u);
  assert.match(await readFile(acceptedPath, "utf8"), /status: accepted/u);
});
