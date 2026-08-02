import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse as parseYaml, parseDocument, stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { pathExists, resolvePackagePath } from "./files.js";
import { computeDirectoryDigest } from "./integrity.js";
import { readIntegrationDescriptor } from "./integrations.js";
import { validatePackage } from "./validate.js";

const localIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function claimMatchesModule(claim, module) {
  if (claim.id !== module.format) return false;
  if (claim.entrypoints?.length && !claim.entrypoints.includes(module.entrypoint)) return false;
  if (module.format_version) return (claim.versions ?? []).includes(module.format_version);
  return claim.unversioned === true;
}

function bridgeKey(integration, bridge) {
  return `${integration}/${bridge}`;
}

function explicitSelections(selections) {
  const result = new Map();
  for (const selection of selections ?? []) {
    if (!selection?.integration || !selection?.bridge) {
      throw new SeedSpecError("An integration bridge selection requires integration and bridge", {
        code: "INVALID_INTEGRATION_SELECTION"
      });
    }
    const key = `${bridgeKey(selection.integration, selection.bridge)}\0${selection.module ?? "*"}`;
    if (result.has(key)) {
      throw new SeedSpecError(`Integration bridge selection appears more than once: ${key}`, {
        code: "INVALID_INTEGRATION_SELECTION"
      });
    }
    result.set(key, selection);
  }
  return result;
}

function selectedFor(selections, integrationId, bridge, module) {
  const exact = `${bridgeKey(integrationId, bridge.id)}\0${module.id}`;
  if (selections.has(exact)) return { key: exact, selection: selections.get(exact) };
  const wildcard = `${bridgeKey(integrationId, bridge.id)}\0*`;
  if (selections.has(wildcard)) return { key: wildcard, selection: selections.get(wildcard) };
  return null;
}

function sameBinding(left, right) {
  return left.skill === right.skill
    && JSON.stringify(left.applies_to ?? null) === JSON.stringify(right.applies_to ?? null);
}

function moduleById(manifest, id) {
  return manifest.context.modules.find((module) => module.id === id) ?? null;
}

