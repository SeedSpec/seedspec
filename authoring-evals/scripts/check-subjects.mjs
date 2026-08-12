import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptRoot, "../..");
const subjectsRoot = path.join(repositoryRoot, "authoring-evals", "subjects");
const schemasRoot = path.join(repositoryRoot, "authoring-evals", "schemas");
const cliPath = path.join(repositoryRoot, "packages", "cli", "bin", "seedspec.js");
const subjectSchema = JSON.parse(
  await readFile(path.join(schemasRoot, "subject.schema.json"), "utf8")
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSubject = ajv.compile(subjectSchema);
const EXPECTED_V2_ROLES = [
  "sparse-product-idea",
  "mature-requirements",
  "controlled-revision",
  "fixed-context-modules",
  "fresh-context-recovery",
  "composition-conflict"
];

function fail(message) {
  throw new Error(message);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} is required`);
}

async function checkSubject(subjectDirectory) {
  const manifestPath = path.join(subjectDirectory, "subject.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  if (!validateSubject(manifest)) {
    const details = (validateSubject.errors ?? [])
      .map(({ instancePath, message }) => `${instancePath || "/"} ${message}`)
      .join("; ");
    fail(`${manifestPath}: subject schema validation failed: ${details}`);
  }
  const sourceIds = new Set();
  for (const source of manifest.starter.sources) {
    if (sourceIds.has(source.id)) fail(`${manifestPath}: duplicate source ${source.id}`);
    sourceIds.add(source.id);
    await access(path.resolve(subjectDirectory, source.path));
  }
  const packagePath = path.resolve(subjectDirectory, manifest.starter.package);
  for (const expectation of manifest.expectations.documents ?? []) {
    await access(path.resolve(packagePath, expectation.path));
  }
  if (manifest.authoring_eval_subject_version === "2") {
    for (const decision of manifest.proxy_author.decisions) {
      for (const phrase of decision.match.any) {
        if (phrase !== phrase.toLocaleLowerCase("en-US")) {
          fail(`${manifestPath}: proxy matcher must be lowercase: ${phrase}`);
        }
      }
    }
    for (const group of [
      "meaning",
      "decisions",
      "obligations",
      "permitted_variability",
      "forbidden_inventions"
    ]) {
      const ids = new Set();
      for (const item of manifest.reference[group]) {
        if (ids.has(item.id)) fail(`${manifestPath}: duplicate reference.${group} id ${item.id}`);
        ids.add(item.id);
      }
    }
    for (const protectedPath of manifest.reference.protected_paths) {
      await access(path.resolve(packagePath, protectedPath.path));
    }
    for (const claim of manifest.fixed_claim_contract ?? []) {
      await access(path.resolve(subjectDirectory, claim.source));
      for (const target of claim.targets) {
        await access(path.resolve(packagePath, target.path));
      }
    }
  }
  await execFileAsync(process.execPath, [cliPath, "validate", packagePath]);
  return { id: manifest.id, version: manifest.authoring_eval_subject_version, role: manifest.corpus_role };
}

const entries = await readdir(subjectsRoot, { withFileTypes: true });
const subjectDirectories = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(subjectsRoot, entry.name))
  .sort();
if (subjectDirectories.length === 0) fail("No authoring evaluation subjects found");

const checked = [];
for (const subjectDirectory of subjectDirectories) {
  checked.push(await checkSubject(subjectDirectory));
}
const v2Roles = checked.filter(({ version }) => version === "2").map(({ role }) => role).sort();
if (v2Roles.length > 0 && JSON.stringify(v2Roles) !== JSON.stringify([...EXPECTED_V2_ROLES].sort())) {
  fail(`Version 2 corpus roles must be exactly: ${EXPECTED_V2_ROLES.join(", ")}; received: ${v2Roles.join(", ")}`);
}
const schemaEntries = (await readdir(schemasRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .sort((left, right) => left.name.localeCompare(right.name, "en"));
for (const entry of schemaEntries) {
  const schemaPath = path.join(schemasRoot, entry.name);
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  requireString(schema.$schema, `${schemaPath}: $schema`);
  requireString(schema.$id, `${schemaPath}: $id`);
}
process.stdout.write(
  `Authoring evaluation subjects valid: ${checked.map(({ id }) => id).join(", ")}; schemas valid: ${schemaEntries.length}\n`
);
