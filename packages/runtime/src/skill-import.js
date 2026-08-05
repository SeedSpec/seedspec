import { randomUUID } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse as parseYaml, parseDocument } from "yaml";
import { SeedSpecError } from "./errors.js";
import { pathExists, readYamlFile, resolvePackagePath } from "./files.js";
import { computeDirectoryDigest, computeFileDigest } from "./integrity.js";
import { validatePackage } from "./validate.js";

const localIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const namespacedIdPattern = /^[a-z0-9]+(?:\.[a-z0-9][a-z0-9-]*){2,}$/u;
const includePathPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*\/?$/u;
const corePurposes = new Set(["author", "implement", "review", "evaluate", "verify", "operate"]);
const coreAudiences = new Set([
  "authoring-agent",
  "implementing-agent",
  "target-agent",
  "reviewer",
  "evaluator",
  "operator",
  "end-user"
]);
const inferredPaths = ["LICENSE", "SKILL.md", "agents", "assets", "references", "scripts"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rejectUnknownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new SeedSpecError(`${label} contains an unknown field: ${unknown[0]}`, {
      code: "INVALID_SKILL_SOURCE_CONFIG"
    });
  }
}

function normalizeIncludePath(value) {
  if (typeof value !== "string" || !includePathPattern.test(value)) {
    throw new SeedSpecError(`Skill include path is not portable: ${String(value)}`, {
      code: "INVALID_SKILL_SOURCE_CONFIG"
    });
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function validateApplicabilityValues(values, label, valid) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new SeedSpecError(`${label} must be a non-empty array`, {
      code: "INVALID_SKILL_SOURCE_CONFIG"
    });
  }
  const unique = new Set(values);
  if (unique.size !== values.length || values.some((value) => typeof value !== "string" || !valid(value))) {
    throw new SeedSpecError(`${label} contains an invalid or repeated value`, {
      code: "INVALID_SKILL_SOURCE_CONFIG"
    });
  }
  return [...values];
}

function validateApplicability(value, label = "skill.defaults.applies_to") {
  if (!isObject(value)) {
    throw new SeedSpecError(`${label} must be a mapping`, {
      code: "INVALID_SKILL_SOURCE_CONFIG"
    });
  }
  rejectUnknownKeys(value, ["purposes", "audiences", "capabilities", "targets"], label);
  if (Object.keys(value).length === 0) {
    throw new SeedSpecError(`${label} must constrain at least one dimension`, {
      code: "INVALID_SKILL_SOURCE_CONFIG"
    });
  }
  return {
    ...(value.purposes ? {
      purposes: validateApplicabilityValues(
        value.purposes,
        `${label}.purposes`,
        (item) => corePurposes.has(item) || namespacedIdPattern.test(item)
      )
    } : {}),
    ...(value.audiences ? {
      audiences: validateApplicabilityValues(
        value.audiences,
        `${label}.audiences`,
        (item) => coreAudiences.has(item) || namespacedIdPattern.test(item)
      )
    } : {}),
    ...(value.capabilities ? {
      capabilities: validateApplicabilityValues(
        value.capabilities,
        `${label}.capabilities`,
        (item) => namespacedIdPattern.test(item)
      )
    } : {}),
    ...(value.targets ? {
      targets: validateApplicabilityValues(
        value.targets,
        `${label}.targets`,
        (item) => namespacedIdPattern.test(item)
      )
    } : {})
  };
}

function parseSkillFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(source);
  if (!match) {
    throw new SeedSpecError("Imported SKILL.md must begin with YAML frontmatter", {
      code: "INVALID_SKILL_SOURCE"
    });
  }
  let frontmatter;
  try {
    frontmatter = parseYaml(match[1]);
  } catch (error) {
    throw new SeedSpecError("Imported SKILL.md has invalid YAML frontmatter", {
      code: "INVALID_SKILL_SOURCE",
      details: [error.message]
    });
  }
  if (
    !isObject(frontmatter)
    || typeof frontmatter.name !== "string"
    || !localIdPattern.test(frontmatter.name)
    || typeof frontmatter.description !== "string"
    || !frontmatter.description.trim()
  ) {
    throw new SeedSpecError(
      "Imported SKILL.md frontmatter requires a local-id name and non-empty description",
      { code: "INVALID_SKILL_SOURCE" }
    );
  }
  return {
    name: frontmatter.name,
    description: frontmatter.description.trim()
  };
}

