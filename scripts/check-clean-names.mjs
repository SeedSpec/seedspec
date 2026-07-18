import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules"]);
const disallowedTerms = [
  ["blue", "print"].join(""),
  ["apps", "for", "dad"].join("")
];
const violations = [];

async function scanDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(repositoryRoot, absolutePath);
    const normalizedPath = relativePath.toLowerCase();

    for (const term of disallowedTerms) {
      if (normalizedPath.includes(term)) {
        violations.push(`${relativePath}: disallowed term in path`);
      }
    }

    if (entry.isDirectory()) {
      await scanDirectory(absolutePath);
      continue;
    }

    if (!entry.isFile()) continue;

    const contents = (await readFile(absolutePath)).toString("utf8").toLowerCase();
    for (const term of disallowedTerms) {
      if (contents.includes(term)) {
        violations.push(`${relativePath}: disallowed term in contents`);
      }
    }
  }
}

await scanDirectory(repositoryRoot);

if (violations.length > 0) {
  process.stderr.write(`${violations.sort().join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Naming guard passed\n");
}
