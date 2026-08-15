import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const protocolDirectory = path.join(root, "packages/protocol");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function digest(relativePath) {
  const bytes = await readFile(path.join(root, relativePath));
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function digestedFile(sourcePath, releasePath = sourcePath) {
  return {
    path: releasePath,
    digest: await digest(sourcePath)
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

async function directoryDigest(relativePath) {
  const directory = path.join(root, relativePath);
  const files = await collectDirectoryFiles(directory);
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

async function createConformanceBundle(bundleDigest, release) {
  const directory = path.join(root, "packages/protocol/conformance");
  const files = await collectDirectoryFiles(directory);
  files.sort((left, right) => lexicalCompare(left.relativePath, right.relativePath));
  return {
    bundle_version: "1",
    suite_version: release.conformance_suite_version,
    protocol_family: release.protocol_family,
    bundle_digest: bundleDigest,
    files: await Promise.all(files.map(async (file) => ({
      path: file.relativePath,
      content_base64: (await readFile(file.absolutePath)).toString("base64")
    })))
  };
}

const [releaseContract, protocolPackage, runtimePackage, cliPackage] = await Promise.all([
  readJson("release.json"),
  readJson("packages/protocol/package.json"),
  readJson("packages/runtime/package.json"),
  readJson("packages/cli/package.json")
]);
let existingProtocolRelease = null;
try {
  existingProtocolRelease = await readJson("packages/protocol/protocol-release.json");
} catch {
  // A first release has no prior generated manifest.
}
const packageSchemaPrefix = `schemas/v${releaseContract.protocol_family}/`;
const repositorySchemaPrefix = `packages/protocol/${packageSchemaPrefix}`;
const preserveLegacySchemaPaths = (
  existingProtocolRelease?.release_id === releaseContract.release_version
  && existingProtocolRelease.schemas?.every(({ path: filePath }) => (
    filePath.startsWith(repositorySchemaPrefix)
  ))
);
const schemaDirectory = path.join(
  protocolDirectory,
  `schemas/v${releaseContract.protocol_family}`
);
const schemaNames = (await readdir(schemaDirectory))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const sourceDocumentPaths = [
  "docs/01-language.md",
  "docs/protocol.md",
  "docs/operations.md"
];
const documentDirectory = path.join(protocolDirectory, "documents");
await mkdir(documentDirectory, { recursive: true });
const documentPaths = await Promise.all(sourceDocumentPaths.map(async (sourcePath) => {
  const releasePath = `documents/${path.basename(sourcePath)}`;
  await copyFile(path.join(root, sourcePath), path.join(protocolDirectory, releasePath));
  return releasePath;
}));
const source = {
  repository: "https://github.com/SeedSpec/seedspec"
};
if (/^[a-f0-9]{40}$/u.test(process.env.SEEDSPEC_SOURCE_REVISION ?? "")) {
  source.revision = process.env.SEEDSPEC_SOURCE_REVISION;
}

const conformanceBundleDigest = await directoryDigest("packages/protocol/conformance");
const release = {
  manifest_version: "1",
  protocol_family: releaseContract.protocol_family,
  release_id: releaseContract.release_version,
  status: releaseContract.status,
  schema_package: {
    name: protocolPackage.name,
    version: protocolPackage.version
  },
  schemas: await Promise.all(schemaNames.map((name) => (
    digestedFile(
      `${repositorySchemaPrefix}${name}`,
      preserveLegacySchemaPaths
        ? `${repositorySchemaPrefix}${name}`
        : `${packageSchemaPrefix}${name}`
    )
  ))),
  documents: await Promise.all(documentPaths.map(async (releasePath) => ({
    path: releasePath,
    digest: await digest(`packages/protocol/${releasePath}`)
  }))),
  operations: [
    "validate",
    "digest",
    "inspect",
    "flatten"
  ],
  conformance: {
    suite_version: releaseContract.conformance_suite_version,
    index: "conformance/cases.yaml",
    bundle: "conformance-bundle.json",
    index_digest: await digest("packages/protocol/conformance/cases.yaml"),
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
      from_release: "0.3.1",
      status: "unsupported",
      notes: "Protocol families are independent contracts. This family does not parse previous families."
    }
  ]
};

await writeFile(
  path.join(protocolDirectory, "conformance-bundle.json"),
  `${JSON.stringify(
    await createConformanceBundle(conformanceBundleDigest, releaseContract),
    null,
    2
  )}\n`,
  "utf8"
);
await writeFile(
  path.join(protocolDirectory, "protocol-release.json"),
  `${JSON.stringify(release, null, 2)}\n`,
  "utf8"
);