async function sourceInfo(sourcePath) {
  const root = path.resolve(sourcePath);
  let rootInfo;
  try {
    rootInfo = await lstat(root);
  } catch {
    throw new SeedSpecError(`Skill source does not exist: ${sourcePath}`, {
      code: "SKILL_SOURCE_NOT_FOUND"
    });
  }
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new SeedSpecError("Skill source must be a regular directory", {
      code: "INVALID_SKILL_SOURCE"
    });
  }

  const configurationPath = path.join(root, "seedspec.yaml");
  let configurationInfo = null;
  try {
    configurationInfo = await lstat(configurationPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  let entrypoint = "SKILL.md";
  let includes = null;
  let defaults = null;
  let configurationDigest = null;

  if (configurationInfo) {
    if (configurationInfo.isSymbolicLink() || !configurationInfo.isFile()) {
      throw new SeedSpecError("Skill source seedspec.yaml must be a regular file", {
        code: "INVALID_SKILL_SOURCE_CONFIG"
      });
    }
    const configuration = await readYamlFile(configurationPath, "Skill source configuration");
    if (!isObject(configuration)) {
      throw new SeedSpecError("Skill source configuration must be a mapping", {
        code: "INVALID_SKILL_SOURCE_CONFIG"
      });
    }
    rejectUnknownKeys(configuration, ["skill"], "Skill source configuration");
    if (!isObject(configuration.skill)) {
      throw new SeedSpecError("Skill source configuration requires a skill mapping", {
        code: "INVALID_SKILL_SOURCE_CONFIG"
      });
    }
    rejectUnknownKeys(configuration.skill, ["entrypoint", "include", "defaults"], "skill");
    entrypoint = configuration.skill.entrypoint ?? entrypoint;
    if (entrypoint !== "SKILL.md") {
      throw new SeedSpecError("Skill source entrypoint must be SKILL.md", {
        code: "INVALID_SKILL_SOURCE_CONFIG"
      });
    }
    if (configuration.skill.include !== undefined) {
      if (!Array.isArray(configuration.skill.include) || configuration.skill.include.length === 0) {
        throw new SeedSpecError("skill.include must be a non-empty array", {
          code: "INVALID_SKILL_SOURCE_CONFIG"
        });
      }
      includes = configuration.skill.include.map(normalizeIncludePath);
    }
    if (configuration.skill.defaults !== undefined) {
      if (!isObject(configuration.skill.defaults)) {
        throw new SeedSpecError("skill.defaults must be a mapping", {
          code: "INVALID_SKILL_SOURCE_CONFIG"
        });
      }
      rejectUnknownKeys(configuration.skill.defaults, ["applies_to"], "skill.defaults");
      if (configuration.skill.defaults.applies_to !== undefined) {
        defaults = validateApplicability(configuration.skill.defaults.applies_to);
      }
    }
    configurationDigest = await computeFileDigest(configurationPath);
  }

  if (!includes) {
    includes = [];
    for (const candidate of inferredPaths) {
      if (await pathExists(path.join(root, candidate))) includes.push(candidate);
    }
  }
  if (!includes.includes(entrypoint)) {
    throw new SeedSpecError("skill.include must contain SKILL.md", {
      code: "INVALID_SKILL_SOURCE_CONFIG"
    });
  }
  if (new Set(includes).size !== includes.length) {
    throw new SeedSpecError("skill.include contains a repeated path", {
      code: "INVALID_SKILL_SOURCE_CONFIG"
    });
  }
  const orderedIncludes = [...includes].sort();
  for (let index = 0; index < orderedIncludes.length; index += 1) {
    for (let later = index + 1; later < orderedIncludes.length; later += 1) {
      if (orderedIncludes[later].startsWith(`${orderedIncludes[index]}/`)) {
        throw new SeedSpecError("skill.include paths must not overlap", {
          code: "INVALID_SKILL_SOURCE_CONFIG",
          details: [orderedIncludes[index], orderedIncludes[later]]
        });
      }
    }
  }
  for (const relativePath of orderedIncludes) {
    const absolutePath = resolvePackagePath(root, relativePath);
    let info;
    try {
      info = await lstat(absolutePath);
    } catch {
      throw new SeedSpecError(`Skill include path does not exist: ${relativePath}`, {
        code: "INVALID_SKILL_SOURCE_CONFIG"
      });
    }
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) {
      throw new SeedSpecError(`Skill include path must be a regular file or directory: ${relativePath}`, {
        code: "INVALID_SKILL_SOURCE"
      });
    }
  }

  const entrypointPath = resolvePackagePath(root, entrypoint);
  const frontmatter = parseSkillFrontmatter(await readFile(entrypointPath, "utf8"));
  return {
    root,
    entrypoint,
    includes: orderedIncludes,
    defaults,
    configuration: configurationDigest ? {
      path: "seedspec.yaml",
      digest: configurationDigest
    } : null,
    frontmatter
  };
}

