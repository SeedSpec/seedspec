import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptRoot, "../..");
const subjectsRoot = path.join(repositoryRoot, "authoring-evals", "subjects");
const schemasRoot = path.join(repositoryRoot, "authoring-evals", "schemas");
const cliPath = path.join(repositoryRoot, "packages", "cli", "bin", "seedspec.js");

function fail(message) {
  throw new Error(message);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} is required`);
}

async function checkSubject(subjectDirectory) {
  const manifestPath = path.join(subjectDirectory, "subject.yaml");
  const manifest = parseYaml(await readFile(manifestPath, "utf8"));
  if (manifest?.authoring_eval_subject_version !== "1") {
    fail(`${manifestPath}: authoring_eval_subject_version must be "1"`);
  }
  requireString(manifest.id, `${manifestPath}: id`);
  requireString(manifest.description, `${manifestPath}: description`);
  if (!["minimal", "shape", "deep"].includes(manifest.mode)) {
    fail(`${manifestPath}: mode must be minimal, shape, or deep`);
  }
  requireString(manifest.starter?.package, `${manifestPath}: starter.package`);
  requireString(manifest.author_prompt, `${manifestPath}: author_prompt`);
  if (!Array.isArray(manifest.starter?.sources)) {
    fail(`${manifestPath}: starter.sources must be an array`);
  }
  const sourceIds = new Set();
  for (const source of manifest.starter.sources) {
    requireString(source.id, `${manifestPath}: source.id`);
    requireString(source.path, `${manifestPath}: source.path`);
    requireString(source.authority, `${manifestPath}: source.authority`);
    if (sourceIds.has(source.id)) fail(`${manifestPath}: duplicate source ${source.id}`);
    sourceIds.add(source.id);
    await access(path.resolve(subjectDirectory, source.path));
  }
  if (!Array.isArray(manifest.proxy_author?.decisions) || manifest.proxy_author.decisions.length === 0) {
    fail(`${manifestPath}: proxy_author.decisions must not be empty`);
  }
  if (!Array.isArray(manifest.expectations?.documents) || manifest.expectations.documents.length === 0) {
    fail(`${manifestPath}: expectations.documents must not be empty`);
  }
  const packagePath = path.resolve(subjectDirectory, manifest.starter.package);
  await execFileAsync(process.execPath, [cliPath, "validate", packagePath]);
  return manifest.id;
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
  `Authoring evaluation subjects valid: ${checked.join(", ")}; schemas valid: ${schemaEntries.length}\n`
);