export async function planIntegrationBridges(packagePath, sources, {
  selections = [],
  includeDefaults = true
} = {}) {
  const record = await validatePackage(packagePath);
  const integrations = await Promise.all(sources.map(readIntegrationDescriptor));
  const integrationIds = new Set();
  for (const integration of integrations) {
    if (integrationIds.has(integration.descriptor.id)) {
      throw new SeedSpecError(`Integration source appears more than once: ${integration.descriptor.id}`, {
        code: "DUPLICATE_FORMAT_INTEGRATION"
      });
    }
    integrationIds.add(integration.descriptor.id);
  }
  const explicit = explicitSelections(selections);
  const matchedExplicit = new Set();
  const skills = new Map();
  const bindings = [];

  for (const integration of integrations.sort((left, right) => (
    left.descriptor.id.localeCompare(right.descriptor.id)
  ))) {
    for (const module of record.manifest.context.modules) {
      const formatClaim = integration.descriptor.formats.find((claim) => (
        claimMatchesModule(claim, module)
      ));
      if (!formatClaim) continue;
      for (const bridge of integration.descriptor.bridges ?? []) {
        if (!bridge.formats.includes(module.format)) continue;
        const selected = selectedFor(explicit, integration.descriptor.id, bridge, module);
        const selection = selected?.selection ?? null;
        if (selected) matchedExplicit.add(selected.key);
        if (!selection && (!includeDefaults || bridge.default !== true)) continue;
        if (!selection && (module.bridges ?? []).length > 0) continue;
        const skillId = selection?.skill_id ?? bridge.id;
        if (!localIdPattern.test(skillId)) {
          throw new SeedSpecError(`Integration bridge has an invalid Skill module ID: ${skillId}`, {
            code: "INVALID_INTEGRATION_SELECTION"
          });
        }
        const destination = `context/bridges/${integration.descriptor.id}/${bridge.id}/`;
        const existing = moduleById(record.manifest, skillId);
        const declaration = {
          id: skillId,
          format: "io.agentskills.skill",
          description: bridge.description,
          entrypoint: bridge.entrypoint,
          source: { kind: "package", path: destination },
          ...(bridge.applies_to ? { applies_to: bridge.applies_to } : {})
        };
        if (existing && JSON.stringify(existing) !== JSON.stringify(declaration)) {
          throw new SeedSpecError(`Bridge Skill module ID collides with an existing module: ${skillId}`, {
            code: "INTEGRATION_BRIDGE_COLLISION",
            details: [integration.descriptor.id, bridge.id]
          });
        }

        const skillKey = `${integration.descriptor.id}\0${bridge.id}\0${skillId}`;
        if (!skills.has(skillKey)) {
          skills.set(skillKey, {
            integration: integration.descriptor.id,
            bridge: bridge.id,
            skill: skillId,
            source: path.join(integration.root, ...bridge.path.split("/")),
            destination,
            digest: bridge.digest,
            declaration,
            install: !existing
          });
        }
        const binding = {
          target: module.id,
          skill: skillId,
          ...(bridge.applies_to ? { applies_to: bridge.applies_to } : {}),
          description: bridge.description
        };
        if (!(module.bridges ?? []).some((candidate) => sameBinding(candidate, binding))) {
          bindings.push({ integration: integration.descriptor.id, bridge: bridge.id, ...binding });
        }
      }
    }
  }

  for (const [key, selection] of explicit.entries()) {
    if (!matchedExplicit.has(key)) {
      throw new SeedSpecError(
        `Selected integration bridge is not compatible with the package: ${selection.integration}/${selection.bridge}`,
        { code: "INVALID_INTEGRATION_SELECTION" }
      );
    }
  }

  const skillIds = new Map();
  for (const skill of skills.values()) {
    const previous = skillIds.get(skill.skill);
    if (previous && (
      previous.integration !== skill.integration
      || previous.bridge !== skill.bridge
    )) {
      throw new SeedSpecError(`More than one integration proposes Skill module ${skill.skill}`, {
        code: "INTEGRATION_BRIDGE_COLLISION",
        details: [
          `${previous.integration}/${previous.bridge}`,
          `${skill.integration}/${skill.bridge}`,
          "Select a distinct skill_id for one bridge."
        ]
      });
    }
    skillIds.set(skill.skill, skill);
  }

  return {
    integration_plan_version: "1",
    package: {
      path: record.root,
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    integrations: integrations.map((integration) => ({
      id: integration.descriptor.id,
      version: integration.descriptor.version,
      descriptor: integration.path,
      digest: integration.digest
    })),
    skills: [...skills.values()],
    bindings
  };
}

async function verifyPlanDestinations(root, plan) {
  for (const skill of plan.skills) {
    if (!skill.install) continue;
    const destination = resolvePackagePath(root, skill.destination);
    const existing = await pathExists(destination);
    if (!existing) continue;
    if (existing.isDirectory() && await computeDirectoryDigest(destination) === skill.digest) {
      skill.install = false;
      continue;
    }
    throw new SeedSpecError(`Bridge destination already exists with different bytes: ${skill.destination}`, {
      code: "INTEGRATION_BRIDGE_COLLISION"
    });
  }
}

function mutateManifestDocument(document, manifest, plan) {
  for (const skill of plan.skills) {
    if (!moduleById(manifest, skill.skill)) {
      document.addIn(["context", "modules"], skill.declaration);
      manifest.context.modules.push(skill.declaration);
    }
  }
  for (const binding of plan.bindings) {
    const moduleIndex = manifest.context.modules.findIndex((module) => module.id === binding.target);
    const value = {
      skill: binding.skill,
      ...(binding.applies_to ? { applies_to: binding.applies_to } : {}),
      description: binding.description
    };
    const current = manifest.context.modules[moduleIndex].bridges ?? [];
    if (current.some((candidate) => sameBinding(candidate, value))) continue;
    if (current.length === 0) document.setIn(["context", "modules", moduleIndex, "bridges"], [value]);
    else document.addIn(["context", "modules", moduleIndex, "bridges"], value);
    manifest.context.modules[moduleIndex].bridges = [...current, value];
  }
}

async function recordApplication(stateRoot, application) {
  if (!stateRoot) return;
  const absolute = path.resolve(stateRoot);
  const target = path.join(absolute, "integrations.yaml");
  let existing = { integration_application_version: "1", applications: [] };
  if ((await pathExists(target))?.isFile()) {
    existing = parseYaml(await readFile(target, "utf8"));
  }
  existing.applications ??= [];
  existing.applications.push(application);
  await mkdir(absolute, { recursive: true });
  await writeFile(target, stringifyYaml(existing), "utf8");
}

export async function applyIntegrationBridgePlan(plan, {
  stateRoot = null
} = {}) {
  if (plan?.integration_plan_version !== "1") {
    throw new SeedSpecError("Unsupported integration bridge plan", {
      code: "INVALID_INTEGRATION_PLAN"
    });
  }
  const record = await validatePackage(plan.package.path);
  if (
    record.manifest.id !== plan.package.id
    || record.manifest.version !== plan.package.version
    || record.digest !== plan.package.digest
  ) {
    throw new SeedSpecError("The package changed after integration planning", {
      code: "STALE_INTEGRATION_PLAN",
      details: [`planned ${plan.package.digest}`, `current ${record.digest}`]
    });
  }
  await verifyPlanDestinations(record.root, plan);
  const manifestPath = path.join(record.root, "seedspec.yaml");
  const original = await readFile(manifestPath, "utf8");
  const document = parseDocument(original);
  const manifest = document.toJS();
  mutateManifestDocument(document, manifest, plan);

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "seedspec-integration-"));
  const installed = [];
  const temporaryManifest = `${manifestPath}.integration-${randomUUID()}`;
  let manifestReplaced = false;
  try {
    for (const [index, skill] of plan.skills.entries()) {
      if (!skill.install) continue;
      const staged = path.join(temporaryRoot, String(index));
      await cp(skill.source, staged, { recursive: true });
      if (await computeDirectoryDigest(staged) !== skill.digest) {
        throw new SeedSpecError(`Integration bridge bytes changed after discovery: ${skill.bridge}`, {
          code: "INTEGRATION_BRIDGE_DIGEST_MISMATCH"
        });
      }
      const destination = resolvePackagePath(record.root, skill.destination);
      await mkdir(path.dirname(destination), { recursive: true });
      await rename(staged, destination);
      installed.push(destination);
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
    await recordApplication(stateRoot, {
      applied_at: new Date().toISOString(),
      package: updated.manifest.id,
      before_digest: record.digest,
      after_digest: updated.digest,
      integrations: plan.integrations.map(({ id, version, digest }) => ({ id, version, digest })),
      skills: plan.skills.map(({ integration, bridge, skill, digest }) => ({
        integration,
        bridge,
        skill,
        digest
      })),
      bindings: plan.bindings.map(({ target, skill }) => ({ target, skill }))
    });
    return { package: updated.manifest.id, digest: updated.digest, plan };
  } catch (error) {
    await rm(temporaryManifest, { force: true });
    if (manifestReplaced) await writeFile(manifestPath, original, "utf8");
    for (const destination of installed.reverse()) {
      await rm(destination, { recursive: true, force: true });
    }
    throw error;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export function formatIntegrationBridgePlan(plan) {
  const lines = [
    `Integration bridge plan for ${plan.package.id}@${plan.package.version}`,
    `Bridge Skills: ${plan.skills.length}`,
    `Module bindings: ${plan.bindings.length}`
  ];
  for (const skill of plan.skills) {
    lines.push(`- ${skill.integration}/${skill.bridge} -> ${skill.skill} (${skill.destination})`);
  }
  for (const binding of plan.bindings) {
    lines.push(`- bind ${binding.target} -> ${binding.skill}`);
  }
  return lines.join("\n");
}
