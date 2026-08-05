import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { protocolVersion } from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { pathExists, portablePath, resolvePackagePath } from "./files.js";
import { computeDirectoryDigest, computeFileDigest } from "./integrity.js";

function directoryName(id) {
  return id.replace(/[^a-zA-Z0-9.-]/gu, "-");
}

function duplicateIds(items) {
  const seen = new Set();
  return items
    .map((item) => item.id)
    .filter((id) => seen.has(id) || !seen.add(id));
}

function parseBridgeFrontmatter(source, label) {
  if (!source.startsWith("---\n")) {
    throw new SeedSpecError(`${label} must begin with YAML frontmatter`, {
      code: "INVALID_CONTEXT_BRIDGE"
    });
  }
  const end = source.indexOf("\n---", 4);
  if (end === -1) {
    throw new SeedSpecError(`${label} has unterminated YAML frontmatter`, {
      code: "INVALID_CONTEXT_BRIDGE"
    });
  }
  let frontmatter;
  try {
    frontmatter = parseYaml(source.slice(4, end));
  } catch (error) {
    throw new SeedSpecError(`${label} has invalid YAML frontmatter`, {
      code: "INVALID_CONTEXT_BRIDGE",
      details: [error.message]
    });
  }
  if (
    !frontmatter
    || typeof frontmatter !== "object"
    || Array.isArray(frontmatter)
    || typeof frontmatter.name !== "string"
    || !frontmatter.name.trim()
    || typeof frontmatter.description !== "string"
    || !frontmatter.description.trim()
  ) {
    throw new SeedSpecError(`${label} frontmatter requires non-empty name and description`, {
      code: "INVALID_CONTEXT_BRIDGE"
    });
  }
}

export function contextModules(manifest) {
  return manifest.context?.modules ?? [];
}

export function primaryContextModule(manifest) {
  return contextModules(manifest).find((module) => module.id === manifest.definition.module) ?? null;
}

async function packageModuleEntrypoint(root, module) {
  const sourcePath = resolvePackagePath(root, module.source.path);
  const info = await pathExists(sourcePath);
  if (!info) {
    throw new SeedSpecError(
      `Context module ${module.id} package source does not exist: ${module.source.path}`,
      { code: "INVALID_CONTEXT_MODULE" }
    );
  }
  if (info.isDirectory()) {
    return {
      root: sourcePath,
      entrypoint: resolvePackagePath(sourcePath, module.entrypoint)
    };
  }
  if (info.isFile()) {
    if (path.basename(sourcePath) !== module.entrypoint) {
      throw new SeedSpecError(
        `Context module ${module.id} entrypoint must match package file ${path.basename(sourcePath)}`,
        { code: "INVALID_CONTEXT_MODULE" }
      );
    }
    return { root: path.dirname(sourcePath), entrypoint: sourcePath, file: sourcePath };
  }
  throw new SeedSpecError(
    `Context module ${module.id} package source must reference a file or directory: ${module.source.path}`,
    { code: "INVALID_CONTEXT_MODULE" }
  );
}

export async function localContextModule(root, manifest, module) {
  if (module.source.kind === "package") {
    return packageModuleEntrypoint(root, module);
  }

  if (module.source.kind === "artifact") {
    const artifact = (manifest.artifacts ?? []).find(
      (candidate) => candidate.id === module.source.id
    );
    if (!artifact) {
      throw new SeedSpecError(
        `Context module ${module.id} references unknown artifact ${module.source.id}`,
        { code: "INVALID_CONTEXT_MODULE" }
      );
    }
    if (!artifact.path) return null;
    const artifactPath = resolvePackagePath(root, artifact.path);
    const info = await pathExists(artifactPath);
    if (info?.isDirectory()) {
      return {
        root: artifactPath,
        entrypoint: resolvePackagePath(artifactPath, module.entrypoint)
      };
    }
    if (info?.isFile()) {
      if (path.basename(artifactPath) !== module.entrypoint) {
        throw new SeedSpecError(
          `Context module ${module.id} entrypoint must match artifact file ${path.basename(artifactPath)}`,
          { code: "INVALID_CONTEXT_MODULE" }
        );
      }
      return { root: path.dirname(artifactPath), entrypoint: artifactPath, file: artifactPath };
    }
    return null;
  }

  const resource = (manifest.implementation_resources?.resources ?? []).find(
    (candidate) => candidate.id === module.source.id
  );
  if (!resource) {
    throw new SeedSpecError(
      `Context module ${module.id} references unknown implementation resource ${module.source.id}`,
      { code: "INVALID_CONTEXT_MODULE" }
    );
  }
  if (resource.entrypoint !== module.entrypoint) {
    throw new SeedSpecError(
      `Context module ${module.id} entrypoint must match implementation resource entrypoint ${resource.entrypoint}`,
      { code: "INVALID_CONTEXT_MODULE" }
    );
  }
  if (!resource.bundled) return null;
  const moduleRoot = resolvePackagePath(root, resource.bundled.path);
  return {
    root: moduleRoot,
    entrypoint: resolvePackagePath(moduleRoot, module.entrypoint)
  };
}

export async function contextModuleDigest(local) {
  return local.file
    ? computeFileDigest(local.file)
    : computeDirectoryDigest(local.root);
}

