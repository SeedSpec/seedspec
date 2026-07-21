import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { pathExists, readYamlFile, resolvePackagePath } from "./files.js";
import { computeDirectoryDigest } from "./integrity.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_RESOURCE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_RESOURCE_TOTAL_BYTES = 10 * 1024 * 1024;

function portablePath(...parts) {
  return parts.join("/");
}

function directoryName(id) {
  return id.replace(/[^a-zA-Z0-9.-]/gu, "-");
}

function resourceKey(packageId, resourceId) {
  return `${packageId}/${resourceId}`;
}

function duplicateIds(items) {
  const seen = new Set();
  return items
    .map((item) => item.id)
    .filter((id) => seen.has(id) || !seen.add(id));
}

function assertHttpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new SeedSpecError(`${label} is not a valid URL: ${value}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE"
    });
  }
  if (url.protocol !== "https:") {
    throw new SeedSpecError(`${label} must use HTTPS: ${value}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE"
    });
  }
  const hostname = url.hostname.toLowerCase();
  const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/u;
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname === "::1"
    || hostname === "[::1]"
    || privateIpv4.test(hostname)
  ) {
    throw new SeedSpecError(`${label} must not target a local or private network host: ${value}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE"
    });
  }
}

function parseSkillFrontmatter(source, label) {
  if (!source.startsWith("---\n")) {
    throw new SeedSpecError(`${label} must begin with YAML frontmatter`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE"
    });
  }
  const end = source.indexOf("\n---", 4);
  if (end === -1) {
    throw new SeedSpecError(`${label} has unterminated YAML frontmatter`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE"
    });
  }
  let frontmatter;
  try {
    frontmatter = parseYaml(source.slice(4, end));
  } catch (error) {
    throw new SeedSpecError(`${label} has invalid YAML frontmatter`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE",
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
      code: "INVALID_IMPLEMENTATION_RESOURCE"
    });
  }
  return frontmatter;
}

async function validateResourceEntrypoint(root, resource, label) {
  const entrypoint = resolvePackagePath(root, resource.entrypoint);
  const info = await pathExists(entrypoint);
  if (!info?.isFile()) {
    throw new SeedSpecError(`${label} entrypoint is not a file: ${resource.entrypoint}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE"
    });
  }
  if (resource.kind === "skill") {
    if (path.basename(resource.entrypoint) !== "SKILL.md") {
      throw new SeedSpecError(`${label} skill entrypoint must be named SKILL.md`, {
        code: "INVALID_IMPLEMENTATION_RESOURCE"
      });
    }
    parseSkillFrontmatter(await readFile(entrypoint, "utf8"), `${label} SKILL.md`);
  }
}

