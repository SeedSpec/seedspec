#!/usr/bin/env node

import { readFileSync } from "node:fs";
import process from "node:process";
import {
  auditPackage,
  beginPackage,
  computeDirectoryDigest,
  discoverFeatures,
  formatError,
  formatAdapterListing,
  formatArtifactListing,
  formatArtifactValidation,
  formatAuthoringAudit,
  formatAuthoringDocumentation,
  formatConformanceResult,
  formatFeatureDiscovery,
  formatBuyerAgentPrompt,
  formatInspection,
  formatPackageLint,
  formatPackageBeginning,
  formatImplementationResourceListing,
  formatImplementationResourceResolution,
  formatProjectCompletion,
  initPackage,
  inspectPackage,
  lintPackage,
  inspectProjectCompletion,
  listArtifactAdapters,
  listPackageArtifacts,
  listPackageImplementationResources,
  recordImplementationResourceUse,
  resolveImplementationResources,
  resolveProject,
  runConformanceSuite,
  verifyProjectLock,
  validateArtifact,
  validatePackage
} from "@seedspec/runtime";

const CLI_VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const HELP = `SeedSpec CLI v0.1 alpha

Usage:
  seedspec audit <package-path> [--area <area>] [--target <depth>] [--state <directory>] [--status] [--json]
  seedspec docs authoring [area]
  seedspec prompt
  seedspec begin <root-package-path> [--json]
  seedspec validate <path>
  seedspec digest <path>
  seedspec inspect <path> [--json]
  seedspec lint <path> [--json]
  seedspec artifacts <path> [--json]
  seedspec resources <path> [--json]
  seedspec resolve-resources <project-path> [--json]
  seedspec record-resource-use <project-path> <package-id> <resource-id> <loaded|skipped> [--reason <text>] [--json]
  seedspec resource-digest <directory>
  seedspec adapters [--json]
  seedspec validate-artifact <path> <artifact-id> [--json]
  seedspec discover-features <root-package-path> --catalog <path> [--catalog <path>] [--json]
  seedspec conformance [cases.yaml]
  seedspec verify-lock <project-path> --package <package-path> [--package <package-path>]
  seedspec completion <project-path> [--json]
  seedspec resolve <root-package-path> [options]
  seedspec init <solution|application|feature|workflow|automation|configuration|integration> [--output <path>]

Resolve options:
  --add <path>                     Add another SeedSpec package (repeatable)
  --feature <path>                 Compatibility alias for --add
  -i, --implementation <profile>   Prefer an implementation profile; repeatable, package/profile for additions
  --output <path>                  Project directory; defaults to the current directory
  --configuration-selections <yaml>  Select example or complete custom configuration per package
  --completion-scope <yaml>         Record the implementation completion scope
  --technical-preferences <yaml>   Record implementation preferences separately
  --artifact-selections <yaml>     Record selected, declined, or deferred artifacts
  --decisions <yaml>               Answer package-declared product decisions
`;

