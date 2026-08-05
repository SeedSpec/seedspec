import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
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
import { protocolVersion } from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { pathExists, portablePath, readYamlFile, resolvePackagePath } from "./files.js";
import { computeDirectoryDigest } from "./integrity.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_RESOURCE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_RESOURCE_TOTAL_BYTES = 10 * 1024 * 1024;

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

function parseIpv4Octets(hostname) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(hostname);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((value) => value <= 255) ? octets : null;
}

function ipv4IsForbidden(octets) {
  const [first, second] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 192 && second === 168)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 100 && second >= 64 && second <= 127);
}

function parseIpv6Groups(address) {
  const bare = address.split("%")[0];
  const halves = bare.split("::");
  if (halves.length > 2) return null;
  const expand = (section) => (section === "" ? [] : section.split(":"));
  const headGroups = expand(halves[0]);
  const tailGroups = halves.length === 2 ? expand(halves[1]) : [];
  const trailing = tailGroups.length > 0 ? tailGroups : headGroups;
  if (trailing.length > 0 && trailing[trailing.length - 1].includes(".")) {
    const octets = parseIpv4Octets(trailing.pop());
    if (!octets) return null;
    trailing.push(
      (((octets[0] << 8) | octets[1]) >>> 0).toString(16),
      (((octets[2] << 8) | octets[3]) >>> 0).toString(16)
    );
  }
  const missing = 8 - headGroups.length - tailGroups.length;
  if (halves.length === 2 ? missing < 0 : missing !== 0) return null;
  const groups = [
    ...headGroups,
    ...Array(halves.length === 2 ? missing : 0).fill("0"),
    ...tailGroups
  ].map((group) => (/^[0-9a-f]{1,4}$/u.test(group) ? Number.parseInt(group, 16) : Number.NaN));
  return groups.length === 8 && groups.every(Number.isFinite) ? groups : null;
}

function ipv6IsForbidden(groups) {
  const zeroThrough = (end) => groups.slice(0, end).every((group) => group === 0);
  if (zeroThrough(8)) return true;
  if (zeroThrough(7) && groups[7] === 1) return true;
  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  if ((groups[0] & 0xffc0) === 0xfec0) return true;
  if (zeroThrough(5) && (groups[5] === 0xffff || groups[5] === 0)) {
    return ipv4IsForbidden([
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff
    ]);
  }
  return false;
}

function hostIsForbidden(hostname) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.startsWith("[") && host.endsWith("]")) {
    const groups = parseIpv6Groups(host.slice(1, -1));
    return groups === null || ipv6IsForbidden(groups);
  }
  const octets = parseIpv4Octets(host);
  if (octets) return ipv4IsForbidden(octets);
  if (host.includes(":")) {
    const groups = parseIpv6Groups(host);
    return groups === null || ipv6IsForbidden(groups);
  }
  return false;
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
  if (hostIsForbidden(url.hostname)) {
    throw new SeedSpecError(`${label} must not target a local or private network host: ${value}`, {
      code: "INVALID_IMPLEMENTATION_RESOURCE"
    });
  }
}

