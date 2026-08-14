import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(skillRoot, "../../..");
const inventory = JSON.parse(
  await readFile(path.join(skillRoot, "references/inventory.json"), "utf8")
);

const ignoredDirectories = new Set([".git", "node_modules"]);
const findings = [];

function posix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function addFinding(kind, file, detail) {
  findings.push({ kind, file, detail });
}

async function exists(relativePath) {
  try {
    await lstat(path.join(repositoryRoot, relativePath));
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function collectFiles(relativeDirectory, files = []) {
  const directory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const relativePath = posix(path.join(relativeDirectory, entry.name));
    if (entry.isDirectory()) {
      await collectFiles(relativePath, files);
      continue;
    }
    if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

async function expandSurfaces(entries) {
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(repositoryRoot, entry);
    const info = await lstat(absolutePath);
    if (info.isDirectory()) {
      files.push(...await collectFiles(entry));
      continue;
    }
    files.push(posix(entry));
  }
  return files;
}

function isAllowlisted(relativePath) {
  return inventory.allowTermFiles.includes(relativePath)
    || relativePath.startsWith(".agents/skills/audit-seedspec-surface/");
}

function lineNumber(contents, index) {
  return contents.slice(0, index).split("\n").length;
}

const [surfaceFiles, packageJson, cliSource] = await Promise.all([
  expandSurfaces(inventory.currentSurfaces),
  readJson("package.json"),
  readFile(path.join(repositoryRoot, "packages/cli/bin/seedspec.js"), "utf8")
]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8"));
}

const liveCommands = new Set(
  [...cliSource.matchAll(/^\s+case "([a-z0-9-]+)": \{/gm)].map((match) => match[1])
);
const liveScripts = new Set(Object.keys(packageJson.scripts ?? {}));

for (const retiredPath of inventory.retiredPaths) {
  if (await exists(retiredPath)) {
    addFinding("retired-path", retiredPath, "retired tree or file is still present");
  }
}

const markdownLink = /\[(?:[^\]]+)\]\(([^)]+)\)/g;
const seedspecCommand = /(?:npx (?:@seedspec\/cli|seedspec)|seedspec) ([a-z][a-z0-9-]*)/g;
const npmScript = /npm run ([a-z0-9:-]+)/g;

for (const relativePath of surfaceFiles) {
  if (!/\.(md|json|ya?ml|mjs|js)$/u.test(relativePath)) continue;
  const contents = await readFile(path.join(repositoryRoot, relativePath), "utf8");
  const lower = contents.toLowerCase();

  if (!isAllowlisted(relativePath)) {
    for (const term of inventory.retiredTerms) {
      let from = 0;
      while (from < lower.length) {
        const index = lower.indexOf(term, from);
        if (index === -1) break;
        addFinding(
          "retired-term",
          `${relativePath}:${lineNumber(contents, index)}`,
          `retired term "${term}"`
        );
        from = index + term.length;
      }
    }

    for (const match of contents.matchAll(seedspecCommand)) {
      const command = match[1];
      if (inventory.retiredCommands.includes(command)) {
        addFinding(
          "retired-command",
          `${relativePath}:${lineNumber(contents, match.index)}`,
          `retired command "seedspec ${command}"`
        );
      } else if (!liveCommands.has(command)) {
        addFinding(
          "unknown-command",
          `${relativePath}:${lineNumber(contents, match.index)}`,
          `documented command "seedspec ${command}" is not in the CLI`
        );
      }
    }

    for (const match of contents.matchAll(npmScript)) {
      const script = match[1];
      if (inventory.retiredNpmScripts.includes(script)) {
        addFinding(
          "retired-script",
          `${relativePath}:${lineNumber(contents, match.index)}`,
          `retired npm script "${script}"`
        );
      } else if (!liveScripts.has(script)) {
        addFinding(
          "unknown-script",
          `${relativePath}:${lineNumber(contents, match.index)}`,
          `documented npm script "${script}" is not in package.json`
        );
      }
    }
  }

  if (relativePath.endsWith(".md")) {
    for (const match of contents.matchAll(markdownLink)) {
      const target = match[1].split("#")[0].split("?")[0];
      if (!target || /^[a-z]+:/u.test(target) || target.startsWith("/")) continue;
      const resolved = posix(path.normalize(path.join(path.dirname(relativePath), target)));
      if (!(await exists(resolved))) {
        addFinding(
          "broken-link",
          `${relativePath}:${lineNumber(contents, match.index)}`,
          `broken relative link ${target}`
        );
      }
    }
  }
}

if (await exists("docs/README.md")) {
  addFinding("duplicate-index", "docs/README.md", "README.md is the only documentation index");
}

findings.sort((left, right) => {
  const fileOrder = left.file.localeCompare(right.file);
  return fileOrder === 0 ? left.kind.localeCompare(right.kind) : fileOrder;
});

if (findings.length > 0) {
  process.stderr.write(
    findings.map((finding) => `${finding.file}: ${finding.kind}: ${finding.detail}`).join("\n") + "\n"
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Surface audit passed\n");
}
