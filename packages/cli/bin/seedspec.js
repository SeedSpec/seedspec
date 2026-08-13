#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  checkPackage,
  conformanceSuiteVersion,
  createLock,
  flattenManifest,
  formatCheck,
  formatConformanceResult,
  formatError,
  formatInspection,
  formatLock,
  formatLockVerification,
  getPackage,
  inspectPackage,
  protocolPackageVersion,
  protocolRelease,
  protocolReleaseDigest,
  protocolVersion,
  runtimeVersion,
  runBundledConformanceSuite,
  runConformanceSuite,
  SeedSpecError,
  startPreviewServer,
  validatePackage,
  verifyLock,
  writeLock
} from "@seedspec/runtime";

const CLI_VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;

const HELP = `SeedSpec CLI ${CLI_VERSION} (Protocol ${protocolVersion}, experimental)

Usage:
  seedspec validate <package-path>
  seedspec digest <package-path>
  seedspec inspect <package-path> [--json]
  seedspec flatten <package-path> [--output <SPEC.md>]
  seedspec check <package-path> [--json] [--strict]
      [--evidence <file>] [--evaluate <script> --workspace <dir>]
      [--output <evidence.json>]
  seedspec lock <package-path> [--output <seedspec.lock.json>] [--json]
  seedspec verify-lock <lock-file> [--json]
  seedspec get <package-path> --digest sha256:... --output <dir>
  seedspec preview <package-path> [--port <number>]
      [--evaluate <script> --workspace <dir>]
  seedspec conformance [cases.yaml] [--json] [--output <report.json>]
  seedspec version [--json]

validate/inspect never execute package content. check may run a caller-supplied
evaluator against a workspace; it does not execute files from the package.
`;

const BOOLEAN_OPTIONS = new Set(["help", "json", "strict"]);
const VALUE_OPTIONS = new Set([
  "output",
  "evidence",
  "evaluate",
  "workspace",
  "digest",
  "port"
]);

function parseArguments(args) {
  const positional = [];
  const options = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const name = value.slice(2);
    if (BOOLEAN_OPTIONS.has(name)) {
      options.set(name, true);
      continue;
    }
    if (!VALUE_OPTIONS.has(name)) throw new SeedSpecError(`Unknown option: ${value}`, {
      code: "UNKNOWN_OPTION"
    });
    const optionValue = args[index + 1];
    if (!optionValue || optionValue.startsWith("--")) {
      throw new SeedSpecError(`Option ${value} requires a value`, {
        code: "MISSING_OPTION_VALUE"
      });
    }
    if (options.has(name)) throw new SeedSpecError(`Option ${value} may be supplied only once`, {
      code: "DUPLICATE_OPTION"
    });
    options.set(name, optionValue);
    index += 1;
  }
  return { positional, options };
}

function assertOptions(options, allowed) {
  const permitted = new Set(allowed);
  const unknown = [...options.keys()].find((name) => !permitted.has(name));
  if (unknown) throw new SeedSpecError(`Unknown option: --${unknown}`, {
    code: "UNKNOWN_OPTION"
  });
}

function requirePositionals(positional, minimum, maximum, usage) {
  if (positional.length < minimum || positional.length > maximum) {
    throw new SeedSpecError(`Usage: ${usage}`, { code: "INVALID_ARGUMENTS" });
  }
}

function writeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function run() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(HELP);
    return;
  }
  if (command === "--version") {
    process.stdout.write(`${CLI_VERSION}\n`);
    return;
  }

  const { positional, options } = parseArguments(args);
  if (options.has("help")) {
    process.stdout.write(HELP);
    return;
  }

  switch (command) {
    case "validate": {
      assertOptions(options, []);
      requirePositionals(positional, 1, 1, "seedspec validate <package-path>");
      const record = await validatePackage(positional[0]);
      process.stdout.write(
        `Valid SeedSpec package: ${record.manifest.id}@${record.manifest.version}\n`
        + `Name: ${record.manifest.name}\n`
        + (record.manifest.kind ? `Kind: ${record.manifest.kind}\n` : "")
        + `Protocol: ${record.manifest.target_protocol ?? protocolVersion}\n`
        + `Digest: ${record.digest}\n`
      );
      return;
    }
    case "digest": {
      assertOptions(options, []);
      requirePositionals(positional, 1, 1, "seedspec digest <package-path>");
      process.stdout.write(`${(await validatePackage(positional[0])).digest}\n`);
      return;
    }
    case "inspect": {
      assertOptions(options, ["json"]);
      requirePositionals(positional, 1, 1, "seedspec inspect <package-path> [--json]");
      const inspection = await inspectPackage(positional[0]);
      process.stdout.write(options.has("json")
        ? writeJson(inspection)
        : `${formatInspection(inspection)}\n`);
      return;
    }
    case "flatten": {
      assertOptions(options, ["output"]);
      requirePositionals(
        positional,
        1,
        1,
        "seedspec flatten <package-path> [--output <SPEC.md>]"
      );
      const flattened = flattenManifest(await validatePackage(positional[0]));
      const output = options.get("output");
      if (!output) {
        process.stdout.write(flattened);
        return;
      }
      const destination = path.resolve(output);
      await writeFile(destination, flattened, "utf8");
      process.stdout.write(`Flattened SPEC.md: ${destination}\n`);
      return;
    }
    case "check": {
      assertOptions(options, ["json", "strict", "evidence", "evaluate", "workspace", "output"]);
      requirePositionals(
        positional,
        1,
        1,
        "seedspec check <package-path> [--json] [--strict] [--evidence <file>] [--evaluate <script> --workspace <dir>]"
      );
      const report = await checkPackage(positional[0], {
        strict: options.has("strict"),
        evidence: options.get("evidence"),
        evaluate: options.get("evaluate"),
        workspace: options.get("workspace")
      });
      const output = options.get("output");
      if (output) {
        const evidence = report.verification
          ? {
              evidence_version: "0.4",
              package_id: report.package.id,
              package_digest: report.package.digest,
              runner: report.verification.runner,
              checks: report.evaluation?.checks
                ?? report.verification.criterion_results.flatMap((criterion) => (
                  criterion.checks.map((check) => ({
                    id: check.id,
                    criterion: criterion.id,
                    passed: check.passed,
                    error: check.error
                  }))
                ))
            }
          : report;
        await writeFile(path.resolve(output), writeJson(evidence), "utf8");
      }
      process.stdout.write(options.has("json") ? writeJson(report) : `${formatCheck(report)}\n`);
      if (report.status === "fail") process.exitCode = 1;
      return;
    }
    case "lock": {
      assertOptions(options, ["json", "output"]);
      requirePositionals(positional, 1, 1, "seedspec lock <package-path> [--output <file>]");
      const lock = await createLock([positional[0]]);
      const output = options.get("output");
      if (output) {
        const destination = await writeLock(lock, output);
        process.stdout.write(`Lockfile: ${destination}\n${formatLock(lock)}\n`);
        return;
      }
      process.stdout.write(options.has("json") ? writeJson(lock) : `${formatLock(lock)}\n`);
      return;
    }
    case "verify-lock": {
      assertOptions(options, ["json"]);
      requirePositionals(positional, 1, 1, "seedspec verify-lock <lock-file>");
      const lock = JSON.parse(await readFile(path.resolve(positional[0]), "utf8"));
      const report = await verifyLock(lock);
      process.stdout.write(options.has("json")
        ? writeJson(report)
        : `${formatLockVerification(report)}\n`);
      if (report.status !== "pass") process.exitCode = 1;
      return;
    }
    case "get": {
      assertOptions(options, ["digest", "output"]);
      requirePositionals(
        positional,
        1,
        1,
        "seedspec get <package-path> --digest sha256:... --output <dir>"
      );
      const fetched = await getPackage(positional[0], {
        digest: options.get("digest"),
        output: options.get("output")
      });
      process.stdout.write(
        `Fetched ${fetched.id}@${fetched.version}\nDigest: ${fetched.digest}\nOutput: ${fetched.output}\n`
      );
      return;
    }
    case "preview": {
      assertOptions(options, ["port", "evaluate", "workspace"]);
      requirePositionals(
        positional,
        1,
        1,
        "seedspec preview <package-path> [--port <number>] [--evaluate <script> --workspace <dir>]"
      );
      const port = Number(options.get("port") ?? 8787);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new SeedSpecError("Preview port must be an integer from 1 to 65535", {
          code: "INVALID_ARGUMENTS"
        });
      }
      const server = await startPreviewServer(positional[0], {
        port,
        evaluate: options.get("evaluate"),
        workspace: options.get("workspace")
      });
      process.stdout.write(`SeedSpec preview: ${server.url}\n`);
      await new Promise(() => {});
      return;
    }
    case "conformance": {
      assertOptions(options, ["json", "output"]);
      requirePositionals(
        positional,
        0,
        1,
        "seedspec conformance [cases.yaml] [--json] [--output <report.json>]"
      );
      const result = positional[0]
        ? await runConformanceSuite(positional[0])
        : await runBundledConformanceSuite();
      const json = writeJson(result);
      const output = options.get("output");
      if (output) await writeFile(path.resolve(output), json, "utf8");
      process.stdout.write(options.has("json")
        ? json
        : `${formatConformanceResult(result)}${output ? `\nReport: ${path.resolve(output)}` : ""}\n`);
      if (result.status !== "conformant") process.exitCode = 1;
      return;
    }
    case "version": {
      assertOptions(options, ["json"]);
      requirePositionals(positional, 0, 0, "seedspec version [--json]");
      const versions = {
        protocol_version: protocolVersion,
        protocol_release: protocolRelease.release_id,
        protocol_release_digest: protocolReleaseDigest,
        protocol_package_version: protocolPackageVersion,
        conformance_suite_version: conformanceSuiteVersion,
        runtime_version: runtimeVersion,
        cli_version: CLI_VERSION
      };
      process.stdout.write(options.has("json")
        ? writeJson(versions)
        : [
            `SeedSpec CLI: ${versions.cli_version}`,
            `Runtime: ${versions.runtime_version}`,
            `Protocol family: ${versions.protocol_version}`,
            `Exact protocol release: ${versions.protocol_release}`,
            `Protocol release digest: ${versions.protocol_release_digest}`,
            `Protocol schema package: ${versions.protocol_package_version}`,
            `Conformance suite: ${versions.conformance_suite_version}`
          ].join("\n") + "\n");
      return;
    }
    default:
      throw new SeedSpecError(`Unknown command: ${command}`, { code: "UNKNOWN_COMMAND" });
  }
}

run().catch((error) => {
  process.stderr.write(`Error: ${formatError(error)}\n`);
  process.exitCode = 1;
});
