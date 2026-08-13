import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import {
  LineCounter,
  isMap,
  isSeq,
  parseDocument,
  stringify
} from "yaml";
import { SeedSpecError } from "./errors.js";
import { pathExists, resolvePackagePath } from "./files.js";

function objectValue(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function manifestPath(parts) {
  return parts.length === 0 ? "$" : `$.${parts.join(".")}`;
}

function nodeLocation(node, file, lineCounter, lineOffset, parts) {
  const position = lineCounter.linePos(node?.range?.[0] ?? 0);
  return {
    file,
    path: manifestPath(parts),
    line: position.line + lineOffset,
    column: position.col
  };
}

function collectLocations(node, file, lineCounter, lineOffset, parts = [], locations = {}) {
  if (!node) return locations;
  locations[manifestPath(parts)] = nodeLocation(node, file, lineCounter, lineOffset, parts);
  if (isMap(node)) {
    for (const pair of node.items) {
      const key = String(pair.key?.value ?? pair.key);
      collectLocations(pair.value, file, lineCounter, lineOffset, [...parts, key], locations);
    }
  } else if (isSeq(node)) {
    node.items.forEach((item, index) => {
      collectLocations(item, file, lineCounter, lineOffset, [...parts, String(index)], locations);
    });
  }
  return locations;
}

function parseYamlMapping(source, file, { lineOffset = 0, required = true } = {}) {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    prettyErrors: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    throw new SeedSpecError(`Invalid YAML mapping: ${file}`, {
      code: "INVALID_YAML",
      details: document.errors.map((error) => error.message)
    });
  }
  const value = document.toJS();
  if (value === null && !required) {
    return { value: {}, locations: {} };
  }
  if (!objectValue(value)) {
    throw new SeedSpecError(`YAML source must contain a mapping: ${file}`, {
      code: "INVALID_MANIFEST_SOURCE"
    });
  }
  return {
    value,
    locations: collectLocations(document.contents, file, lineCounter, lineOffset)
  };
}

export function parseSpecSource(source, specPath) {
  const opening = source.match(/^---[ \t]*\r?\n/u);
  if (!opening) {
    return { frontmatter: {}, body: source, locations: {} };
  }
  const remainder = source.slice(opening[0].length);
  const closing = /^(?:---|\.\.\.)[ \t]*\r?$/mu.exec(remainder);
  if (!closing) {
    throw new SeedSpecError(`SPEC.md frontmatter is not closed: ${specPath}`, {
      code: "INVALID_FRONTMATTER"
    });
  }
  const yamlSource = remainder.slice(0, closing.index);
  const closeEnd = closing.index + closing[0].length;
  const bodyStart = remainder[closeEnd] === "\r" && remainder[closeEnd + 1] === "\n"
    ? closeEnd + 2
    : remainder[closeEnd] === "\n"
      ? closeEnd + 1
      : closeEnd;
  const parsed = parseYamlMapping(yamlSource, specPath, {
    lineOffset: 1,
    required: false
  });
  return {
    frontmatter: parsed.value,
    body: remainder.slice(bodyStart),
    locations: parsed.locations
  };
}

async function readMappingFile(filePath, label) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch {
    throw new SeedSpecError(`${label} is not readable: ${filePath}`, {
      code: "FILE_NOT_READABLE"
    });
  }
  return parseYamlMapping(source, filePath);
}

async function assertNoSymlinkPath(root, filePath) {
  const relative = path.relative(root, filePath);
  const segments = relative ? relative.split(path.sep) : [];
  let current = root;
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink()) {
    throw new SeedSpecError("A SeedSpec package root must not be a symbolic link", {
      code: "UNSAFE_PACKAGE_CONTENT"
    });
  }
  for (const segment of segments) {
    current = path.join(current, segment);
    let info;
    try {
      info = await lstat(current);
    } catch {
      return null;
    }
    if (info.isSymbolicLink()) {
      throw new SeedSpecError(`SeedSpec packages must not contain symbolic links: ${relative}`, {
        code: "UNSAFE_PACKAGE_CONTENT"
      });
    }
  }
  return lstat(filePath);
}

function mergeMappings(base, override) {
  if (!objectValue(base) || !objectValue(override)) return structuredClone(override);
  const merged = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    merged[key] = objectValue(merged[key]) && objectValue(value)
      ? mergeMappings(merged[key], value)
      : structuredClone(value);
  }
  return merged;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function collectOverrides(base, override, parts = [], overrides = []) {
  if (!objectValue(override)) return overrides;
  for (const [key, value] of Object.entries(override)) {
    if (!Object.hasOwn(base, key)) continue;
    const next = [...parts, key];
    if (objectValue(base[key]) && objectValue(value)) {
      collectOverrides(base[key], value, next, overrides);
    } else if (!sameValue(base[key], value)) {
      overrides.push({ path: manifestPath(next), base: structuredClone(base[key]), override: structuredClone(value) });
    }
  }
  return overrides;
}

