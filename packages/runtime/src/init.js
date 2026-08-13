import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { pathExists } from "./files.js";

export function slugIdentifier(value) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return slug || "package";
}

export function renderInitSpec({ id, name }) {
  return `---
id: ${id}
name: ${name}
version: "0.1.0"
---
# ${name}

Describe what should exist or change, and what someone could observe if it
worked.
`;
}

export async function initPackage(directory, {
  id,
  name,
  force = false
} = {}) {
  const root = path.resolve(directory);
  const specPath = path.join(root, "SPEC.md");
  if (!force && await pathExists(specPath)) {
    throw new SeedSpecError(`SPEC.md already exists: ${specPath}`, {
      code: "INIT_EXISTS"
    });
  }
  const packageName = name?.trim() || path.basename(root) || "Package";
  const packageId = id?.trim() || slugIdentifier(packageName);
  await mkdir(root, { recursive: true });
  const spec = renderInitSpec({ id: packageId, name: packageName });
  await writeFile(specPath, spec, "utf8");
  return { root, specPath, id: packageId, name: packageName };
}
