import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { resolvePackageLocation } from "./files.js";
import { computePackageDigest } from "./integrity.js";
import {
  assertFile,
  collectSuccessAnchors,
  expandManifestSections,
  loadAuthoredManifest
} from "./manifest.js";
import {
  compileProtocolSchema,
  formatSchemaErrors
} from "./schema.js";

function assertUnique(items, label, id = (item) => item.id) {
  const seen = new Set();
  for (const item of items ?? []) {
    const value = id(item);
    if (seen.has(value)) {
      throw new SeedSpecError(`${label} ID appears more than once: ${value}`, {
        code: "DUPLICATE_ID"
      });
    }
    seen.add(value);
  }
  return seen;
}

function assertReferences(items, known, field, label) {
  for (const item of items ?? []) {
    for (const reference of item[field] ?? []) {
      if (!known.has(reference)) {
        throw new SeedSpecError(`${label} ${item.id} references unknown ${field}: ${reference}`, {
          code: "INVALID_CROSS_REFERENCE"
        });
      }
    }
  }
}

function assertSectionIds(manifest) {
  const sections = [
    ["configuration", manifest.configuration?.sections],
    ["success", manifest.success?.sections],
    ["tasks", manifest.tasks?.sections],
    ["capabilities", manifest.capabilities?.sections]
  ];
  for (const [label, items] of sections) assertUnique(items, `${label} section`);
}

function matchesConfigurationType(value, type, itemType) {
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "array") {
    return Array.isArray(value)
      && value.every((item) => matchesConfigurationType(item, itemType));
  }
  return typeof value === type;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateConfigurationVariables(variables) {
  for (const variable of variables) {
    const itemType = variable.items?.type;
    for (const field of ["default", "example"]) {
      if (!Object.hasOwn(variable, field)) continue;
      if (!matchesConfigurationType(variable[field], variable.type, itemType)) {
        throw new SeedSpecError(
          `Configuration ${field} for ${variable.id} does not match type ${variable.type}`,
          { code: "INVALID_CONFIGURATION_VALUE" }
        );
      }
    }
    for (const option of variable.options ?? []) {
      if (!matchesConfigurationType(option, variable.type, itemType)) {
        throw new SeedSpecError(
          `Configuration option for ${variable.id} does not match type ${variable.type}`,
          { code: "INVALID_CONFIGURATION_VALUE" }
        );
      }
    }
    if (
      Object.hasOwn(variable, "default")
      && variable.options
      && !variable.options.some((option) => sameValue(option, variable.default))
    ) {
      throw new SeedSpecError(
        `Configuration default for ${variable.id} is not one of its options`,
        { code: "INVALID_CONFIGURATION_VALUE" }
      );
    }
  }
}

function validateSemanticReferences(manifest, anchors) {
  const variables = manifest.configuration?.variables ?? [];
  const criteria = manifest.success?.criteria ?? [];
  const tasks = manifest.tasks?.items ?? [];
  const capabilities = manifest.capabilities?.items ?? [];
  const modules = manifest.context_modules ?? [];

  assertUnique(variables, "Configuration variable");
  const criterionIds = assertUnique(criteria, "Success criterion");
  assertUnique(tasks, "Task");
  const capabilityIds = assertUnique(capabilities, "Capability");
  assertUnique(modules, "Context module");
  assertUnique(manifest.bundled_packages, "Bundled package", (item) => item.id);

  validateConfigurationVariables(variables);

  for (const capability of capabilities) {
    assertUnique(capability.outcomes, `Outcome in capability ${capability.id}`);
  }
  assertReferences(tasks, capabilityIds, "capabilities", "Task");
  assertReferences(tasks, criterionIds, "success_criteria", "Task");
  assertReferences(capabilities, criterionIds, "success_criteria", "Capability");
  for (const module of modules) {
    for (const capability of module.applies_to?.capabilities ?? []) {
      if (!capabilityIds.has(capability)) {
        throw new SeedSpecError(
          `Context module ${module.id} applies to unknown capability: ${capability}`,
          { code: "INVALID_CROSS_REFERENCE" }
        );
      }
    }
    for (const criterion of module.applies_to?.success_criteria ?? []) {
      if (!criterionIds.has(criterion)) {
        throw new SeedSpecError(
          `Context module ${module.id} applies to unknown success criterion: ${criterion}`,
          { code: "INVALID_CROSS_REFERENCE" }
        );
      }
    }
  }
  for (const anchor of anchors) {
    if (!criterionIds.has(anchor.id)) {
      throw new SeedSpecError(
        `SPEC.md contains an anchor for unknown success criterion: ${anchor.id}`,
        {
          code: "INVALID_SUCCESS_ANCHOR",
          details: [`Line ${anchor.line}, column ${anchor.column}`]
        }
      );
    }
  }
}