export async function validateImplementationResourceDeclarations(root, manifest) {
  const declaration = manifest.implementation_resources;
  if (!declaration) return;

  const details = [];
  for (const id of new Set(duplicateIds(declaration.resources))) {
    details.push(`implementation_resources.resources repeats ${id}`);
  }
  for (const id of new Set(duplicateIds(declaration.catalogs ?? []))) {
    details.push(`implementation_resources.catalogs repeats ${id}`);
  }
  if (declaration.additional_guidance === "none" && (declaration.catalogs?.length ?? 0) > 0) {
    details.push("implementation_resources.catalogs requires additional_guidance: agent-delegated");
  }
  if (details.length > 0) {
    throw new SeedSpecError(`SeedSpec manifest has invalid implementation-resource semantics: ${manifest.id}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE",
      details
    });
  }

  for (const catalog of declaration.catalogs ?? []) {
    assertHttpsUrl(catalog.url, `implementation_resources catalog ${catalog.id}`);
  }

  for (const resource of declaration.resources) {
    const label = `implementation resource ${resource.id}`;
    if (resource.canonical) {
      assertHttpsUrl(resource.canonical.manifest_url, `${label} canonical manifest`);
    }
    if (!resource.bundled) continue;

    if (
      resource.bundled.compatibility === "exact"
      && resource.bundled.version !== resource.version
    ) {
      throw new SeedSpecError(`${label} declares exact bundled compatibility with a different version`, {
        code: "INVALID_IMPLEMENTATION_RESOURCE",
        details: [`requested ${resource.version}`, `bundled ${resource.bundled.version}`]
      });
    }

    const bundleRoot = resolvePackagePath(root, resource.bundled.path);
    const info = await pathExists(bundleRoot);
    if (!info?.isDirectory()) {
      throw new SeedSpecError(`${label} bundled path must reference a directory: ${resource.bundled.path}`, {
        code: "INVALID_IMPLEMENTATION_RESOURCE"
      });
    }
    await validateResourceEntrypoint(bundleRoot, resource, label);
    const digest = await computeDirectoryDigest(bundleRoot);
    if (digest !== resource.bundled.digest) {
      throw new SeedSpecError(`${label} bundled digest does not match its contents`, {
        code: "IMPLEMENTATION_RESOURCE_DIGEST_MISMATCH",
        details: [`declared ${resource.bundled.digest}`, `computed ${digest}`]
      });
    }
  }
}

export async function listPackageImplementationResources(inputPath) {
  const { validatePackage } = await import("./validate.js");
  const record = await validatePackage(inputPath);
  const declaration = record.manifest.implementation_resources;
  return {
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    additional_guidance: declaration?.additional_guidance ?? "unspecified",
    catalogs: declaration?.catalogs ?? [],
    resources: declaration?.resources ?? []
  };
}

export function formatImplementationResourceListing(listing) {
  const lines = [
    `Implementation resources in ${listing.package.id}@${listing.package.version}`,
    `Additional SeedSpec guidance: ${listing.additional_guidance}`
  ];
  if (listing.catalogs.length > 0) {
    lines.push("Discovery catalogs:");
    for (const catalog of listing.catalogs) {
      lines.push(`- ${catalog.id}@${catalog.version}: ${catalog.url}`);
    }
  }
  if (listing.resources.length === 0) {
    lines.push("Declared resources: none");
  } else {
    lines.push("Declared resources:");
    for (const resource of listing.resources) {
      lines.push(
        `- ${resource.id}@${resource.version} (${resource.kind}; ${resource.usage}; ${resource.update_policy})`,
        `  ${resource.description}`,
        `  Canonical: ${resource.canonical?.manifest_url ?? "not declared"}`,
        `  Bundled: ${resource.bundled?.path ?? "not included"}`
      );
    }
  }
  return lines.join("\n");
}

export async function materializeImplementationResources(records, workspace) {
  const baseDirectory = path.join(workspace, "implementation-resources");
  const stagingDirectory = await mkdtemp(
    path.join(workspace, ".implementation-resources-next-")
  );

  const index = {
    protocol_version: "0.1",
    policies: [],
    resources: []
  };

  try {
    for (const record of records) {
      const declaration = record.manifest.implementation_resources;
      index.policies.push({
        package: record.manifest.id,
        additional_guidance: declaration?.additional_guidance ?? "unspecified",
        catalogs: declaration?.catalogs ?? []
      });

      for (const resource of declaration?.resources ?? []) {
        const resolved = {
          package: record.manifest.id,
          id: resource.id,
          kind: resource.kind,
          description: resource.description,
          usage: resource.usage,
          entrypoint: resource.entrypoint,
          version: resource.version,
          update_policy: resource.update_policy,
          ...(resource.canonical ? { canonical: resource.canonical } : {}),
          ...(resource.applies_to ? { applies_to: resource.applies_to } : {})
        };

        if (resource.bundled) {
          const relativeDestination = portablePath(
            "implementation-resources",
            directoryName(record.manifest.id),
            directoryName(resource.id),
            "bundled"
          );
          const stagedDestination = path.join(
            stagingDirectory,
            ...relativeDestination.split("/").slice(1)
          );
          await cp(resolvePackagePath(record.root, resource.bundled.path), stagedDestination, {
            recursive: true
          });
          resolved.bundled = {
            path: `${relativeDestination}/`,
            source_path: resource.bundled.path,
            version: resource.bundled.version,
            digest: resource.bundled.digest,
            compatibility: resource.bundled.compatibility
          };
        }
        index.resources.push(resolved);
      }
    }

    const previousIndexPath = path.join(workspace, "implementation-resources.yaml");
    const previousStatePath = path.join(workspace, "implementation-resource-state.yaml");
    if (await pathExists(previousIndexPath) && await pathExists(previousStatePath)) {
      const previousIndex = await readYamlFile(previousIndexPath, "Previous implementation resource index");
      const previousState = await readYamlFile(previousStatePath, "Previous implementation resource state");
      const nextDigest = implementationResourceIndexDigest(index);
      if (
        implementationResourceIndexDigest(previousIndex) === nextDigest
        && previousState.index_digest === nextDigest
      ) {
        for (const resource of index.resources) {
          const existingResolved = resolvedDirectory(workspace, resource);
          const info = await pathExists(existingResolved);
          if (!info?.isDirectory()) continue;
          const stagedResolved = path.join(
            stagingDirectory,
            directoryName(resource.package),
            directoryName(resource.id),
            "resolved"
          );
          await cp(existingResolved, stagedResolved, { recursive: true });
        }
      }
    }

    await rm(baseDirectory, { recursive: true, force: true });
    await rename(stagingDirectory, baseDirectory);

    return index;
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

export function implementationResourceIndexDigest(index) {
  return `sha256:${createHash("sha256").update(JSON.stringify(index), "utf8").digest("hex")}`;
}

export function createInitialImplementationResourceState(index) {
  return {
    protocol_version: "0.1",
    index_digest: implementationResourceIndexDigest(index),
    status: index.resources.length > 0 ? "not-resolved" : "resolved",
    resources: index.resources.map((resource) => ({
      package: resource.package,
      id: resource.id,
      kind: resource.kind,
      usage: resource.usage,
      entrypoint: resource.entrypoint,
      resolution_status: "not-resolved",
      use_status: "not-recorded"
    }))
  };
}

function normalizeImplementationResourceState(state, index) {
  if (!state || typeof state !== "object" || !Array.isArray(state.resources)) return state;
  const declarations = new Map(index.resources.map((resource) => [
    resourceKey(resource.package, resource.id),
    resource
  ]));
  return {
    ...state,
    resources: state.resources.map((resource) => {
      const declaration = declarations.get(resourceKey(resource.package, resource.id));
      return {
        ...resource,
        ...(resource.kind ? {} : { kind: declaration?.kind }),
        ...(resource.entrypoint ? {} : { entrypoint: declaration?.entrypoint }),
        ...(resource.use_status === "loaded" ? { use_status: "consulted" } : {})
      };
    })
  };
}

export async function reconcileImplementationResourceState(workspace, index) {
  const statePath = path.join(workspace, "implementation-resource-state.yaml");
  const initial = createInitialImplementationResourceState(index);
  if (await pathExists(statePath)) {
    const existing = normalizeImplementationResourceState(
      await readYamlFile(statePath, "Implementation resource state"),
      index
    );
    const validate = await compileProtocolSchema("implementation-resource-state.schema.json");
    if (validate(existing) && existing.index_digest === initial.index_digest) {
      await writeFile(statePath, stringifyYaml(existing), "utf8");
      return existing;
    }
  }
  await writeFile(statePath, stringifyYaml(initial), "utf8");
  return initial;
}

function parseVersion(version) {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/u.exec(version);
  if (!match) return null;
  return {
    core: match.slice(1, 4).map(Number),
    prerelease: match[4]?.split(".") ?? []
  };
}

function compareVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) {
    throw new SeedSpecError(`Cannot compare invalid implementation resource versions: ${left}, ${right}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE_VERSION"
    });
  }
  for (let index = 0; index < 3; index += 1) {
    if (leftVersion.core[index] !== rightVersion.core[index]) {
      return leftVersion.core[index] - rightVersion.core[index];
    }
  }

  if (leftVersion.prerelease.length === 0 && rightVersion.prerelease.length === 0) return 0;
  if (leftVersion.prerelease.length === 0) return 1;
  if (rightVersion.prerelease.length === 0) return -1;

  const length = Math.max(leftVersion.prerelease.length, rightVersion.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftVersion.prerelease[index];
    const rightIdentifier = rightVersion.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;

    const leftNumeric = /^[0-9]+$/u.test(leftIdentifier);
    const rightNumeric = /^[0-9]+$/u.test(rightIdentifier);
    if (leftNumeric && rightNumeric) return Number(leftIdentifier) - Number(rightIdentifier);
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}