function nearestLocation(locations, parts, { includeRoot = true } = {}) {
  const minimum = includeRoot ? 0 : 1;
  for (let length = parts.length; length >= minimum; length -= 1) {
    const location = locations[manifestPath(parts.slice(0, length))];
    if (location) return location;
  }
  return null;
}

function collectResolvedSources(value, baseLocations, overrideLocations, parts = [], sources = {}) {
  const pointer = manifestPath(parts);
  sources[pointer] = nearestLocation(overrideLocations, parts, { includeRoot: parts.length === 0 })
    ?? nearestLocation(baseLocations, parts);
  if (objectValue(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectResolvedSources(child, baseLocations, overrideLocations, [...parts, key], sources);
    }
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => {
      collectResolvedSources(child, baseLocations, overrideLocations, [...parts, String(index)], sources);
    });
  }
  return sources;
}

export async function loadAuthoredManifest(root, specPath, manifestPath) {
  await assertNoSymlinkPath(root, specPath);
  if (manifestPath) await assertNoSymlinkPath(root, manifestPath);
  const specSource = await readFile(specPath, "utf8");
  const spec = parseSpecSource(specSource, specPath);
  const base = manifestPath
    ? await readMappingFile(manifestPath, "SeedSpec base manifest")
    : { value: {}, locations: {} };
  const manifest = mergeMappings(base.value, spec.frontmatter);
  const overrides = collectOverrides(base.value, spec.frontmatter).map((entry) => {
    const parts = entry.path === "$" ? [] : entry.path.slice(2).split(".");
    return {
      path: entry.path,
      base: {
        value: entry.base,
        source: nearestLocation(base.locations, parts)
      },
      override: {
        value: entry.override,
        source: nearestLocation(spec.locations, parts)
      },
      resolved: entry.override
    };
  });
  return {
    manifest,
    body: spec.body,
    frontmatter: spec.frontmatter,
    provenance: {
      sources: collectResolvedSources(manifest, base.locations, spec.locations),
      overrides
    }
  };
}

function assertConventionalPath(root, relativePath, directory, label) {
  const canonical = relativePath.split(path.sep).join("/");
  if (!canonical.startsWith(`${directory}/`)) {
    throw new SeedSpecError(`${label} must be under ${directory}/: ${relativePath}`, {
      code: "INVALID_CONVENTIONAL_PATH"
    });
  }
  return resolvePackagePath(root, relativePath);
}

async function expandSubject(
  root,
  subject,
  collectionKey,
  directory,
  subjectPath,
  sources,
  fallbackSource
) {
  if (!subject?.sections) return { value: subject, sections: [] };
  const items = [];
  const sections = [];
  for (const [index, section] of subject.sections.entries()) {
    if (section[collectionKey]) {
      items.push(...section[collectionKey]);
      sections.push({
        id: section.id,
        name: section.name ?? null,
        source: sources[`${subjectPath}.sections.${index}`]
          ?? sources[`${subjectPath}.sections`]
          ?? { file: fallbackSource, path: `${subjectPath}.sections.${index}` },
        items: section[collectionKey].length
      });
      continue;
    }
    const externalPath = assertConventionalPath(
      root,
      section.path,
      directory,
      `${directory} section`
    );
    if (![".yaml", ".yml"].includes(path.extname(externalPath).toLowerCase())) {
      throw new SeedSpecError(`${directory} section must reference YAML: ${section.path}`, {
        code: "INVALID_SECTION_PATH"
      });
    }
    const externalInfo = await assertNoSymlinkPath(root, externalPath);
    if (!externalInfo?.isFile()) {
      throw new SeedSpecError(`${directory} section does not reference a file: ${section.path}`, {
        code: "INVALID_SECTION_PATH"
      });
    }
    const external = await readMappingFile(externalPath, `${directory} section`);
    const keys = Object.keys(external.value);
    if (keys.length !== 1 || keys[0] !== collectionKey || !Array.isArray(external.value[collectionKey])) {
      throw new SeedSpecError(
        `${section.path} must contain only the ${collectionKey} collection`,
        { code: "INVALID_SECTION_FILE" }
      );
    }
    items.push(...external.value[collectionKey]);
    sections.push({
      id: section.id,
      name: section.name ?? null,
      source: external.locations.$ ?? { file: externalPath, path: "$" },
      items: external.value[collectionKey].length
    });
  }
  return { value: { [collectionKey]: items }, sections };
}