export async function validateContextDeclarations(root, manifest) {
  const modules = contextModules(manifest);
  const details = [];

  for (const id of new Set(duplicateIds(modules))) {
    details.push(`context.modules repeats ${id}`);
  }

  const modulesById = new Map(modules.map((module) => [module.id, module]));
  if (!modulesById.has(manifest.definition.module)) {
    details.push(`definition.module references unknown context module ${manifest.definition.module}`);
  }

  const bridgeSkillIds = new Set();
  for (const module of modules) {
    const seenBridges = new Set();
    for (const bridge of module.bridges ?? []) {
      const key = `${bridge.skill}\0${JSON.stringify(bridge.applies_to ?? {})}`;
      if (seenBridges.has(key)) {
        details.push(`context module ${module.id} repeats bridge Skill ${bridge.skill}`);
      }
      seenBridges.add(key);
      const skill = modulesById.get(bridge.skill);
      if (!skill) {
        details.push(`context module ${module.id} references unknown bridge Skill ${bridge.skill}`);
      } else if (path.basename(skill.entrypoint) !== "SKILL.md") {
        details.push(`context module ${module.id} bridge ${bridge.skill} must reference a SKILL.md entrypoint`);
      }
      bridgeSkillIds.add(bridge.skill);
    }
  }

  if (details.length > 0) {
    throw new SeedSpecError(`SeedSpec manifest has invalid context semantics: ${manifest.id}`, {
      code: "INVALID_CONTEXT_MODULE",
      details
    });
  }

  for (const module of modules) {
    const local = await localContextModule(root, manifest, module);
    if (!local) {
      if (module.id === manifest.definition.module) {
        throw new SeedSpecError("The primary intent context module must have local bytes", {
          code: "INVALID_CONTEXT_MODULE",
          details: [`definition.module: ${module.id}`]
        });
      }
      continue;
    }
    const entrypointInfo = await pathExists(local.entrypoint);
    if (!entrypointInfo?.isFile()) {
      throw new SeedSpecError(
        `Context module ${module.id} entrypoint is not a file: ${module.entrypoint}`,
        { code: "INVALID_CONTEXT_MODULE" }
      );
    }
    if (bridgeSkillIds.has(module.id)) {
      parseBridgeFrontmatter(
        await readFile(local.entrypoint, "utf8"),
        `Context bridge ${module.id} SKILL.md`
      );
    }
  }
}

async function copyPackageModule(record, module, destination) {
  const local = await localContextModule(record.root, record.manifest, module);
  if (!local) return false;
  await mkdir(destination, { recursive: true });
  if (local.file) {
    await cp(local.file, path.join(destination, module.entrypoint));
  } else {
    await cp(local.root, destination, { recursive: true });
  }
  return local;
}

export async function materializeContextIndex(
  records,
  workspace,
  artifactIndex,
  implementationResourceIndex
) {
  const baseDirectory = path.join(workspace, "context");
  await rm(baseDirectory, { recursive: true, force: true });
  await mkdir(baseDirectory, { recursive: true });

  const index = {
    protocol_version: protocolVersion,
    modules: []
  };

  for (const record of records) {
    const packageDirectory = directoryName(record.manifest.id);
    for (const module of contextModules(record.manifest)) {
      const resolved = {
        package: record.manifest.id,
        package_digest: record.digest,
        id: module.id,
        qualified_id: `${record.manifest.id}/${module.id}`,
        role: record.manifest.definition.module === module.id ? "primary-intent" : "supporting",
        format: module.format,
        description: module.description,
        entrypoint: module.entrypoint,
        source: module.source,
        availability: "declared",
        ...(module.format_version ? { format_version: module.format_version } : {}),
        ...(module.conforms_to ? { conforms_to: module.conforms_to } : {}),
        ...(module.applies_to ? { applies_to: module.applies_to } : {}),
        ...(module.bridges?.length ? {
          bridges: module.bridges.map((bridge) => ({
            ...bridge,
            skill: `${record.manifest.id}/${bridge.skill}`
          }))
        } : {})
      };

      if (module.source.kind === "package") {
        const relativeRoot = portablePath("context", packageDirectory, module.id);
        const destination = path.join(workspace, ...relativeRoot.split("/"));
        const local = await copyPackageModule(record, module, destination);
        resolved.root = `${relativeRoot}/`;
        resolved.content_digest = await contextModuleDigest(local);
        resolved.content_digest_scope = local.file ? "entrypoint" : "module";
        resolved.availability = "materialized";
      } else if (module.source.kind === "artifact") {
        const artifact = artifactIndex.artifacts.find((candidate) => (
          candidate.package === record.manifest.id
          && candidate.id === module.source.id
        ));
        if (artifact?.path) {
          const artifactPath = path.join(workspace, ...artifact.path.split("/"));
          const info = await pathExists(artifactPath);
          resolved.root = info?.isDirectory()
            ? artifact.path
            : `${path.posix.dirname(artifact.path)}/`;
          resolved.content_digest = info?.isDirectory()
            ? await computeDirectoryDigest(artifactPath)
            : await computeFileDigest(artifactPath);
          resolved.content_digest_scope = info?.isDirectory() ? "module" : "entrypoint";
          resolved.availability = "materialized";
        } else if (artifact?.url) {
          resolved.url = artifact.url;
        }
      } else {
        const resource = implementationResourceIndex.resources.find((candidate) => (
          candidate.package === record.manifest.id
          && candidate.id === module.source.id
        ));
        if (resource?.bundled) {
          resolved.root = resource.bundled.path;
          resolved.content_digest = resource.bundled.digest;
          resolved.content_digest_scope = "module";
          resolved.availability = "materialized";
        } else if (resource?.canonical) {
          resolved.url = resource.canonical.manifest_url;
        }
      }

      index.modules.push(resolved);
    }
  }

  return index;
}

export function formatContextInventory(index) {
  if (index.modules.length === 0) return "No context modules are declared.";
  const lines = ["Context modules:"];
  for (const module of index.modules) {
    lines.push(
      `- ${module.qualified_id} (${module.format}; ${module.role}; ${module.availability})${module.bridges?.length ? ` — bridge skills: ${module.bridges.map((bridge) => bridge.skill).join(", ")}` : ""}`
    );
  }
  return lines.join("\n");
}
