import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { resolvePackagePath } from "./files.js";
import { computeDirectoryDigest, computeFileDigest } from "./integrity.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { validatePackage } from "./validate.js";

const DESCRIPTOR_NAME = "seedspec-integration.json";
const MAX_DESCRIPTOR_BYTES = 256 * 1024;

async function descriptorPathFor(source) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) {
    throw new SeedSpecError(`Integration source must not be a symbolic link: ${source}`, {
      code: "INVALID_INTEGRATION_DESCRIPTOR"
    });
  }
  return info.isDirectory() ? path.join(source, DESCRIPTOR_NAME) : source;
}

function formatClaimMatchesModule(claim, module) {
  if (claim.id !== module.format) return false;
  if (claim.entrypoints?.length && !claim.entrypoints.includes(module.entrypoint)) return false;
  if (module.format_version) return (claim.versions ?? []).includes(module.format_version);
  return claim.unversioned === true;
}

async function validateBridgeAssets(root, descriptor) {
  for (const bridge of descriptor.bridges ?? []) {
    const bridgeRoot = resolvePackagePath(root, bridge.path);
    let info;
    try {
      info = await lstat(bridgeRoot);
    } catch {
      info = null;
    }
    if (!info?.isDirectory() || info.isSymbolicLink()) {
      throw new SeedSpecError(`Integration bridge must reference a directory: ${bridge.path}`, {
        code: "INVALID_INTEGRATION_DESCRIPTOR",
        details: [`integration: ${descriptor.id}`, `bridge: ${bridge.id}`]
      });
    }
    const entrypoint = resolvePackagePath(bridgeRoot, bridge.entrypoint);
    let entrypointInfo;
    try {
      entrypointInfo = await lstat(entrypoint);
    } catch {
      entrypointInfo = null;
    }
    if (!entrypointInfo?.isFile() || entrypointInfo.isSymbolicLink()) {
      throw new SeedSpecError(`Integration bridge entrypoint is not a file: ${bridge.entrypoint}`, {
        code: "INVALID_INTEGRATION_DESCRIPTOR",
        details: [`integration: ${descriptor.id}`, `bridge: ${bridge.id}`]
      });
    }
    const skillSource = await readFile(entrypoint, "utf8");
    if (!skillSource.startsWith("---\n") || skillSource.indexOf("\n---", 4) === -1) {
      throw new SeedSpecError(`Integration bridge must contain Skill frontmatter: ${bridge.id}`, {
        code: "INVALID_INTEGRATION_DESCRIPTOR"
      });
    }
    const frontmatterEnd = skillSource.indexOf("\n---", 4);
    let frontmatter;
    try {
      frontmatter = parseYaml(skillSource.slice(4, frontmatterEnd));
    } catch (error) {
      throw new SeedSpecError(`Integration bridge has invalid Skill frontmatter: ${bridge.id}`, {
        code: "INVALID_INTEGRATION_DESCRIPTOR",
        details: [error.message]
      });
    }
    if (!frontmatter?.name || !frontmatter?.description) {
      throw new SeedSpecError(`Integration bridge Skill requires name and description: ${bridge.id}`, {
        code: "INVALID_INTEGRATION_DESCRIPTOR"
      });
    }
    const digest = await computeDirectoryDigest(bridgeRoot);
    if (digest !== bridge.digest) {
      throw new SeedSpecError(`Integration bridge digest does not match: ${bridge.id}`, {
        code: "INTEGRATION_BRIDGE_DIGEST_MISMATCH",
        details: [`declared ${bridge.digest}`, `computed ${digest}`]
      });
    }
  }
}

function assertUniqueIds(items, label, descriptor) {
  const seen = new Set();
  for (const item of items ?? []) {
    if (seen.has(item.id)) {
      throw new SeedSpecError(`Integration ${descriptor.id} repeats ${label} ${item.id}`, {
        code: "INVALID_INTEGRATION_DESCRIPTOR"
      });
    }
    seen.add(item.id);
  }
}

