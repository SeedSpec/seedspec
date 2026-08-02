import { SeedSpecError } from "./errors.js";

export const ADAPTER_API_VERSION = "1";

const namespacedIdPattern = /^[a-z0-9]+(?:\.[a-z0-9][a-z0-9-]*){2,}$/u;
const semverPattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const knownCapabilities = new Set(["inspect", "validate", "prepare"]);

function fail(message, details = []) {
  throw new SeedSpecError(message, { code: "INVALID_CONTEXT_ADAPTER", details });
}

function validateFormatClaim(claim, adapterId) {
  if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
    fail(`Adapter ${adapterId} has an invalid format claim`);
  }
  if (!namespacedIdPattern.test(claim.id ?? "")) {
    fail(`Adapter ${adapterId} has an invalid format ID: ${claim.id ?? "missing"}`);
  }
  if (!claim.unversioned && (!Array.isArray(claim.versions) || claim.versions.length === 0)) {
    fail(`Adapter ${adapterId} format ${claim.id} must support unversioned modules or list exact versions`);
  }
  if (claim.versions && (
    !Array.isArray(claim.versions)
    || claim.versions.some((version) => typeof version !== "string" || !version)
  )) {
    fail(`Adapter ${adapterId} format ${claim.id} has invalid versions`);
  }
  if (claim.versions && new Set(claim.versions).size !== claim.versions.length) {
    fail(`Adapter ${adapterId} format ${claim.id} repeats a version`);
  }
}

function validateAdapter(adapter) {
  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
    fail("A context adapter must be an object");
  }
  if (adapter.adapter_api_version !== ADAPTER_API_VERSION) {
    fail(`Unsupported adapter API version: ${adapter.adapter_api_version ?? "missing"}`, [
      `supported: ${ADAPTER_API_VERSION}`
    ]);
  }
  if (!namespacedIdPattern.test(adapter.id ?? "")) {
    fail(`Invalid adapter ID: ${adapter.id ?? "missing"}`);
  }
  if (!semverPattern.test(adapter.version ?? "")) {
    fail(`Invalid adapter version for ${adapter.id}: ${adapter.version ?? "missing"}`);
  }
  if (!Array.isArray(adapter.formats) || adapter.formats.length === 0) {
    fail(`Adapter ${adapter.id} must claim at least one format`);
  }
  for (const claim of adapter.formats) validateFormatClaim(claim, adapter.id);
  if (new Set(adapter.formats.map((claim) => claim.id)).size !== adapter.formats.length) {
    fail(`Adapter ${adapter.id} repeats a format claim`);
  }
  if (!Array.isArray(adapter.capabilities) || adapter.capabilities.length === 0) {
    fail(`Adapter ${adapter.id} must declare capabilities`);
  }
  if (new Set(adapter.capabilities).size !== adapter.capabilities.length) {
    fail(`Adapter ${adapter.id} repeats a capability`);
  }
  for (const capability of adapter.capabilities) {
    if (!knownCapabilities.has(capability)) {
      fail(`Adapter ${adapter.id} declares unknown capability ${capability}`);
    }
    if (capability === "validate" && typeof adapter.validate !== "function") {
      fail(`Adapter ${adapter.id} declares validate without a validate function`);
    }
    if (capability === "prepare" && typeof adapter.prepare !== "function") {
      fail(`Adapter ${adapter.id} declares prepare without a prepare function`);
    }
    if (capability === "inspect" && typeof adapter.inspect !== "function") {
      fail(`Adapter ${adapter.id} declares inspect without an inspect function`);
    }
  }
}

function supportsModule(adapter, module, capability) {
  if (!adapter.capabilities.includes(capability)) return false;
  return adapter.formats.some((claim) => {
    if (claim.id !== module.format) return false;
    if (module.format_version) return (claim.versions ?? []).includes(module.format_version);
    return claim.unversioned === true;
  });
}

function publicAdapter(adapter) {
  return {
    adapter_api_version: adapter.adapter_api_version,
    id: adapter.id,
    version: adapter.version,
    name: adapter.name ?? adapter.id,
    formats: adapter.formats.map((format) => ({ ...format })),
    capabilities: [...adapter.capabilities],
    ...(adapter.documentation ? { documentation: adapter.documentation } : {})
  };
}

export class AdapterRegistry {
  #adapters = new Map();

  constructor(adapters = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter) {
    validateAdapter(adapter);
    if (this.#adapters.has(adapter.id)) {
      throw new SeedSpecError(`Context adapter is already registered: ${adapter.id}`, {
        code: "DUPLICATE_CONTEXT_ADAPTER"
      });
    }
    this.#adapters.set(adapter.id, adapter);
    return this;
  }

  list() {
    return [...this.#adapters.values()]
      .map(publicAdapter)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  match(module, capability, selectedId = null) {
    const candidates = [...this.#adapters.values()].filter((adapter) => (
      supportsModule(adapter, module, capability)
    ));
    if (selectedId) {
      const selected = candidates.find((adapter) => adapter.id === selectedId);
      if (!selected) {
        throw new SeedSpecError(
          `Selected adapter ${selectedId} cannot ${capability} module ${module.qualified_id ?? module.id}`,
          {
            code: "CONTEXT_ADAPTER_NOT_FOUND",
            details: [`format: ${module.format}${module.format_version ? `@${module.format_version}` : ""}`]
          }
        );
      }
      return selected;
    }
    if (candidates.length > 1) {
      throw new SeedSpecError(
        `More than one adapter can ${capability} module ${module.qualified_id ?? module.id}`,
        {
          code: "AMBIGUOUS_CONTEXT_ADAPTER",
          details: candidates.map((adapter) => `${adapter.id}@${adapter.version}`)
        }
      );
    }
    return candidates[0] ?? null;
  }
}

export function createAdapterRegistry(adapters = []) {
  return new AdapterRegistry(adapters);
}

export function formatAdapterListing(adapters) {
  if (adapters.length === 0) return "Registered context adapters: none";
  return [
    "Registered context adapters",
    ...adapters.map((adapter) => (
      `- ${adapter.name} (${adapter.id}@${adapter.version})\n`
      + `  Formats: ${adapter.formats.map((format) => `${format.id}${format.versions?.length ? `@${format.versions.join(",")}` : " (unversioned)"}`).join("; ")}\n`
      + `  Capabilities: ${adapter.capabilities.join(", ")}`
    ))
  ].join("\n");
}
