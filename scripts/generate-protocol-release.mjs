import { createHash } from "node:crypto";
import {
  lstat,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const protocolDirectory = path.join(root, "packages/protocol");
const schemaDirectory = path.join(protocolDirectory, "schemas/v0.1");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function digest(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function digestedFile(relativePath) {
  return {
    path: relativePath,
    digest: await digest(relativePath)
  };
}

function lexicalCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

async function collectDirectoryFiles(directory, current = directory, files = []) {
  const entries = (await readdir(current, { withFileTypes: true }))
    .sort((left, right) => lexicalCompare(left.name, right.name));
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(directory, absolutePath).split(path.sep).join("/");
    const info = await lstat(absolutePath);
    if (info.isSymbolicLink()) {
      throw new Error(`Release inputs must not contain symbolic links: ${relativePath}`);
    }
    if (info.isDirectory()) {
      await collectDirectoryFiles(directory, absolutePath, files);
    } else if (info.isFile()) {
      files.push({ absolutePath, relativePath });
    } else {
      throw new Error(`Release inputs must contain only files and directories: ${relativePath}`);
    }
  }
  return files;
}

async function directoryDigest(relativePath, { exclude = () => false } = {}) {
  const directory = path.join(root, relativePath);
  const files = (await collectDirectoryFiles(directory)).filter((file) => (
    !exclude(file.relativePath)
  ));
  files.sort((left, right) => lexicalCompare(left.relativePath, right.relativePath));
  const aggregate = createHash("sha256");
  for (const file of files) {
    const fileHash = createHash("sha256")
      .update(await readFile(file.absolutePath))
      .digest("hex");
    aggregate.update(file.relativePath, "utf8");
    aggregate.update("\0", "utf8");
    aggregate.update(fileHash, "ascii");
    aggregate.update("\n", "utf8");
  }
  return `sha256:${aggregate.digest("hex")}`;
}

async function createConformanceBundle(bundleDigest) {
  const directory = path.join(root, "conformance");
  const files = await collectDirectoryFiles(directory);
  files.sort((left, right) => lexicalCompare(left.relativePath, right.relativePath));
  return {
    bundle_version: "1",
    suite_version: "2.2.0",
    protocol_family: "0.1",
    bundle_digest: bundleDigest,
    files: await Promise.all(files.map(async (file) => ({
      path: file.relativePath,
      content_base64: (await readFile(file.absolutePath)).toString("base64")
    })))
  };
}

const [protocolPackage, runtimePackage, cliPackage] = await Promise.all([
  readJson("packages/protocol/package.json"),
  readJson("packages/runtime/package.json"),
  readJson("packages/cli/package.json")
]);
const schemaNames = (await readdir(schemaDirectory))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const documentPaths = [
  "docs/01-language.md",
  "docs/protocol.md",
  "docs/operations.md",
  "docs/migrations.md"
];
const source = {
  repository: "https://github.com/SeedSpec/seedspec"
};
if (/^[a-f0-9]{40}$/u.test(process.env.SEEDSPEC_SOURCE_REVISION ?? "")) {
  source.revision = process.env.SEEDSPEC_SOURCE_REVISION;
}

const conformanceBundleDigest = await directoryDigest("conformance", {
  exclude: (relativePath) => (
    relativePath.startsWith("golden/")
    && relativePath.endsWith("/resolution-receipt.json")
  )
});
const release = {
  manifest_version: "1",
  protocol_family: "0.1",
  release_id: protocolPackage.version,
  status: "design-alpha",
  schema_package: {
    name: protocolPackage.name,
    version: protocolPackage.version
  },
  schemas: await Promise.all(schemaNames.map((name) => (
    digestedFile(`packages/protocol/schemas/v0.1/${name}`)
  ))),
  documents: await Promise.all(documentPaths.map(digestedFile)),
  operations: [
    "validate",
    "digest",
    "resolve",
    "resolve-resources",
    "capability-conformance"
  ],
  conformance: {
    suite_version: "2.2.0",
    index: "conformance/cases.yaml",
    bundle: "conformance-bundle.json",
    index_digest: await digest("conformance/cases.yaml"),
    bundle_digest: conformanceBundleDigest
  },
  implementations: {
    runtime: {
      name: runtimePackage.name,
      version: runtimePackage.version
    },
    cli: {
      name: cliPackage.name,
      version: cliPackage.version
    }
  },
  source,
  compatibility: [
    {
      from_release: "0.1.0-alpha.5",
      status: "revalidate",
      notes: "Package source remains valid; rerun validation and regenerate resolved handoffs to receive exact release binding and resolution receipts."
    }
  ]
};

await writeFile(
  path.join(protocolDirectory, "conformance-bundle.json"),
  `${JSON.stringify(await createConformanceBundle(conformanceBundleDigest), null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(protocolDirectory, "protocol-release.json"),
  `${JSON.stringify(release, null, 2)}\n`,
  "utf8"
);