function assertResolvedVersion(resource, actualVersion) {
  const comparison = compareVersions(actualVersion, resource.version);
  if (resource.update_policy === "exact" && actualVersion !== resource.version) {
    throw new SeedSpecError(`Canonical resource ${resource.id} returned ${actualVersion}; expected exactly ${resource.version}`, {
      code: "IMPLEMENTATION_RESOURCE_VERSION_MISMATCH"
    });
  }
  if (
    resource.update_policy === "latest-compatible"
    && (parseVersion(actualVersion).core[0] !== parseVersion(resource.version).core[0] || comparison < 0)
  ) {
    throw new SeedSpecError(`Canonical resource ${resource.id} returned incompatible version ${actualVersion}`, {
      code: "IMPLEMENTATION_RESOURCE_VERSION_MISMATCH",
      details: [`requested ${resource.version} with latest-compatible policy`]
    });
  }
  if (resource.update_policy === "latest" && comparison < 0) {
    throw new SeedSpecError(`Canonical resource ${resource.id} returned older version ${actualVersion}`, {
      code: "IMPLEMENTATION_RESOURCE_VERSION_MISMATCH",
      details: [`minimum requested version ${resource.version}`]
    });
  }
}

async function fetchBytes(fetchImpl, url, limit, label) {
  let currentUrl = url;
  let response;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    assertHttpsUrl(currentUrl, redirectCount === 0 ? label : `${label} redirect`);
    response = await fetchImpl(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000)
    });
    if (response?.status < 300 || response?.status >= 400) break;
    const location = response.headers?.get?.("location");
    if (!location) {
      throw new SeedSpecError(`${label} returned a redirect without a location`, {
        code: "IMPLEMENTATION_RESOURCE_FETCH_FAILED"
      });
    }
    currentUrl = new URL(location, currentUrl).href;
    response = undefined;
  }
  if (!response) {
    throw new SeedSpecError(`${label} exceeded the redirect limit`, {
      code: "IMPLEMENTATION_RESOURCE_FETCH_FAILED"
    });
  }
  if (!response?.ok) {
    throw new SeedSpecError(`${label} could not be retrieved`, {
      code: "IMPLEMENTATION_RESOURCE_FETCH_FAILED",
      details: [`${response?.status ?? "unknown"} ${response?.statusText ?? ""}`.trim()]
    });
  }
  if (response.url) assertHttpsUrl(response.url, `${label} final URL`);
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new SeedSpecError(`${label} exceeds the allowed size`, {
      code: "IMPLEMENTATION_RESOURCE_TOO_LARGE"
    });
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > limit) {
    throw new SeedSpecError(`${label} exceeds the allowed size`, {
      code: "IMPLEMENTATION_RESOURCE_TOO_LARGE"
    });
  }
  return bytes;
}

