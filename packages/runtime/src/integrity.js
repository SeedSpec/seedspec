import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { SeedSpecError } from "./errors.js";

function lexicalCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function assertPortablePath(relativePath, seenFoldedPaths) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u.test(relativePath)) {
    throw new SeedSpecError(`Package path is not portable ASCII: ${relativePath}`, {
      code: "UNSAFE_PACKAGE_CONTENT"
    });
  }

  const folded = relativePath.toLowerCase();
  const existing = seenFoldedPaths.get(folded);
  if (existing && existing !== relativePath) {
    throw new SeedSpecError(`Package contains case-colliding paths: ${existing}, ${relativePath}`, {
      code: "UNSAFE_PACKAGE_CONTENT"
    });
  }
  seenFoldedPaths.set(folded, relativePath);
}

async function collectFiles(root, current, files, seenFoldedPaths) {
  const entries = (await readdir(current, { withFileTypes: true }))
    .sort((left, right) => lexicalCompare(left.name, right.name));

  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    assertPortablePath(relativePath, seenFoldedPaths);
    const info = await lstat(absolutePath);

    if (info.isSymbolicLink()) {
      throw new SeedSpecError(`SeedSpec packages must not contain symbolic links: ${relativePath}`, {
        code: "UNSAFE_PACKAGE_CONTENT"
      });
    }
    if (info.isDirectory()) {
      await collectFiles(root, absolutePath, files, seenFoldedPaths);
    } else if (info.isFile()) {
      files.push({ absolutePath, relativePath });
    } else {
      throw new SeedSpecError(`SeedSpec packages may contain only regular files and directories: ${relativePath}`, {
        code: "UNSAFE_PACKAGE_CONTENT"
      });
    }
  }
}

function digestCollectedFiles(files) {
  files.sort((left, right) => lexicalCompare(left.relativePath, right.relativePath));

  const packageHash = createHash("sha256");
  for (const file of files) {
    const fileDigest = createHash("sha256").update(file.content).digest("hex");
    packageHash.update(file.relativePath, "utf8");
    packageHash.update("\0", "utf8");
    packageHash.update(fileDigest, "ascii");
    packageHash.update("\n", "utf8");
  }

  return `sha256:${packageHash.digest("hex")}`;
}

async function collectedDirectoryFiles(root) {
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink()) {
    throw new SeedSpecError("A SeedSpec package root must not be a symbolic link", {
      code: "UNSAFE_PACKAGE_CONTENT"
    });
  }

  const files = [];
  await collectFiles(root, root, files, new Map());
  return Promise.all(files.map(async (file) => ({
    relativePath: file.relativePath,
    content: await readFile(file.absolutePath)
  })));
}

export async function computeFileDigest(filePath) {
  const content = await readFile(filePath);
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export async function computeDirectoryDigest(root, { excludePaths = [] } = {}) {
  const excluded = new Set(excludePaths);
  const files = (await collectedDirectoryFiles(root)).filter((file) => (
    ![...excluded].some((excludedPath) => (
      file.relativePath === excludedPath
      || file.relativePath.startsWith(`${excludedPath}/`)
    ))
  ));
  return digestCollectedFiles(files);
}

export async function computeSelectedDirectoryDigest(root, selectedPaths) {
  const selected = new Set(selectedPaths);
  const files = (await collectedDirectoryFiles(root)).filter((file) => (
    [...selected].some((selectedPath) => (
      file.relativePath === selectedPath
      || file.relativePath.startsWith(`${selectedPath}/`)
    ))
  ));
  return digestCollectedFiles(files);
}

export async function computePackageDigest(root) {
  return computeDirectoryDigest(root);
}