async function validateAdapterAsset(root, descriptor) {
  if (!descriptor.adapter) return;
  const entrypoint = resolvePackagePath(root, descriptor.adapter.entrypoint);
  let info;
  try {
    info = await lstat(entrypoint);
  } catch {
    info = null;
  }
  if (!info?.isFile() || info.isSymbolicLink()) {
    throw new SeedSpecError(
      `Integration adapter entrypoint must be a regular file: ${descriptor.adapter.entrypoint}`,
      { code: "INVALID_INTEGRATION_DESCRIPTOR" }
    );
  }
  const digest = await computeFileDigest(entrypoint);
  if (digest !== descriptor.adapter.digest) {
    throw new SeedSpecError(`Integration adapter digest does not match: ${descriptor.adapter.id}`, {
      code: "INTEGRATION_ADAPTER_DIGEST_MISMATCH",
      details: [`declared ${descriptor.adapter.digest}`, `computed ${digest}`]
    });
  }
}

export async function readIntegrationDescriptor(source) {
  const absoluteSource = path.resolve(source);
  let descriptorPath;
  try {
    descriptorPath = await descriptorPathFor(absoluteSource);
  } catch (error) {
    if (error instanceof SeedSpecError) throw error;
    throw new SeedSpecError(`Integration source does not exist: ${source}`, {
      code: "INTEGRATION_NOT_FOUND"
    });
  }
  let descriptorInfo;
  try {
    descriptorInfo = await lstat(descriptorPath);
  } catch {
    descriptorInfo = null;
  }
  if (!descriptorInfo?.isFile() || descriptorInfo.isSymbolicLink()) {
    throw new SeedSpecError(`Integration descriptor is not a file: ${descriptorPath}`, {
      code: "INTEGRATION_NOT_FOUND"
    });
  }
  if (descriptorInfo.size > MAX_DESCRIPTOR_BYTES) {
    throw new SeedSpecError(`Integration descriptor is too large: ${descriptorPath}`, {
      code: "INVALID_INTEGRATION_DESCRIPTOR"
    });
  }

  let descriptor;
  try {
    descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
  } catch (error) {
    throw new SeedSpecError(`Integration descriptor is invalid JSON: ${descriptorPath}`, {
      code: "INVALID_INTEGRATION_DESCRIPTOR",
      details: [error.message]
    });
  }
  const validate = await compileProtocolSchema("integration-descriptor.schema.json");
  if (!validate(descriptor)) {
    throw new SeedSpecError(`Integration descriptor is invalid: ${descriptorPath}`, {
      code: "INVALID_INTEGRATION_DESCRIPTOR",
      details: formatSchemaErrors(validate.errors)
    });
  }
  const root = path.dirname(descriptorPath);
  assertUniqueIds(descriptor.formats, "format", descriptor);
  assertUniqueIds(descriptor.bridges, "bridge", descriptor);
  await validateAdapterAsset(root, descriptor);
  await validateBridgeAssets(root, descriptor);
  return {
    root,
    path: descriptorPath,
    digest: await computeFileDigest(descriptorPath),
    descriptor
  };
}

export async function discoverFormatIntegrations(inputPath, sources = []) {
  const record = await validatePackage(inputPath);
  const integrations = await Promise.all(sources.map(readIntegrationDescriptor));
  const identities = new Map();
  for (const integration of integrations) {
    const previous = identities.get(integration.descriptor.id);
    if (previous) {
      throw new SeedSpecError(`Integration source appears more than once: ${integration.descriptor.id}`, {
        code: "DUPLICATE_FORMAT_INTEGRATION",
        details: [previous.path, integration.path]
      });
    }
    identities.set(integration.descriptor.id, integration);
  }
  const modules = record.manifest.context.modules.map((module) => {
    const compatible = [];
    const incompatible = [];
    for (const integration of integrations) {
      const claim = integration.descriptor.formats.find((candidate) => candidate.id === module.format);
      if (!claim) continue;
      if (!formatClaimMatchesModule(claim, module)) {
        incompatible.push({
          integration: integration.descriptor.id,
          version: integration.descriptor.version,
          reason: "format-version-or-entrypoint-mismatch"
        });
        continue;
      }
      compatible.push({
        integration: integration.descriptor.id,
        version: integration.descriptor.version,
        descriptor_digest: integration.digest,
        adapter: integration.descriptor.adapter ?? null,
        bridges: (integration.descriptor.bridges ?? []).filter((bridge) => (
          bridge.formats.includes(module.format)
        ))
      });
    }
    return {
      module: module.id,
      format: module.format,
      ...(module.format_version ? { format_version: module.format_version } : {}),
      compatible,
      incompatible
    };
  });
  return {
    discovery_version: "1",
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    sources: integrations.map((integration) => ({
      id: integration.descriptor.id,
      version: integration.descriptor.version,
      descriptor: integration.path,
      digest: integration.digest
    })),
    modules
  };
}