async function validateLocalReferences(root, manifest) {
  for (const module of manifest.context_modules ?? []) {
    await assertFile(root, module.path, {
      directory: "context-modules",
      label: `Context module ${module.id}`
    });
    if (path.extname(module.path).toLowerCase() !== ".md") {
      throw new SeedSpecError(`Context module entrypoint must be Markdown: ${module.path}`, {
        code: "INVALID_CONTEXT_MODULE_PATH"
      });
    }
    if (module.type === "skill" && path.basename(module.path) !== "SKILL.md") {
      throw new SeedSpecError(`Skill context module must use SKILL.md: ${module.path}`, {
        code: "INVALID_CONTEXT_MODULE_PATH"
      });
    }
    if (
      module.type === "implementation-profile"
      && path.basename(module.path) !== "PROFILE.md"
    ) {
      throw new SeedSpecError(
        `Implementation profile context module must use PROFILE.md: ${module.path}`,
        { code: "INVALID_CONTEXT_MODULE_PATH" }
      );
    }
    if (module.format?.path) {
      await assertFile(root, module.format.path, {
        directory: "formats",
        label: `Format documentation for ${module.id}`
      });
    }
  }
}

function bundledRoot(root, declaration) {
  const canonical = declaration.path.split(path.sep).join("/");
  if (!canonical.startsWith("bundled-packages/") || !canonical.endsWith("/SPEC.md")) {
    throw new SeedSpecError(
      `Bundled package path must be bundled-packages/<package>/SPEC.md: ${declaration.path}`,
      { code: "INVALID_BUNDLED_PACKAGE_PATH" }
    );
  }
  return path.dirname(path.resolve(root, declaration.path));
}

function assertIdentity(record, packages) {
  const existing = packages.get(record.manifest.id);
  if (!existing) {
    packages.set(record.manifest.id, record);
    return;
  }
  if (
    existing.manifest.version !== record.manifest.version
    || existing.digest !== record.digest
  ) {
    throw new SeedSpecError(
      `Bundled packages contain conflicting identities for ${record.manifest.id}`,
      {
        code: "COMPOSITION_IDENTITY_COLLISION",
        details: [
          `${existing.manifest.version} ${existing.digest} at ${existing.root}`,
          `${record.manifest.version} ${record.digest} at ${record.root}`
        ]
      }
    );
  }
}

async function validatePackageTree(inputPath, state) {
  const { root, specPath, manifestPath } = await resolvePackageLocation(inputPath);
  const canonicalRoot = path.resolve(root);
  if (state.active.has(canonicalRoot)) {
    throw new SeedSpecError(`Bundled package cycle reaches ${canonicalRoot}`, {
      code: "BUNDLED_PACKAGE_CYCLE"
    });
  }
  state.active.add(canonicalRoot);
  try {
    const authored = await loadAuthoredManifest(root, specPath, manifestPath);
    const validateManifest = await compileProtocolSchema("seedspec.schema.json");
    if (!validateManifest(authored.manifest)) {
      throw new SeedSpecError(`Invalid SeedSpec manifest: ${root}`, {
        code: "INVALID_MANIFEST",
        details: formatSchemaErrors(validateManifest.errors)
      });
    }
    if (!authored.body.trim()) {
      throw new SeedSpecError(`SPEC.md must contain specification prose: ${specPath}`, {
        code: "EMPTY_SPEC"
      });
    }
    assertSectionIds(authored.manifest);
    const expanded = await expandManifestSections(
      root,
      authored.manifest,
      authored.provenance.sources,
      specPath
    );
    if (!validateManifest(expanded.manifest)) {
      throw new SeedSpecError(`Expanded SeedSpec manifest is invalid: ${root}`, {
        code: "INVALID_EXPANDED_MANIFEST",
        details: formatSchemaErrors(validateManifest.errors)
      });
    }
    const successAnchors = collectSuccessAnchors(authored.body);
    validateSemanticReferences(expanded.manifest, successAnchors);
    await validateLocalReferences(root, expanded.manifest);

    const bundledPackages = [];
    for (const declaration of expanded.manifest.bundled_packages ?? []) {
      const child = await validatePackageTree(bundledRoot(root, declaration), state);
      const mismatches = [
        child.manifest.id === declaration.id
          ? null
          : `id: declared ${declaration.id}; bundled ${child.manifest.id}`,
        child.manifest.version === declaration.version
          ? null
          : `version: declared ${declaration.version}; bundled ${child.manifest.version}`,
        child.digest === declaration.digest
          ? null
          : `digest: declared ${declaration.digest}; bundled ${child.digest}`
      ].filter(Boolean);
      if (mismatches.length > 0) {
        throw new SeedSpecError(`Bundled package identity does not match ${declaration.id}`, {
          code: "BUNDLED_PACKAGE_IDENTITY_MISMATCH",
          details: mismatches
        });
      }
      bundledPackages.push({ declaration, record: child });
    }

    const digest = await computePackageDigest(root);
    const record = {
      root,
      specPath,
      manifestPath,
      manifest: expanded.manifest,
      authoredManifest: authored.manifest,
      definitionPath: specPath,
      definition: authored.body,
      digest,
      provenance: {
        ...authored.provenance,
        sections: expanded.sections,
        success_anchors: successAnchors
      },
      bundledPackages
    };
    assertIdentity(record, state.packages);
    return record;
  } finally {
    state.active.delete(canonicalRoot);
  }
}

export async function validatePackage(inputPath) {
  return validatePackageTree(inputPath, {
    active: new Set(),
    packages: new Map()
  });
}