function parseArguments(args) {
  const positional = [];
  const options = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "-i") {
      const optionValue = args[index + 1];
      if (!optionValue || optionValue.startsWith("-")) {
        throw new Error("Option -i requires a value");
      }
      index += 1;
      options.set("implementation", [...(options.get("implementation") ?? []), optionValue]);
      continue;
    }
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }

    if (value === "--json" || value === "--help" || value === "--status") {
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

function rejectUnknownOptions(options, allowed) {
  const allowedNames = new Set(allowed);
  const unknown = [...options.keys()].filter((name) => !allowedNames.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown option --${unknown[0]}`);
  }
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
    case "audit": {
      rejectUnknownOptions(options, ["area", "target", "state", "status", "json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const statusOnly = options.has("status");
      const result = await auditPackage(packagePath, {
        area: oneOption(options, "area"),
        target: oneOption(options, "target"),
        stateDirectory: oneOption(options, "state"),
        toolVersion: CLI_VERSION,
        statusOnly
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatAuthoringAudit(result, { statusOnly })}\n`);
      break;
    }
    case "docs": {
      rejectUnknownOptions(options, []);
      const topic = positional[0] ?? "authoring";
      if (topic !== "authoring") throw new Error(`Unknown documentation topic: ${topic}`);
      process.stdout.write(`SeedSpec CLI: ${CLI_VERSION}\n${formatAuthoringDocumentation(positional[1])}\n`);
      break;
    }
    case "prompt": {
      process.stdout.write(`${formatBuyerAgentPrompt()}\n`);
      break;
    }
    case "begin": {
      const packagePath = requirePositional(positional, 0, "root package path");
      const beginning = await beginPackage(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(beginning, null, 2)}\n`
        : `${formatPackageBeginning(beginning)}\n`);
      break;
    }
    case "validate": {
      const packagePath = requirePositional(positional, 0, "package path");
      const record = await validatePackage(packagePath);
      process.stdout.write(`Valid SeedSpec package: ${record.manifest.id}@${record.manifest.version}\nKind hint: ${record.manifest.kind}\nDigest: ${record.digest}\n`);
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
    case "lint": {
      rejectUnknownOptions(options, ["json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const lint = await lintPackage(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(lint, null, 2)}\n`
        : `${formatPackageLint(lint)}\n`);
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
    case "resources": {
      rejectUnknownOptions(options, ["json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const listing = await listPackageImplementationResources(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(listing, null, 2)}\n`
        : `${formatImplementationResourceListing(listing)}\n`);
      break;
    }
    case "resolve-resources": {
      rejectUnknownOptions(options, ["json"]);
      const projectPath = requirePositional(positional, 0, "project path");
      const state = await resolveImplementationResources(projectPath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(state, null, 2)}\n`
        : `${formatImplementationResourceResolution(state)}\n`);
      break;
    }
    case "record-resource-use": {
      rejectUnknownOptions(options, ["reason", "json"]);
      const projectPath = requirePositional(positional, 0, "project path");
      const packageId = requirePositional(positional, 1, "package ID");
      const resourceId = requirePositional(positional, 2, "resource ID");
      const useStatus = requirePositional(positional, 3, "loaded or skipped status");
      const result = await recordImplementationResourceUse(projectPath, {
        packageId,
        resourceId,
        useStatus,
        reason: oneOption(options, "reason")
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Recorded ${result.package}/${result.id}: ${result.use_status}${result.use_reason ? ` — ${result.use_reason}` : ""}\n`);
      break;
    }
    case "resource-digest": {
      rejectUnknownOptions(options, []);
      const resourcePath = requirePositional(positional, 0, "resource directory");
      process.stdout.write(`${await computeDirectoryDigest(resourcePath)}\n`);
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
      const rootPath = requirePositional(positional, 0, "root package path");
      const result = await discoverFeatures(rootPath, options.get("catalog") ?? []);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatFeatureDiscovery(result)}\n`);
      break;
    }
    case "resolve": {
      rejectUnknownOptions(options, [
        "feature",
        "add",
        "implementation",
        "output",
        "configuration-selections",
        "completion-scope",
        "technical-preferences",
        "artifact-selections",
        "decisions"
      ]);
      const rootPath = requirePositional(positional, 0, "root package path");
      const result = await resolveProject(rootPath, {
        additionPaths: options.get("add") ?? [],
        featurePaths: options.get("feature") ?? [],
        implementationProfiles: options.get("implementation") ?? [],
        outputDirectory: oneOption(options, "output"),
        configurationSelectionsPath: oneOption(options, "configuration-selections"),
        completionScopePath: oneOption(options, "completion-scope"),
        technicalPreferencesPath: oneOption(options, "technical-preferences"),
        artifactSelectionsPath: oneOption(options, "artifact-selections"),
        decisionsPath: oneOption(options, "decisions")
      });
      process.stdout.write(`Resolved ${result.project.root.id} with ${result.additions.length} addition(s)\nProject status: ${result.project.status}\nWorkspace: ${result.workspace}\n`);
      break;
    }
    case "completion": {
      rejectUnknownOptions(options, ["json"]);
      const projectPath = requirePositional(positional, 0, "project path");
      const result = await inspectProjectCompletion(projectPath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatProjectCompletion(result)}\n`);
      break;
    }
    case "init": {
      const kind = requirePositional(positional, 0, "package kind");
      const output = oneOption(options, "output") ?? `${kind}-package`;
      const result = await initPackage(kind, output);
      process.stdout.write(`Created valid SeedSpec package (kind hint: ${kind}): ${result.root}\n`);
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
      process.stdout.write(`Verified ${result.verifiedPackages.length} package(s) and ${result.verifiedCapabilityDeclarations.length} capability declaration(s)\n`);
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