function resolvedApplicability(defaults, { purposes, audiences } = {}) {
  const value = {
    ...(defaults ?? {}),
    ...(purposes !== undefined ? {
      purposes: validateApplicabilityValues(
        purposes,
        "--purpose",
        (item) => corePurposes.has(item) || namespacedIdPattern.test(item)
      )
    } : {}),
    ...(audiences !== undefined ? {
      audiences: validateApplicabilityValues(
        audiences,
        "--audience",
        (item) => coreAudiences.has(item) || namespacedIdPattern.test(item)
      )
    } : {})
  };
  return Object.keys(value).length > 0 ? value : null;
}

async function materializeSkill(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const relativePath of source.includes) {
    const from = resolvePackagePath(source.root, relativePath);
    const to = resolvePackagePath(destination, relativePath);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to, { recursive: true, dereference: false });
  }
  return computeDirectoryDigest(destination);
}

async function skillSnapshot(sourcePath, overrides) {
  const source = await sourceInfo(sourcePath);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "seedspec-skill-import-"));
  const staged = path.join(temporaryRoot, "skill");
  try {
    const digest = await materializeSkill(source, staged);
    return {
      source,
      digest,
      applicability: resolvedApplicability(source.defaults, overrides),
      temporaryRoot,
      staged
    };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

function sameDeclaration(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function declarationFor(snapshot) {
  const id = snapshot.source.frontmatter.name;
  const destination = `context/skills/${id}/`;
  return {
    id,
    destination,
    declaration: {
      id,
      format: "io.agentskills.skill",
      description: snapshot.source.frontmatter.description,
      entrypoint: snapshot.source.entrypoint,
      source: { kind: "package", path: destination },
      ...(snapshot.applicability ? { applies_to: snapshot.applicability } : {})
    }
  };
}

async function destinationStatus(root, destination, digest) {
  const absolute = resolvePackagePath(root, destination);
  const info = await pathExists(absolute);
  if (!info) return { install: true, absolute };
  if (!info.isDirectory()) {
    throw new SeedSpecError(`Skill destination is not a directory: ${destination}`, {
      code: "SKILL_IMPORT_COLLISION"
    });
  }
  const existingDigest = await computeDirectoryDigest(absolute);
  if (existingDigest !== digest) {
    throw new SeedSpecError(`Skill destination already contains different bytes: ${destination}`, {
      code: "SKILL_IMPORT_COLLISION",
      details: [`source ${digest}`, `destination ${existingDigest}`]
    });
  }
  return { install: false, absolute };
}

export async function planSkillImport(packagePath, sourcePath, overrides = {}) {
  const record = await validatePackage(packagePath);
  const snapshot = await skillSnapshot(sourcePath, overrides);
  try {
    const { id, destination, declaration } = declarationFor(snapshot);
    const existing = record.manifest.context.modules.find((module) => module.id === id) ?? null;
    if (existing && !sameDeclaration(existing, declaration)) {
      throw new SeedSpecError(`Context module ID already has a different declaration: ${id}`, {
        code: "SKILL_IMPORT_COLLISION"
      });
    }
    const destinationResult = await destinationStatus(record.root, destination, snapshot.digest);
    return {
      skill_import_plan_version: "1",
      package: {
        path: record.root,
        id: record.manifest.id,
        version: record.manifest.version,
        digest: record.digest
      },
      source: {
        path: snapshot.source.root,
        entrypoint: snapshot.source.entrypoint,
        include: snapshot.source.includes,
        content_digest: snapshot.digest,
        configuration: snapshot.source.configuration,
        defaults: snapshot.source.defaults
      },
      overrides: {
        ...(overrides.purposes !== undefined ? { purposes: [...overrides.purposes] } : {}),
        ...(overrides.audiences !== undefined ? { audiences: [...overrides.audiences] } : {})
      },
      module: {
        id,
        destination,
        declaration,
        install: destinationResult.install,
        declare: existing === null
      }
    };
  } finally {
    await rm(snapshot.temporaryRoot, { recursive: true, force: true });
  }
}

export async function applySkillImportPlan(plan) {
  if (plan?.skill_import_plan_version !== "1") {
    throw new SeedSpecError("Unsupported Skill import plan", {
      code: "INVALID_SKILL_IMPORT_PLAN"
    });
  }
  const record = await validatePackage(plan.package.path);
  if (
    record.manifest.id !== plan.package.id
    || record.manifest.version !== plan.package.version
    || record.digest !== plan.package.digest
  ) {
    throw new SeedSpecError("The package changed after Skill import planning", {
      code: "STALE_SKILL_IMPORT_PLAN",
      details: [`planned ${plan.package.digest}`, `current ${record.digest}`]
    });
  }

  const snapshot = await skillSnapshot(plan.source.path, plan.overrides);
  try {
    const current = declarationFor(snapshot);
    const sourceChanged = snapshot.digest !== plan.source.content_digest
      || snapshot.source.configuration?.digest !== plan.source.configuration?.digest
      || JSON.stringify(snapshot.source.includes) !== JSON.stringify(plan.source.include)
      || current.id !== plan.module.id
      || !sameDeclaration(current.declaration, plan.module.declaration);
    if (sourceChanged) {
      throw new SeedSpecError("The Skill source changed after import planning", {
        code: "STALE_SKILL_IMPORT_PLAN"
      });
    }

    const destinationResult = await destinationStatus(
      record.root,
      plan.module.destination,
      snapshot.digest
    );
    const existing = record.manifest.context.modules.find(
      (module) => module.id === plan.module.id
    ) ?? null;
    if (existing && !sameDeclaration(existing, plan.module.declaration)) {
      throw new SeedSpecError(`Context module ID changed after planning: ${plan.module.id}`, {
        code: "STALE_SKILL_IMPORT_PLAN"
      });
    }

    const manifestPath = path.join(record.root, "seedspec.yaml");
    const original = await readFile(manifestPath, "utf8");
    const document = parseDocument(original);
    if (!existing) document.addIn(["context", "modules"], plan.module.declaration);

    const temporaryManifest = `${manifestPath}.skill-import-${randomUUID()}`;
    let installed = false;
    let manifestReplaced = false;
    try {
      if (destinationResult.install) {
        await mkdir(path.dirname(destinationResult.absolute), { recursive: true });
        await rename(snapshot.staged, destinationResult.absolute);
        installed = true;
      }
      await writeFile(temporaryManifest, String(document), "utf8");
      await rename(temporaryManifest, manifestPath);
      manifestReplaced = true;
      let updated;
      try {
        updated = await validatePackage(record.root);
      } catch (error) {
        await writeFile(manifestPath, original, "utf8");
        throw error;
      }
      return {
        package: updated.manifest.id,
        digest: updated.digest,
        module: plan.module.declaration,
        content_digest: snapshot.digest,
        installed,
        declared: existing === null
      };
    } catch (error) {
      await rm(temporaryManifest, { force: true });
      if (manifestReplaced) await writeFile(manifestPath, original, "utf8");
      if (installed) await rm(destinationResult.absolute, { recursive: true, force: true });
      throw error;
    }
  } finally {
    await rm(snapshot.temporaryRoot, { recursive: true, force: true });
  }
}

export function formatSkillImportPlan(plan) {
  const applicability = plan.module.declaration.applies_to;
  const lines = [
    `Task Skill import plan for ${plan.package.id}@${plan.package.version}`,
    `Skill: ${plan.module.id}`,
    `Source configuration: ${plan.source.configuration ? "seedspec.yaml" : "none"}`,
    `Destination: ${plan.module.destination}`,
    `Content digest: ${plan.source.content_digest}`,
    `Files: ${plan.source.include.join(", ")}`,
    `Purposes: ${applicability?.purposes?.join(", ") ?? "unrestricted"}`,
    `Audiences: ${applicability?.audiences?.join(", ") ?? "unrestricted"}`,
    `Action: ${plan.module.install ? "copy Skill bytes" : "reuse matching Skill bytes"}; ${plan.module.declare ? "declare module" : "module already declared"}`
  ];
  return lines.join("\n");
}