export async function expandManifestSections(root, authoredManifest, sources, fallbackSource) {
  const manifest = structuredClone(authoredManifest);
  const sections = [];
  const subjects = [
    ["configuration", "variables", "configuration"],
    ["success", "criteria", "success"],
    ["tasks", "items", "tasks"]
  ];
  for (const [key, collectionKey, directory] of subjects) {
    if (!manifest[key]) continue;
    const expanded = await expandSubject(
      root,
      manifest[key],
      collectionKey,
      directory,
      `$.${key}`,
      sources,
      fallbackSource
    );
    manifest[key] = expanded.value;
    sections.push(...expanded.sections.map((section) => ({ subject: key, ...section })));
  }
  if (manifest.capabilities) {
    const expanded = await expandSubject(
      root,
      manifest.capabilities,
      "items",
      "capabilities",
      "$.capabilities",
      sources,
      fallbackSource
    );
    manifest.capabilities = expanded.value;
    sections.push(...expanded.sections.map((section) => ({
      subject: "capabilities",
      ...section
    })));
  }
  return { manifest, sections };
}

function maskInlineCode(line) {
  const characters = [...line];
  let index = 0;
  while (index < characters.length) {
    if (characters[index] !== "`") {
      index += 1;
      continue;
    }
    let run = 1;
    while (characters[index + run] === "`") run += 1;
    let close = index + run;
    let found = -1;
    while (close < characters.length) {
      if (characters[close] !== "`") {
        close += 1;
        continue;
      }
      let closeRun = 1;
      while (characters[close + closeRun] === "`") closeRun += 1;
      if (closeRun === run) {
        found = close;
        break;
      }
      close += closeRun;
    }
    if (found < 0) break;
    for (let masked = index; masked < found + run; masked += 1) {
      characters[masked] = " ";
    }
    index = found + run;
  }
  return characters.join("");
}

function fencedLine(line) {
  const match = /^( {0,3})(`{3,}|~{3,})/u.exec(line);
  return match ? { character: match[2][0], length: match[2].length } : null;
}

function closesFence(line, fence) {
  const pattern = fence.character === "`" ? "`" : "~";
  return new RegExp(`^ {0,3}${pattern}{${fence.length},}[ \\t]*$`, "u").test(line);
}

function blockBounds(lines, lineIndex) {
  let start = lineIndex;
  let end = lineIndex;
  while (start > 0 && lines[start - 1].trim()) start -= 1;
  while (end + 1 < lines.length && lines[end + 1].trim()) end += 1;
  return { start, end };
}

export function collectSuccessAnchors(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const anchors = [];
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence) {
      if (closesFence(line, fence)) fence = null;
      continue;
    }
    const openingFence = fencedLine(line);
    if (openingFence) {
      fence = openingFence;
      continue;
    }
    if (/^(?: {4}|\t)/u.test(line)) continue;
    const searchable = maskInlineCode(line);
    const pattern = /(?<!\\)\[success:([a-z0-9]+(?:[.-][a-z0-9]+(?:-?[a-z0-9]+)*)*)\]/gu;
    let match;
    while ((match = pattern.exec(searchable))) {
      const heading = /^ {0,3}#{1,6}[ \t]+(.*)$/u.exec(line);
      const bounds = heading ? { start: index, end: index } : blockBounds(lines, index);
      anchors.push({
        id: match[1],
        line: index + 1,
        column: match.index + 1,
        scope: heading ? "section" : "block",
        excerpt: lines
          .slice(bounds.start, bounds.end + 1)
          .join("\n")
          .replace(
            /(?<!\\)\[success:[a-z0-9]+(?:[.-][a-z0-9]+(?:-?[a-z0-9]+)*)*\]/gu,
            ""
          )
          .trim()
      });
    }
  }
  return anchors;
}

function yamlCommentSafe(value) {
  return String(value).replace(/[\r\n]/gu, " ");
}

export function flattenManifest(record) {
  const yaml = stringify(record.manifest, { lineWidth: 0 }).trimEnd();
  return [
    "---",
    `# Generated from ${yamlCommentSafe(record.digest)}. Review before replacing authored sources.`,
    yaml,
    "---",
    record.definition
  ].join("\n");
}

export async function assertFile(root, relativePath, { directory, label }) {
  const fullPath = directory
    ? assertConventionalPath(root, relativePath, directory, label)
    : resolvePackagePath(root, relativePath);
  const info = await assertNoSymlinkPath(root, fullPath) ?? await pathExists(fullPath);
  if (!info?.isFile()) {
    throw new SeedSpecError(`${label} does not reference a file: ${relativePath}`, {
      code: "INVALID_REFERENCES"
    });
  }
  return fullPath;
}