async function downloadCanonicalResource(resource, destination, fetchImpl) {
  const manifestBytes = await fetchBytes(
    fetchImpl,
    resource.canonical.manifest_url,
    MAX_MANIFEST_BYTES,
    `Canonical manifest for ${resource.id}`
  );
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch (error) {
    throw new SeedSpecError(`Canonical manifest for ${resource.id} is not valid JSON`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE_MANIFEST",
      details: [error.message]
    });
  }
  const validate = await compileProtocolSchema("implementation-resource-manifest.schema.json");
  if (!validate(manifest)) {
    throw new SeedSpecError(`Canonical manifest for ${resource.id} is invalid`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE_MANIFEST",
      details: formatSchemaErrors(validate.errors)
    });
  }

  if (manifest.id !== resource.id || manifest.kind !== resource.kind) {
    throw new SeedSpecError(`Canonical manifest identity does not match ${resource.id}`, {
      code: "IMPLEMENTATION_RESOURCE_IDENTITY_MISMATCH"
    });
  }
  if (manifest.entrypoint !== resource.entrypoint) {
    throw new SeedSpecError(`Canonical manifest entrypoint does not match ${resource.id}`, {
      code: "IMPLEMENTATION_RESOURCE_IDENTITY_MISMATCH"
    });
  }
  assertResolvedVersion(resource, manifest.version);

  const filePaths = new Set();
  let totalBytes = 0;
  for (const file of manifest.files) {
    if (filePaths.has(file.path)) {
      throw new SeedSpecError(`Canonical manifest repeats resource file ${file.path}`, {
        code: "INVALID_IMPLEMENTATION_RESOURCE_MANIFEST"
      });
    }
    filePaths.add(file.path);
    assertHttpsUrl(file.url, `Canonical resource file ${file.path}`);
    const bytes = await fetchBytes(
      fetchImpl,
      file.url,
      MAX_RESOURCE_FILE_BYTES,
      `Canonical resource file ${file.path}`
    );
    totalBytes += bytes.length;
    if (totalBytes > MAX_RESOURCE_TOTAL_BYTES) {
      throw new SeedSpecError(`Canonical resource ${resource.id} exceeds the aggregate size limit`, {
        code: "IMPLEMENTATION_RESOURCE_TOO_LARGE"
      });
    }
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (digest !== file.digest) {
      throw new SeedSpecError(`Canonical resource file digest mismatch: ${file.path}`, {
        code: "IMPLEMENTATION_RESOURCE_DIGEST_MISMATCH",
        details: [`declared ${file.digest}`, `computed ${digest}`]
      });
    }
    const filePath = path.join(destination, ...file.path.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
  }
  if (!filePaths.has(manifest.entrypoint)) {
    throw new SeedSpecError(`Canonical manifest entrypoint is not listed as a file: ${manifest.entrypoint}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE_MANIFEST"
    });
  }

  await validateResourceEntrypoint(destination, resource, `canonical resource ${resource.id}`);
  const digest = await computeDirectoryDigest(destination);
  if (digest !== manifest.digest) {
    throw new SeedSpecError(`Canonical resource aggregate digest mismatch: ${resource.id}`, {
      code: "IMPLEMENTATION_RESOURCE_DIGEST_MISMATCH",
      details: [`manifest ${manifest.digest}`, `computed ${digest}`]
    });
  }
  if (resource.canonical.digest && digest !== resource.canonical.digest) {
    throw new SeedSpecError(`Canonical resource does not match the package-pinned digest: ${resource.id}`, {
      code: "IMPLEMENTATION_RESOURCE_DIGEST_MISMATCH",
      details: [`package ${resource.canonical.digest}`, `resolved ${digest}`]
    });
  }
  return { version: manifest.version, digest };
}

async function copyResolvedDirectory(source, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

async function copyVerifiedBundledResource(workspace, resource, destination) {
  const source = path.join(workspace, ...resource.bundled.path.split("/"));
  const info = await pathExists(source);
  if (!info?.isDirectory()) {
    throw new SeedSpecError(`Bundled implementation resource is unavailable: ${resource.id}`, {
      code: "IMPLEMENTATION_RESOURCE_BUNDLE_UNAVAILABLE"
    });
  }
  await validateResourceEntrypoint(source, resource, `bundled resource ${resource.id}`);
  const digest = await computeDirectoryDigest(source);
  if (digest !== resource.bundled.digest) {
    throw new SeedSpecError(`Bundled implementation resource digest mismatch: ${resource.id}`, {
      code: "IMPLEMENTATION_RESOURCE_DIGEST_MISMATCH",
      details: [`declared ${resource.bundled.digest}`, `computed ${digest}`]
    });
  }
  await copyResolvedDirectory(source, destination);
}

function unavailableResourceState(resource, error, reason) {
  const explanation = String(reason ?? error?.message ?? error ?? "Implementation resource unavailable");
  return {
    package: resource.package,
    id: resource.id,
    kind: resource.kind,
    usage: resource.usage,
    entrypoint: resource.entrypoint,
    resolution_status: "unavailable",
    reason_code: error?.code ?? "IMPLEMENTATION_RESOURCE_UNAVAILABLE",
    reason: explanation.slice(0, 1000),
    use_status: "not-recorded"
  };
}

function resolvedDirectory(workspace, resource) {
  return path.join(
    workspace,
    "implementation-resources",
    directoryName(resource.package),
    directoryName(resource.id),
    "resolved"
  );
}

function relativeResolvedDirectory(resource) {
  return `${portablePath(
    "implementation-resources",
    directoryName(resource.package),
    directoryName(resource.id),
    "resolved"
  )}/`;
}

async function resolveOneResource(workspace, resource, fetchImpl) {
  const destination = resolvedDirectory(workspace, resource);
  if (!resource.canonical) {
    try {
      await copyVerifiedBundledResource(workspace, resource, destination);
      return {
        package: resource.package,
        id: resource.id,
        kind: resource.kind,
        usage: resource.usage,
        entrypoint: resource.entrypoint,
        resolution_status: "bundled",
        resolved_version: resource.bundled.version,
        digest: resource.bundled.digest,
        path: relativeResolvedDirectory(resource),
        use_status: "not-recorded"
      };
    } catch (error) {
      return unavailableResourceState(resource, error);
    }
  }

  const temporaryRoot = await mkdtemp(path.join(workspace, ".resource-download-"));
  try {
    const downloaded = await downloadCanonicalResource(resource, temporaryRoot, fetchImpl);
    await rm(destination, { recursive: true, force: true });
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(temporaryRoot, destination);
    return {
      package: resource.package,
      id: resource.id,
      kind: resource.kind,
      usage: resource.usage,
      entrypoint: resource.entrypoint,
      resolution_status: "online",
      resolved_version: downloaded.version,
      digest: downloaded.digest,
      path: relativeResolvedDirectory(resource),
      source_url: resource.canonical.manifest_url,
      use_status: "not-recorded"
    };
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    if (!resource.bundled) {
      return unavailableResourceState(resource, error);
    }
    try {
      await copyVerifiedBundledResource(workspace, resource, destination);
    } catch (fallbackError) {
      return unavailableResourceState(
        resource,
        fallbackError,
        `Canonical resolution failed: ${error?.message ?? error}; bundled fallback failed: ${fallbackError?.message ?? fallbackError}`
      );
    }
    return {
      package: resource.package,
      id: resource.id,
      kind: resource.kind,
      usage: resource.usage,
      entrypoint: resource.entrypoint,
      resolution_status: "bundled-fallback",
      resolved_version: resource.bundled.version,
      digest: resource.bundled.digest,
      path: relativeResolvedDirectory(resource),
      reason_code: error.code ?? "CANONICAL_RESOURCE_UNAVAILABLE",
      reason: error.message,
      use_status: "not-recorded"
    };
  }
}

function workspaceForProject(projectPath) {
  const absolute = path.resolve(projectPath);
  return path.basename(absolute) === ".seedspec" ? absolute : path.join(absolute, ".seedspec");
}

export async function resolveImplementationResources(projectPath, {
  fetchImpl = globalThis.fetch
} = {}) {
  const workspace = workspaceForProject(projectPath);
  const indexPath = path.join(workspace, "implementation-resources.yaml");
  const statePath = path.join(workspace, "implementation-resource-state.yaml");
  const index = await readYamlFile(indexPath, "Implementation resource index");
  const validateIndex = await compileProtocolSchema("implementation-resource-index.schema.json");
  if (!validateIndex(index)) {
    throw new SeedSpecError("Implementation resource index is invalid", {
      code: "INVALID_IMPLEMENTATION_RESOURCE_INDEX",
      details: formatSchemaErrors(validateIndex.errors)
    });
  }
  if (typeof fetchImpl !== "function" && index.resources.some((resource) => resource.canonical)) {
    throw new SeedSpecError("No fetch implementation is available for canonical resources", {
      code: "IMPLEMENTATION_RESOURCE_FETCH_UNAVAILABLE"
    });
  }

  let previousUse = new Map();
  if (await pathExists(statePath)) {
    const previous = normalizeImplementationResourceState(
      await readYamlFile(statePath, "Implementation resource state"),
      index
    );
    const validatePreviousState = await compileProtocolSchema(
      "implementation-resource-state.schema.json"
    );
    if (!validatePreviousState(previous)) {
      throw new SeedSpecError("Implementation resource state is invalid", {
        code: "INVALID_IMPLEMENTATION_RESOURCE_STATE",
        details: formatSchemaErrors(validatePreviousState.errors)
      });
    }
    if (previous.index_digest === implementationResourceIndexDigest(index)) {
      previousUse = new Map(previous.resources.map((resource) => [
        resourceKey(resource.package, resource.id),
        { use_status: resource.use_status, use_reason: resource.use_reason }
      ]));
    }
  }

  const resources = [];
  for (const resource of index.resources) {
    const resolved = await resolveOneResource(workspace, resource, fetchImpl);
    const earlier = previousUse.get(resourceKey(resource.package, resource.id));
    if (earlier) {
      resolved.use_status = earlier.use_status;
      if (earlier.use_reason) resolved.use_reason = earlier.use_reason;
    }
    resources.push(resolved);
  }

  const requiredUnavailable = resources.filter(
    (resource) => resource.usage === "required" && resource.resolution_status === "unavailable"
  );
  const anyUnavailable = resources.some((resource) => resource.resolution_status === "unavailable");
  const anyFallback = resources.some((resource) => resource.resolution_status === "bundled-fallback");
  const state = {
    protocol_version: "0.1",
    index_digest: implementationResourceIndexDigest(index),
    status: requiredUnavailable.length > 0
      ? "failed"
      : anyUnavailable || anyFallback
        ? "degraded"
        : "resolved",
    resources
  };
  const validateState = await compileProtocolSchema("implementation-resource-state.schema.json");
  if (!validateState(state)) {
    throw new SeedSpecError("Generated implementation resource state is invalid", {
      code: "INVALID_IMPLEMENTATION_RESOURCE_STATE",
      details: formatSchemaErrors(validateState.errors)
    });
  }
  await writeFile(statePath, stringifyYaml(state), "utf8");

  if (requiredUnavailable.length > 0) {
    throw new SeedSpecError("Required implementation resources are unavailable", {
      code: "REQUIRED_IMPLEMENTATION_RESOURCE_UNAVAILABLE",
      details: requiredUnavailable.map((resource) => (
        `${resource.package}/${resource.id}: ${resource.reason_code} — ${resource.reason}`
      ))
    });
  }
  return state;
}

export function formatImplementationResourceResolution(state) {
  const lines = [`Implementation resources: ${state.status}`];
  if (state.resources.length === 0) return `${lines[0]} (none declared)`;
  for (const resource of state.resources) {
    lines.push(
      `- ${resource.package}/${resource.id}: ${resource.resolution_status}`,
      ...(resource.resolved_version ? [`  Version: ${resource.resolved_version}`] : []),
      ...(resource.path ? [`  Local path: ${resource.path}`] : []),
      ...(resource.path ? [`  ${resource.kind === "skill" ? "Skill" : "Resource"} entrypoint: ${resource.path}${resource.entrypoint}`] : []),
      ...(resource.reason ? [`  Fallback/unavailable reason: ${resource.reason_code} — ${resource.reason}`] : [])
    );
  }
  return lines.join("\n");
}

export async function recordImplementationResourceUse(projectPath, {
  packageId,
  resourceId,
  useStatus,
  reason
}) {
  if (!["consulted", "skipped"].includes(useStatus)) {
    throw new SeedSpecError(`Unsupported implementation resource use status: ${useStatus}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE_USE"
    });
  }
  const workspace = workspaceForProject(projectPath);
  const index = await readYamlFile(
    path.join(workspace, "implementation-resources.yaml"),
    "Implementation resource index"
  );
  const statePath = path.join(workspace, "implementation-resource-state.yaml");
  const rawState = await readYamlFile(statePath, "Implementation resource state");
  const validateIndex = await compileProtocolSchema("implementation-resource-index.schema.json");
  if (!validateIndex(index)) {
    throw new SeedSpecError("Implementation resource index is invalid", {
      code: "INVALID_IMPLEMENTATION_RESOURCE_INDEX",
      details: formatSchemaErrors(validateIndex.errors)
    });
  }
  const state = normalizeImplementationResourceState(rawState, index);
  const validateExistingState = await compileProtocolSchema(
    "implementation-resource-state.schema.json"
  );
  if (!validateExistingState(state)) {
    throw new SeedSpecError("Implementation resource state is invalid", {
      code: "INVALID_IMPLEMENTATION_RESOURCE_STATE",
      details: formatSchemaErrors(validateExistingState.errors)
    });
  }
  const expectedDigest = implementationResourceIndexDigest(index);
  if (state.index_digest !== expectedDigest) {
    throw new SeedSpecError("Implementation resource state does not match the current resource index", {
      code: "STALE_IMPLEMENTATION_RESOURCE_STATE",
      details: [`state ${state.index_digest}`, `index ${expectedDigest}`]
    });
  }
  const resource = state.resources.find((candidate) => (
    candidate.package === packageId && candidate.id === resourceId
  ));
  if (!resource) {
    throw new SeedSpecError(`Implementation resource is not declared: ${packageId}/${resourceId}`, {
      code: "IMPLEMENTATION_RESOURCE_NOT_FOUND"
    });
  }
  if (
    useStatus === "consulted"
    && ["not-resolved", "unavailable"].includes(resource.resolution_status)
  ) {
    throw new SeedSpecError(`Implementation resource cannot be recorded as consulted before resolution: ${packageId}/${resourceId}`, {
      code: "IMPLEMENTATION_RESOURCE_NOT_RESOLVED"
    });
  }
  resource.use_status = useStatus;
  if (reason) resource.use_reason = reason;
  else delete resource.use_reason;

  const validateState = await compileProtocolSchema("implementation-resource-state.schema.json");
  if (!validateState(state)) {
    throw new SeedSpecError("Implementation resource use record is invalid", {
      code: "INVALID_IMPLEMENTATION_RESOURCE_STATE",
      details: formatSchemaErrors(validateState.errors)
    });
  }
  await writeFile(statePath, stringifyYaml(state), "utf8");
  return { ...resource };
}
