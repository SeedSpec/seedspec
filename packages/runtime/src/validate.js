import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  pathExists,
  readJsonFile,
  readYamlFile,
  resolvePackageLocation,
  resolvePackagePath
} from "./files.js";
import { SeedSpecError } from "./errors.js";
import { validateManifestSemantics } from "./capabilities.js";
import { validateCapabilityConformanceDeclarations } from "./capability-conformance.js";
import { computePackageDigest } from "./integrity.js";
import { validateImplementationResourceDeclarations } from "./resources.js";
import {
  localContextModule,
  primaryContextModule,
  validateContextDeclarations
} from "./context.js";
import { validateTaskRunbook } from "./tasks.js";
import {
  compileConfigurationSchema,
  compileProtocolSchema,
  formatSchemaErrors
} from "./schema.js";
import { protocolVersion } from "@seedspec/protocol";

function isWithin(parent, candidate) {
  const relation = path.relative(parent, candidate);
  return relation === "" || (
    relation !== ".."
    && !relation.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relation)
  );
}

function assertPackageIdentity(record, packages) {
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
      `Bundled composition contains conflicting identities for ${record.manifest.id}`,
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

async function validateComposition(root, manifest, packages) {
  const declarations = manifest.composition?.includes ?? [];
  if (declarations.length === 0) return { includes: [] };

  const integrationSource = manifest.components?.integration;
  if (!integrationSource) {
    throw new SeedSpecError(
      `SeedSpec package declares composition without components.integration: ${manifest.id}`,
      {
        code: "INVALID_COMPOSITION",
        details: [
          "Declare the semantic integration material, then point every composition edge to a Markdown file within it."
        ]
      }
    );
  }

  const integrationRoot = resolvePackagePath(root, integrationSource);
  const integrationRootInfo = await pathExists(integrationRoot);
  const edgeIds = new Set();
  const includes = [];

  for (const declaration of declarations) {
    if (edgeIds.has(declaration.id)) {
      throw new SeedSpecError(
        `Composition edge appears more than once in ${manifest.id}: ${declaration.id}`,
        { code: "INVALID_COMPOSITION" }
      );
    }
    edgeIds.add(declaration.id);

    const childRoot = resolvePackagePath(root, declaration.path);
    const childInfo = await pathExists(childRoot);
    if (!childInfo?.isDirectory()) {
      throw new SeedSpecError(
        `Composition child must reference a bundled package directory: ${declaration.path}`,
        { code: "INVALID_COMPOSITION" }
      );
    }

    const integrationPath = resolvePackagePath(root, declaration.integration);
    const integrationInfo = await pathExists(integrationPath);
    if (!integrationInfo?.isFile() || path.extname(integrationPath).toLowerCase() !== ".md") {
      throw new SeedSpecError(
        `Composition integration must reference a Markdown file: ${declaration.integration}`,
        { code: "INVALID_COMPOSITION" }
      );
    }
    const integrationIsDeclared = integrationRootInfo?.isDirectory()
      ? isWithin(integrationRoot, integrationPath)
      : integrationRoot === integrationPath;
    if (!integrationIsDeclared) {
      throw new SeedSpecError(
        `Composition integration is outside components.integration: ${declaration.integration}`,
        {
          code: "INVALID_COMPOSITION",
          details: [`components.integration: ${integrationSource}`]
        }
      );
    }

    const child = await validatePackageTree(childRoot, {}, packages);
    const mismatches = [
      child.manifest.id === declaration.package
        ? null
        : `package: declared ${declaration.package}; bundled ${child.manifest.id}`,
      child.manifest.version === declaration.version
        ? null
        : `version: declared ${declaration.version}; bundled ${child.manifest.version}`,
      child.digest === declaration.digest
        ? null
        : `digest: declared ${declaration.digest}; bundled ${child.digest}`
    ].filter(Boolean);
    if (mismatches.length > 0) {
      throw new SeedSpecError(
        `Bundled composition identity does not match ${manifest.id}/${declaration.id}`,
        {
          code: "COMPOSITION_IDENTITY_MISMATCH",
          details: mismatches
        }
      );
    }

    includes.push({
      ...declaration,
      record: child
    });
  }

  return { includes };
}

async function validatePackageTree(inputPath, { configurationPath } = {}, packages) {
  const { root, manifestPath } = await resolvePackageLocation(inputPath);
  const manifest = await readYamlFile(manifestPath, "SeedSpec manifest");
  if (manifest?.protocol_version !== protocolVersion) {
    throw new SeedSpecError(`Unsupported SeedSpec Protocol version: ${manifest?.protocol_version ?? "missing"}`, {
      code: "UNSUPPORTED_PROTOCOL_VERSION",
      details: [`This runtime supports protocol_version ${protocolVersion}`]
    });
  }
  const validateManifest = await compileProtocolSchema("seedspec.schema.json");

  if (!validateManifest(manifest)) {
    throw new SeedSpecError(`Invalid SeedSpec manifest: ${manifestPath}`, {
      code: "INVALID_MANIFEST",
      details: formatSchemaErrors(validateManifest.errors)
    });
  }
  validateManifestSemantics(manifest);

  const referenceErrors = [];
  const expectedFiles = [
    ["configuration.schema", manifest.configuration.schema, "file"],
    ["configuration.example", manifest.configuration.example, "file"]
  ];

  if (manifest.configuration.guide) {
    expectedFiles.push(["configuration.guide", manifest.configuration.guide, "file"]);
  }
  if (manifest.tasks) {
    expectedFiles.push(["tasks", manifest.tasks, "file"]);
  }
  for (const profile of manifest.implementation_profiles ?? []) {
    if (profile.guidance) {
      expectedFiles.push([
        `implementation_profiles.${profile.id}.guidance`,
        profile.guidance,
        "file"
      ]);
    }
  }
  for (const capability of manifest.provides.capabilities) {
    expectedFiles.push([
      `provides.capabilities.${capability.id}.contract`,
      capability.contract,
      "file"
    ]);
  }

  for (const [name, relativePath, expectedType] of expectedFiles) {
    const fullPath = resolvePackagePath(root, relativePath);
    const info = await pathExists(fullPath);
    if (!info) {
      referenceErrors.push(`${name} does not exist: ${relativePath}`);
    } else if (expectedType === "file" && !info.isFile()) {
      referenceErrors.push(`${name} must reference a file: ${relativePath}`);
    }
  }

  for (const [name, relativePath] of Object.entries(manifest.components ?? {})) {
    const info = await pathExists(resolvePackagePath(root, relativePath));
    if (!info) referenceErrors.push(`components.${name} does not exist: ${relativePath}`);
  }

  for (const artifact of manifest.artifacts ?? []) {
    if (!artifact.path) continue;
    const info = await pathExists(resolvePackagePath(root, artifact.path));
    if (!info) referenceErrors.push(`artifacts.${artifact.id}.path does not exist: ${artifact.path}`);
  }

  if (referenceErrors.length > 0) {
    throw new SeedSpecError(`SeedSpec package has invalid references: ${manifest.id}`, {
      code: "INVALID_REFERENCES",
      details: referenceErrors
    });
  }

  await validateCapabilityConformanceDeclarations(root, manifest);

  await validateImplementationResourceDeclarations(root, manifest);

  await validateContextDeclarations(root, manifest);

  const taskRunbook = await validateTaskRunbook(root, manifest);
  const composition = await validateComposition(root, manifest, packages);

  const configurationSchemaPath = resolvePackagePath(root, manifest.configuration.schema);
  const configurationSchema = await readJsonFile(configurationSchemaPath, "Configuration schema");
  let validateConfiguration;

  try {
    validateConfiguration = compileConfigurationSchema(configurationSchema);
  } catch (error) {
    throw new SeedSpecError(`Configuration schema cannot be compiled: ${manifest.configuration.schema}`, {
      code: "INVALID_CONFIGURATION_SCHEMA",
      details: [error.message]
    });
  }

  const selectedConfigurationPath = configurationPath
    ? configurationPath
    : resolvePackagePath(root, manifest.configuration.example);
  const configuration = await readYamlFile(
    selectedConfigurationPath,
    configurationPath ? "Selected configuration" : "Example configuration"
  );

  if (configuration === null || typeof configuration !== "object" || Array.isArray(configuration)) {
    throw new SeedSpecError(`Configuration must be a YAML mapping for ${manifest.id}`, {
      code: "INVALID_CONFIGURATION"
    });
  }

  if (!validateConfiguration(configuration)) {
    throw new SeedSpecError(`Configuration is invalid for ${manifest.id}: ${selectedConfigurationPath}`, {
      code: "INVALID_CONFIGURATION",
      details: formatSchemaErrors(validateConfiguration.errors)
    });
  }

  const primaryModule = primaryContextModule(manifest);
  const primarySource = await localContextModule(root, manifest, primaryModule);
  const definitionPath = primarySource.entrypoint;
  const definition = await readFile(definitionPath, "utf8");
  const digest = await computePackageDigest(root);

  const record = {
    root,
    manifestPath,
    manifest,
    definitionPath,
    definition,
    digest,
    composition,
    taskRunbook,
    configurationSchema,
    exampleConfiguration: configurationPath
      ? await readYamlFile(resolvePackagePath(root, manifest.configuration.example), "Example configuration")
      : configuration
  };
  assertPackageIdentity(record, packages);
  return record;
}

export async function validatePackage(inputPath, options = {}) {
  return validatePackageTree(inputPath, options, new Map());
}