// Literal checks cannot see where a hostname points, so the fetch path also
// vets every resolved address before connecting. Rebinding between this check
// and the connection is out of scope for the reference runtime.
async function assertPublicDnsResolution(lookupImpl, hostname, label) {
  const host = hostname.toLowerCase();
  if (host.startsWith("[") || parseIpv4Octets(host)) return;
  let records;
  try {
    records = await lookupImpl(host, { all: true });
  } catch (error) {
    throw new SeedSpecError(`${label} hostname could not be resolved: ${host}`, {
      code: "IMPLEMENTATION_RESOURCE_FETCH_FAILED",
      details: [error?.message ?? String(error)]
    });
  }
  for (const record of records ?? []) {
    if (hostIsForbidden(String(record.address ?? ""))) {
      throw new SeedSpecError(
        `${label} must not target a local or private network host: ${host} resolves to ${record.address}`,
        { code: "INVALID_IMPLEMENTATION_RESOURCE" }
      );
    }
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
  // A bundled skill describes itself in its own frontmatter. That text was
  // parsed for validation and thrown away, leaving the author's 500-character
  // blurb as the only human-visible account of guidance that will shape an
  // agent's behavior.
  const resources = await Promise.all((declaration?.resources ?? []).map(async (resource) => {
    if (resource.kind !== "skill" || !resource.bundled) return resource;
    try {
      const entrypoint = resolvePackagePath(
        path.join(record.root, resource.bundled.path),
        resource.entrypoint
      );
      const frontmatter = parseSkillFrontmatter(
        await readFile(entrypoint, "utf8"),
        `${resource.id} SKILL.md`
      );
      return {
        ...resource,
        declares: { name: frontmatter.name, description: frontmatter.description }
      };
    } catch {
      return resource;
    }
  }));
  return {
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    root: record.root,
    additional_guidance: declaration?.additional_guidance ?? "unspecified",
    catalogs: declaration?.catalogs ?? [],
    resources
  };
}

/**
 * Print exactly what a bundled resource will put into an agent's context.
 *
 * Bundled bytes are digest-bound and therefore reviewable — that is the whole
 * security argument for bundling over referencing. But reviewable in principle
 * is not reviewed in practice unless something puts the text in front of a
 * person at the moment they decide. This is that surface.
 */
export async function readBundledResource(inputPath, selector) {
  const listing = await listPackageImplementationResources(inputPath);
  const [, resourceId] = selector.includes("/") ? selector.split("/") : [null, selector];
  const resource = listing.resources.find(({ id }) => id === resourceId);
  if (!resource) {
    throw new SeedSpecError(`Unknown implementation resource: ${selector}`, {
      code: "IMPLEMENTATION_RESOURCE_NOT_FOUND",
      details: [`declared: ${listing.resources.map(({ id }) => id).join(", ") || "none"}`]
    });
  }
  if (!resource.bundled) {
    throw new SeedSpecError(`Implementation resource is not bundled: ${resource.id}`, {
      code: "IMPLEMENTATION_RESOURCE_NOT_BUNDLED",
      details: [
        `canonical: ${resource.canonical?.manifest_url ?? "not declared"}`,
        "Only bundled bytes can be read from the package. Resolve the resource first to inspect a canonical copy."
      ]
    });
  }
  const bundleRoot = path.join(listing.root, resource.bundled.path);
  const entrypoint = resolvePackagePath(bundleRoot, resource.entrypoint);
  return {
    package: listing.package,
    resource: {
      id: resource.id,
      kind: resource.kind,
      usage: resource.usage,
      version: resource.bundled.version,
      digest: resource.bundled.digest,
      entrypoint: resource.entrypoint,
      declares: resource.declares ?? null
    },
    verified_digest: await computeDirectoryDigest(bundleRoot),
    text: await readFile(entrypoint, "utf8")
  };
}

export function formatBundledResource(result) {
  return [
    `# ${result.resource.id} (${result.resource.kind}) from ${result.package.id}@${result.package.version}`,
    "",
    `- Usage: ${result.resource.usage}`,
    `- Version: ${result.resource.version}`,
    `- Entrypoint: ${result.resource.entrypoint}`,
    `- Declared digest: ${result.resource.digest}`,
    `- Verified digest: ${result.verified_digest}`,
    ...(result.resource.digest === result.verified_digest
      ? ["- These bytes match the digest the package declares."]
      : ["- **The bytes do not match the declared digest. Do not consult this resource.**"]),
    "",
    "This is the exact text this resource would place in an implementing agent's context.",
    "Reading it does not install, activate, or authorize anything.",
    "",
    "---",
    "",
    result.text.trimEnd()
  ].join("\n");
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
      if (resource.declares) {
        lines.push(`  Describes itself as: "${resource.declares.name}" — ${resource.declares.description}`);
      }
      if (resource.bundled) {
        lines.push(`  Read the exact text: seedspec resources <path> --show ${resource.id}`);
      }
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
    protocol_version: protocolVersion,
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
    protocol_version: protocolVersion,
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

async function fetchBytes(transport, url, limit, label) {
  const { fetchImpl, lookupImpl } = transport;
  let currentUrl = url;
  let response;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const hopLabel = redirectCount === 0 ? label : `${label} redirect`;
    assertHttpsUrl(currentUrl, hopLabel);
    await assertPublicDnsResolution(lookupImpl, new URL(currentUrl).hostname, hopLabel);
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

async function downloadCanonicalResource(resource, destination, transport) {
  const manifestBytes = await fetchBytes(
    transport,
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
      transport,
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

async function resolveOneResource(workspace, resource, transport) {
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
    const downloaded = await downloadCanonicalResource(resource, temporaryRoot, transport);
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
  fetchImpl = globalThis.fetch,
  lookupImpl = dnsLookup
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
    const resolved = await resolveOneResource(workspace, resource, { fetchImpl, lookupImpl });
    const earlier = previousUse.get(resourceKey(resource.package, resource.id));
    if (earlier) {
      resolved.use_status = earlier.use_status;
      if (earlier.use_reason) resolved.use_reason = earlier.use_reason;
    }
    resources.push(resolved);
  }

  const expectedUnavailable = resources.filter(
    (resource) => resource.usage === "expected" && resource.resolution_status === "unavailable"
  );
  const anyUnavailable = resources.some((resource) => resource.resolution_status === "unavailable");
  const anyFallback = resources.some((resource) => resource.resolution_status === "bundled-fallback");
  const state = {
    protocol_version: protocolVersion,
    index_digest: implementationResourceIndexDigest(index),
    status: expectedUnavailable.length > 0
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

  if (expectedUnavailable.length > 0) {
    throw new SeedSpecError("Expected implementation resources are unavailable", {
      code: "EXPECTED_IMPLEMENTATION_RESOURCE_UNAVAILABLE",
      details: expectedUnavailable.map((resource) => (
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
