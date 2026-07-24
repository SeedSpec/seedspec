import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function digest(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function collectFiles(relativeDirectory, current = relativeDirectory, files = []) {
  const entries = await readdir(path.join(root, current), { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(relativeDirectory, relativePath, files);
    } else if (entry.isFile()) {
      files.push(path.relative(relativeDirectory, relativePath).split(path.sep).join("/"));
    }
  }
  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const release = await readJson("release.json");
const rootPackage = await readJson("package.json");
const protocolPackage = await readJson("packages/protocol/package.json");
const runtimePackage = await readJson("packages/runtime/package.json");
const cliPackage = await readJson("packages/cli/package.json");
const manifest = await readJson("packages/protocol/protocol-release.json");
const bundle = await readJson("packages/protocol/conformance-bundle.json");

const packages = [protocolPackage, runtimePackage, cliPackage];
assert(rootPackage.version === release.release_version,
  `Root version must be ${release.release_version}`);
assert(!rootPackage.version.includes("-"),
  "Root release must not use a prerelease version");
for (const packageJson of packages) {
  assert(packageJson.version === release.release_version,
    `${packageJson.name} version must be ${release.release_version}`);
  assert(!packageJson.version.includes("-"),
    `${packageJson.name} must not use a prerelease version`);
}
assert(
  JSON.stringify(packages.map(({ name }) => name)) === JSON.stringify(release.packages),
  "release.json package inventory does not match the workspace"
);
assert(
  runtimePackage.dependencies["@seedspec/protocol"] === release.release_version,
  "@seedspec/runtime must pin the exact protocol release"
);
assert(
  cliPackage.dependencies["@seedspec/runtime"] === release.release_version,
  "@seedspec/cli must pin the exact runtime release"
);

assert(manifest.release_id === release.release_version,
  "Protocol release identifier does not match release.json");
assert(manifest.protocol_family === release.protocol_family,
  "Protocol family does not match release.json");
assert(manifest.status === release.status,
  "Protocol release status does not match release.json");
assert(manifest.schema_package.version === release.release_version,
  "Protocol schema package version does not match release.json");
assert(manifest.conformance.suite_version === release.conformance_suite_version,
  "Conformance suite version does not match release.json");
assert(bundle.suite_version === release.conformance_suite_version,
  "Conformance bundle version does not match release.json");
assert(bundle.protocol_family === release.protocol_family,
  "Conformance bundle protocol family does not match release.json");
assert(
  release.schema_urls.exact
    === `https://seedspec.dev/releases/${release.release_version}/schemas/`,
  "Exact schema base URL does not match the release version"
);
assert(
  release.schema_urls.family_alias
    === `https://seedspec.dev/schemas/v${release.protocol_family}/`,
  "Schema family alias does not match the protocol family"
);
assert(manifest.implementations.runtime.version === release.release_version,
  "Runtime release binding does not match release.json");
assert(manifest.implementations.cli.version === release.release_version,
  "CLI release binding does not match release.json");

const schemaPrefix = `packages/protocol/schemas/v${release.protocol_family}/`;
const exactSchemaPrefix = release.schema_urls.exact;
const schemaNames = (await readdir(path.join(root, schemaPrefix)))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const releasedSchemaNames = manifest.schemas
  .map(({ path: filePath }) => path.basename(filePath))
  .sort();
assert(JSON.stringify(schemaNames) === JSON.stringify(releasedSchemaNames),
  "Protocol schema inventory does not match the release manifest");
for (const entry of manifest.schemas) {
  assert(entry.path.startsWith(schemaPrefix),
    `Released schema path is outside ${schemaPrefix}: ${entry.path}`);
  assert(await digest(entry.path) === entry.digest,
    `Released schema digest does not match: ${entry.path}`);
  const schema = await readJson(entry.path);
  assert(schema.$id === `${exactSchemaPrefix}${path.basename(entry.path)}`,
    `Schema does not use the exact release URL: ${entry.path}`);
}

for (const entry of manifest.documents) {
  assert(entry.path.startsWith("documents/"),
    `Released document must be package-local: ${entry.path}`);
  const packagePath = `packages/protocol/${entry.path}`;
  assert(await digest(packagePath) === entry.digest,
    `Released document digest does not match: ${packagePath}`);
  const sourcePath = `docs/${path.basename(entry.path)}`;
  assert(await digest(sourcePath) === entry.digest,
    `Normative source document has drifted from the protocol package: ${sourcePath}`);
}

const sourceSkills = (await collectFiles("skills")).sort();
const bundledSkills = (await collectFiles("packages/cli/skills")).sort();
assert(JSON.stringify(sourceSkills) === JSON.stringify(bundledSkills),
  "Bundled CLI skill inventory has drifted from the source skills");
for (const skillPath of sourceSkills) {
  assert(
    await digest(`skills/${skillPath}`)
      === await digest(`packages/cli/skills/${skillPath}`),
    `Bundled CLI skill has drifted from its source: ${skillPath}`
  );
}

console.log(
  `SeedSpec ${release.release_version} is internally aligned: `
  + `${schemaNames.length} schemas, ${manifest.documents.length} documents, `
  + `${sourceSkills.length} skill files, conformance ${release.conformance_suite_version}.`
);
