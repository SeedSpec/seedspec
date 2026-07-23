import { readFile } from "node:fs/promises";
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
import { validateTaskRunbook } from "./tasks.js";
import {
  compileConfigurationSchema,
  compileProtocolSchema,
  formatSchemaErrors
} from "./schema.js";

export async function validatePackage(inputPath, { configurationPath } = {}) {
  const { root, manifestPath } = await resolvePackageLocation(inputPath);
  const manifest = await readYamlFile(manifestPath, "SeedSpec manifest");
  if (manifest?.protocol_version !== "0.1") {
    throw new SeedSpecError(`Unsupported SeedSpec Protocol version: ${manifest?.protocol_version ?? "missing"}`, {
      code: "UNSUPPORTED_PROTOCOL_VERSION",
      details: ["This runtime supports protocol_version 0.1"]
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
    ["definition.entrypoint", manifest.definition.entrypoint, "file"],
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

  const taskRunbook = await validateTaskRunbook(root, manifest);

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

  const definitionPath = resolvePackagePath(root, manifest.definition.entrypoint);
  const definition = await readFile(definitionPath, "utf8");
  const digest = await computePackageDigest(root);

  return {
    root,
    manifestPath,
    manifest,
    definitionPath,
    definition,
    digest,
    taskRunbook,
    configurationSchema,
    exampleConfiguration: configurationPath
      ? await readYamlFile(resolvePackagePath(root, manifest.configuration.example), "Example configuration")
      : configuration
  };
}
