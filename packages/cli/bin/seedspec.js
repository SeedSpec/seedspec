#!/usr/bin/env node

import process from "node:process";
import {
  discoverFeatures,
  formatError,
  formatAdapterListing,
  formatArtifactListing,
  formatArtifactValidation,
  formatConformanceResult,
  formatFeatureDiscovery,
  formatInspection,
  initPackage,
  inspectPackage,
  listArtifactAdapters,
  listPackageArtifacts,
  resolveProject,
  runConformanceSuite,
  verifyProjectLock,
  validateArtifact,
  validatePackage
} from "@seedspec/runtime";

const HELP = `SeedSpec CLI v0.1 alpha

Usage:
  seedspec validate <path>
  seedspec digest <path>
  seedspec inspect <path> [--json]
  seedspec artifacts <path> [--json]
  seedspec adapters [--json]
  seedspec validate-artifact <path> <artifact-id> [--json]
  seedspec discover-features <application-path> --catalog <path> [--catalog <path>] [--json]
  seedspec conformance [cases.yaml]
  seedspec verify-lock <project-path> --package <package-path> [--package <package-path>]
  seedspec resolve <application-path> [options]
  seedspec init <application|feature> [--output <path>]

Resolve options:
  --feature <path>                 Add a SeedSpec feature package (repeatable)
  --output <path>                  Project directory; defaults to the current directory
  --config <yaml>                  Partial application configuration override
  --feature-config <id>=<yaml>     Partial feature configuration override (repeatable)
  --technical-preferences <yaml>   Record implementation preferences separately
  --decisions <yaml>               Answer package-declared product decisions
`;

function parseArguments(args) {
  const positional = [];
  const options = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }

    if (value === "--json" || value === "--help") {
      options.set(value.slice(2), [true]);
      continue;
    }

    const optionValue = args[index + 1];
    if (!optionValue || optionValue.startsWith("--")) {
      throw new Error(`Option ${value} requires a value`);
    }
    index += 1;
    const name = value.slice(2);
    options.set(name, [...(options.get(name) ?? []), optionValue]);
  }

  return { positional, options };
}

function oneOption(options, name) {
  const values = options.get(name) ?? [];
  if (values.length > 1) throw new Error(`Option --${name} may be supplied only once`);
  return values[0];
}

function requirePositional(positional, index, label) {
  if (!positional[index]) throw new Error(`Missing ${label}`);
  return positional[index];
}

async function run() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(HELP);
    return;
  }

  const { positional, options } = parseArguments(rest);
  if (options.has("help")) {
    process.stdout.write(HELP);
    return;
  }

  switch (command) {
    case "validate": {
      const packagePath = requirePositional(positional, 0, "package path");
      const record = await validatePackage(packagePath);
      process.stdout.write(`Valid SeedSpec ${record.manifest.kind} package: ${record.manifest.id}@${record.manifest.version}\nDigest: ${record.digest}\n`);
      break;
    }
    case "digest": {
      const packagePath = requirePositional(positional, 0, "package path");
      const record = await validatePackage(packagePath);
      process.stdout.write(`${record.digest}\n`);
      break;
    }
    case "inspect": {
      const packagePath = requirePositional(positional, 0, "package path");
      const inspection = await inspectPackage(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(inspection, null, 2)}\n`
        : `${formatInspection(inspection)}\n`);
      break;
    }
    case "artifacts": {
      const packagePath = requirePositional(positional, 0, "package path");
      const listing = await listPackageArtifacts(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(listing, null, 2)}\n`
        : `${formatArtifactListing(listing)}\n`);
      break;
    }
    case "adapters": {
      const adapterList = listArtifactAdapters();
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(adapterList, null, 2)}\n`
        : `${formatAdapterListing(adapterList)}\n`);
      break;
    }
    case "validate-artifact": {
      const packagePath = requirePositional(positional, 0, "package path");
      const artifactId = requirePositional(positional, 1, "artifact ID");
      const result = await validateArtifact(packagePath, artifactId);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatArtifactValidation(result)}\n`);
      break;
    }
    case "discover-features": {
      const applicationPath = requirePositional(positional, 0, "application package path");
      const result = await discoverFeatures(applicationPath, options.get("catalog") ?? []);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatFeatureDiscovery(result)}\n`);
      break;
    }
    case "resolve": {
      const applicationPath = requirePositional(positional, 0, "application package path");
      const featureConfigurationPaths = {};
      for (const value of options.get("feature-config") ?? []) {
        const separator = value.indexOf("=");
        if (separator <= 0 || separator === value.length - 1) {
          throw new Error("--feature-config must use <package-id>=<yaml-path>");
        }
        const id = value.slice(0, separator);
        if (featureConfigurationPaths[id]) {
          throw new Error(`Feature configuration supplied more than once: ${id}`);
        }
        featureConfigurationPaths[id] = value.slice(separator + 1);
      }

      const result = await resolveProject(applicationPath, {
        featurePaths: options.get("feature") ?? [],
        outputDirectory: oneOption(options, "output"),
        applicationConfigurationPath: oneOption(options, "config"),
        featureConfigurationPaths,
        technicalPreferencesPath: oneOption(options, "technical-preferences"),
        decisionsPath: oneOption(options, "decisions")
      });
      process.stdout.write(`Resolved ${result.project.application.id} with ${result.features.length} feature(s)\nWorkspace: ${result.workspace}\n`);
      break;
    }
    case "init": {
      const kind = requirePositional(positional, 0, "package kind");
      const output = oneOption(options, "output") ?? `${kind}-package`;
      const result = await initPackage(kind, output);
      process.stdout.write(`Created valid SeedSpec ${kind} package: ${result.root}\n`);
      break;
    }
    case "conformance": {
      const indexPath = positional[0] ?? "conformance/cases.yaml";
      const result = await runConformanceSuite(indexPath);
      process.stdout.write(`${formatConformanceResult(result)}\n`);
      if (result.failed > 0) process.exitCode = 1;
      break;
    }
    case "verify-lock": {
      const projectPath = requirePositional(positional, 0, "project path");
      const result = await verifyProjectLock(projectPath, options.get("package") ?? []);
      process.stdout.write(`Verified ${result.verifiedPackages.length} package(s) and ${result.verifiedCapabilities.length} capability provider(s)\n`);
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

run().catch((error) => {
  process.stderr.write(`Error: ${formatError(error)}\n`);
  process.exitCode = 1;
});
