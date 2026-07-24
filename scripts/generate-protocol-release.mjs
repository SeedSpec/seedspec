import { createHash } from "node:crypto";
import {
  cp,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const protocolDirectory = path.join(root, "packages/protocol");
const cliDirectory = path.join(root, "packages/cli");

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

async function createConformanceBundle(bundleDigest, release) {
  const directory = path.join(root, "conformance");
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
  "docs/operations.md",
  "docs/migrations.md"
];
const documentDirectory = path.join(protocolDirectory, "documents");
await mkdir(documentDirectory, { recursive: true });
const documentPaths = await Promise.all(sourceDocumentPaths.map(async (sourcePath) => {
  const releasePath = `documents/${path.basename(sourcePath)}`;
  await copyFile(path.join(root, sourcePath), path.join(protocolDirectory, releasePath));
  return releasePath;
}));
const cliSkillsDirectory = path.join(cliDirectory, "skills");
await rm(cliSkillsDirectory, { recursive: true, force: true });
await cp(path.join(root, "skills"), cliSkillsDirectory, { recursive: true });
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
  protocol_family: releaseContract.protocol_family,
  release_id: releaseContract.release_version,
  status: releaseContract.status,
  schema_package: {
    name: protocolPackage.name,
    version: protocolPackage.version
  },
  schemas: await Promise.all(schemaNames.map((name) => (
    digestedFile(
      `packages/protocol/schemas/v${releaseContract.protocol_family}/${name}`
    )
  ))),
  documents: await Promise.all(documentPaths.map(async (releasePath) => ({
    path: releasePath,
    digest: await digest(`packages/protocol/${releasePath}`)
  }))),
  operations: [
    "validate",
    "digest",
    "resolve",
    "resolve-resources",
    "capability-conformance"
  ],
  conformance: {
    suite_version: releaseContract.conformance_suite_version,
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
      from_release: "0.1.0-alpha.6",
      status: "migrate",
      notes: "Set protocol_version to 0.2, revalidate package source, and regenerate resolved handoffs to receive exact 0.2.0 release binding and resolution receipts.",
      migration: {
        id: "protocol-0-2",
        guide: "documents/migrations.md"
      }
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
