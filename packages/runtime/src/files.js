import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { SeedSpecError } from "./errors.js";

export async function resolvePackageLocation(inputPath) {
  const absolute = path.resolve(inputPath);
  let info;

  try {
    info = await stat(absolute);
  } catch {
    throw new SeedSpecError(`Package path does not exist: ${inputPath}`, {
      code: "PACKAGE_NOT_FOUND"
    });
  }

  const root = info.isDirectory() ? absolute : path.dirname(absolute);
  if (
    !info.isDirectory()
    && !["SPEC.md", "seedspec.yaml"].includes(path.basename(absolute))
  ) {
    throw new SeedSpecError(`Expected a package directory, SPEC.md, or seedspec.yaml: ${inputPath}`, {
      code: "INVALID_PACKAGE_PATH"
    });
  }
  const specPath = path.join(root, "SPEC.md");
  const specInfo = await pathExists(specPath);
  if (!specInfo?.isFile()) {
    throw new SeedSpecError(`SeedSpec package requires SPEC.md: ${root}`, {
      code: "MISSING_SPEC"
    });
  }
  const candidateManifestPath = path.join(root, "seedspec.yaml");
  const manifestInfo = await pathExists(candidateManifestPath);
  if (manifestInfo && !manifestInfo.isFile()) {
    throw new SeedSpecError(`Root seedspec.yaml must be a file: ${candidateManifestPath}`, {
      code: "INVALID_MANIFEST_SOURCE"
    });
  }

  return {
    root,
    specPath,
    manifestPath: manifestInfo ? candidateManifestPath : null
  };
}

export async function readYamlFile(filePath, label = "YAML file") {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch {
    throw new SeedSpecError(`${label} is not readable: ${filePath}`, {
      code: "FILE_NOT_READABLE"
    });
  }

  try {
    return parseYaml(source);
  } catch (error) {
    throw new SeedSpecError(`${label} is invalid YAML: ${filePath}`, {
      code: "INVALID_YAML",
      details: [error.message]
    });
  }
}

export function resolvePackagePath(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  const relation = path.relative(root, resolved);

  if (relation.startsWith("..") || path.isAbsolute(relation)) {
    throw new SeedSpecError(`Package reference escapes its root: ${relativePath}`, {
      code: "UNSAFE_PACKAGE_PATH"
    });
  }

  return resolved;
}

export async function pathExists(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}
