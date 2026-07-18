import { readFile, readdir, stat } from "node:fs/promises";
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

  const manifestPath = info.isDirectory() ? path.join(absolute, "seedspec.yaml") : absolute;
  const root = info.isDirectory() ? absolute : path.dirname(absolute);

  if (path.basename(manifestPath) !== "seedspec.yaml") {
    throw new SeedSpecError(`Expected a package directory or seedspec.yaml: ${inputPath}`, {
      code: "INVALID_PACKAGE_PATH"
    });
  }

  return { root, manifestPath };
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

export async function readJsonFile(filePath, label = "JSON file") {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch {
    throw new SeedSpecError(`${label} is not readable: ${filePath}`, {
      code: "FILE_NOT_READABLE"
    });
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new SeedSpecError(`${label} is invalid JSON: ${filePath}`, {
      code: "INVALID_JSON",
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

export async function readMarkdownComponent(packageRecord, componentName) {
  const relativePath = packageRecord.manifest.components?.[componentName];
  if (!relativePath) return "";

  const componentPath = resolvePackagePath(packageRecord.root, relativePath);
  const info = await pathExists(componentPath);
  if (!info) return "";

  if (info.isFile()) {
    return componentPath.endsWith(".md") ? readFile(componentPath, "utf8") : "";
  }

  return readMarkdownDirectory(componentPath);
}

async function readMarkdownDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await readMarkdownDirectory(entryPath);
      if (nested) chunks.push(nested);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      chunks.push(await readFile(entryPath, "utf8"));
    }
  }

  return chunks.join("\n\n").trim();
}