export async function loadIntegrationAdapter(source, registry) {
  const integration = await readIntegrationDescriptor(source);
  const advertised = integration.descriptor.adapter;
  if (!advertised) {
    throw new SeedSpecError(`Integration does not advertise an adapter: ${integration.descriptor.id}`, {
      code: "CONTEXT_ADAPTER_NOT_FOUND"
    });
  }
  const entrypoint = resolvePackagePath(integration.root, advertised.entrypoint);
  let info;
  try {
    info = await lstat(entrypoint);
  } catch {
    info = null;
  }
  if (!info?.isFile() || info.isSymbolicLink()) {
    throw new SeedSpecError(`Integration adapter entrypoint is not a file: ${advertised.entrypoint}`, {
      code: "CONTEXT_ADAPTER_NOT_FOUND"
    });
  }
  const loaded = await import(pathToFileURL(entrypoint).href);
  const adapter = loaded.adapter ?? loaded.default;
  if (
    !adapter
    || adapter.id !== advertised.id
    || adapter.version !== advertised.version
    || adapter.adapter_api_version !== advertised.adapter_api_version
  ) {
    throw new SeedSpecError(`Loaded adapter identity does not match ${integration.descriptor.id}`, {
      code: "INVALID_CONTEXT_ADAPTER",
      details: [
        `advertised ${advertised.id}@${advertised.version}`,
        `loaded ${adapter?.id ?? "missing"}@${adapter?.version ?? "missing"}`
      ]
    });
  }
  const advertisedCapabilities = [...advertised.capabilities].sort().join("\0");
  const loadedCapabilities = [...(adapter.capabilities ?? [])].sort().join("\0");
  if (advertisedCapabilities !== loadedCapabilities) {
    throw new SeedSpecError(`Loaded adapter capabilities do not match ${integration.descriptor.id}`, {
      code: "INVALID_CONTEXT_ADAPTER"
    });
  }
  for (const format of integration.descriptor.formats) {
    const claim = (adapter.formats ?? []).find((candidate) => candidate.id === format.id);
    const versionsCovered = (format.versions ?? []).every((version) => (
      (claim?.versions ?? []).includes(version)
    ));
    if (!claim || !versionsCovered || (format.unversioned === true && claim.unversioned !== true)) {
      throw new SeedSpecError(`Loaded adapter does not cover advertised format ${format.id}`, {
        code: "INVALID_CONTEXT_ADAPTER"
      });
    }
  }
  registry.register(adapter);
  return {
    integration: integration.descriptor.id,
    version: integration.descriptor.version,
    descriptor_digest: integration.digest,
    adapter: adapter.id
  };
}

export function formatIntegrationDiscovery(discovery) {
  const lines = [`Format integrations for ${discovery.package.id}@${discovery.package.version}`];
  for (const module of discovery.modules) {
    lines.push(`- ${module.module} (${module.format}${module.format_version ? `@${module.format_version}` : ""})`);
    if (module.compatible.length === 0) lines.push("  Compatible integrations: none");
    for (const match of module.compatible) {
      lines.push(
        `  Compatible: ${match.integration}@${match.version}`,
        `    Adapter: ${match.adapter ? `${match.adapter.id}@${match.adapter.version}` : "none"}`,
        `    Default bridges: ${match.bridges.filter((bridge) => bridge.default).map((bridge) => bridge.id).join(", ") || "none"}`
      );
    }
    for (const mismatch of module.incompatible) {
      lines.push(`  Incompatible: ${mismatch.integration}@${mismatch.version} (${mismatch.reason})`);
    }
  }
  return lines.join("\n");
}
