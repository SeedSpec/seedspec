import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { computeDirectoryDigest } from "./integrity.js";
import {
  pathExists,
  readJsonFile,
  readYamlFile,
  resolvePackagePath
} from "./files.js";
import {
  compileConfigurationSchema,
  compileProtocolSchema,
  formatSchemaErrors
} from "./schema.js";

function sha256(content) {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

async function pathDigest(absolutePath) {
  const info = await pathExists(absolutePath);
  if (!info) return null;
  if (info.isDirectory()) return computeDirectoryDigest(absolutePath);
  if (info.isFile()) return sha256(await readFile(absolutePath));
  return null;
}

function sameCapability(left, right) {
  return left?.id === right.id && left?.version === right.version;
}

function duplicateIds(items) {
  const seen = new Set();
  return [...new Set(items.map((item) => item.id).filter((id) => seen.has(id) || !seen.add(id)))];
}

async function loadSuite(root, capability) {
  const suiteRelativePath = capability.conformance.suite;
  const suitePath = resolvePackagePath(root, suiteRelativePath);
  const suiteInfo = await pathExists(suitePath);
  if (!suiteInfo?.isFile()) {
    throw new SeedSpecError(`Capability conformance suite must reference a file: ${suiteRelativePath}`, {
      code: "INVALID_CAPABILITY_CONFORMANCE"
    });
  }

  const suite = await readYamlFile(suitePath, "Capability conformance suite");
  const validateSuite = await compileProtocolSchema("capability-conformance-suite.schema.json");
  if (!validateSuite(suite)) {
    throw new SeedSpecError(`Capability conformance suite is invalid: ${suiteRelativePath}`, {
      code: "INVALID_CAPABILITY_CONFORMANCE",
      details: formatSchemaErrors(validateSuite.errors)
    });
  }
  if (!sameCapability(suite.capability, capability)) {
    throw new SeedSpecError(`Capability conformance suite identifies a different revision: ${suiteRelativePath}`, {
      code: "INVALID_CAPABILITY_CONFORMANCE",
      details: [
        `expected ${capability.id}@${capability.version}`,
        `received ${suite.capability.id}@${suite.capability.version}`
      ]
    });
  }
  const repeatedChecks = duplicateIds(suite.checks);
  if (repeatedChecks.length > 0) {
    throw new SeedSpecError(`Capability conformance suite repeats check IDs: ${suiteRelativePath}`, {
      code: "INVALID_CAPABILITY_CONFORMANCE",
      details: repeatedChecks
    });
  }

  const validateScenarios = await compileProtocolSchema("capability-scenarios.schema.json");
  for (const check of suite.checks) {
    const checkPath = resolvePackagePath(root, check.path);
    const info = await pathExists(checkPath);
    if (!info) {
      throw new SeedSpecError(`Capability conformance check does not exist: ${check.path}`, {
        code: "INVALID_CAPABILITY_CONFORMANCE",
        details: [`check ${check.id}`]
      });
    }
    if ((check.kind === "json-schema" || check.kind === "acceptance-scenarios") && !info.isFile()) {
      throw new SeedSpecError(`Capability conformance check must reference a file: ${check.path}`, {
        code: "INVALID_CAPABILITY_CONFORMANCE",
        details: [`check ${check.id}`]
      });
    }
    if (check.kind === "json-schema") {
      const schema = await readJsonFile(checkPath, "Capability JSON Schema");
      try {
        compileConfigurationSchema(schema);
      } catch (error) {
        throw new SeedSpecError(`Capability JSON Schema cannot be compiled: ${check.path}`, {
          code: "INVALID_CAPABILITY_CONFORMANCE",
          details: [error.message]
        });
      }
    }
    if (check.kind === "acceptance-scenarios") {
      const scenarios = await readYamlFile(checkPath, "Capability acceptance scenarios");
      if (!validateScenarios(scenarios)) {
        throw new SeedSpecError(`Capability acceptance scenarios are invalid: ${check.path}`, {
          code: "INVALID_CAPABILITY_CONFORMANCE",
          details: formatSchemaErrors(validateScenarios.errors)
        });
      }
      if (!sameCapability(scenarios.capability, capability)) {
        throw new SeedSpecError(`Capability acceptance scenarios identify a different revision: ${check.path}`, {
          code: "INVALID_CAPABILITY_CONFORMANCE"
        });
      }
      const repeatedScenarios = duplicateIds(scenarios.scenarios);
      if (repeatedScenarios.length > 0) {
        throw new SeedSpecError(`Capability acceptance scenarios repeat scenario IDs: ${check.path}`, {
          code: "INVALID_CAPABILITY_CONFORMANCE",
          details: repeatedScenarios
        });
      }
    }
  }

  return { suite, suitePath, suiteRelativePath };
}

export async function validateCapabilityConformanceDeclarations(root, manifest) {
  for (const capability of manifest.provides.capabilities) {
    if (capability.conformance) await loadSuite(root, capability);
  }
}

export async function capabilityConformanceBinding(record, capabilityId) {
  const capability = record.manifest.provides.capabilities.find((item) => item.id === capabilityId);
  if (!capability) {
    throw new SeedSpecError(`Package does not provide capability: ${capabilityId}`, {
      code: "CAPABILITY_NOT_PROVIDED"
    });
  }
  if (!capability.conformance) {
    throw new SeedSpecError(`Capability has no declared conformance suite: ${capabilityId}`, {
      code: "CAPABILITY_CONFORMANCE_NOT_DECLARED"
    });
  }

  const { suite, suitePath, suiteRelativePath } = await loadSuite(record.root, capability);
  const contractPath = resolvePackagePath(record.root, capability.contract);
  const contractDigest = sha256(await readFile(contractPath));
  const checkedPaths = await Promise.all(suite.checks.map(async (check) => ({
    id: check.id,
    path: check.path,
    digest: await pathDigest(resolvePackagePath(record.root, check.path))
  })));
  checkedPaths.sort((left, right) => (
    Buffer.compare(Buffer.from(left.id, "utf8"), Buffer.from(right.id, "utf8"))
  ));
  const suiteDigest = sha256(JSON.stringify({
    suite: {
      path: suiteRelativePath,
      digest: await pathDigest(suitePath)
    },
    checks: checkedPaths
  }));

  return {
    capability: { id: capability.id, version: capability.version },
    contract: capability.contract,
    contract_digest: contractDigest,
    suite: suiteRelativePath,
    suite_digest: suiteDigest,
    coverage: suite.coverage,
    checks: suite.checks
  };
}

function deriveStatus(checks) {
  if (checks.every((check) => check.result === "not-run")) return "not-run";
  if (checks.some((check) => check.result === "fail")) return "failed";
  if (checks.some((check) => check.result === "not-run")) return "incomplete";
  return "passed";
}

export async function inspectCapabilityConformance(inputPath, capabilityId, resultPath) {
  const { validatePackage } = await import("./validate.js");
  const record = await validatePackage(inputPath);
  const binding = await capabilityConformanceBinding(record, capabilityId);
  if (!resultPath) return { status: "not-evaluated", binding, result: null };

  const result = await readYamlFile(path.resolve(resultPath), "Capability conformance result");
  const validateResult = await compileProtocolSchema("capability-conformance-result.schema.json");
  if (!validateResult(result)) {
    throw new SeedSpecError("Capability conformance result is invalid", {
      code: "INVALID_CAPABILITY_CONFORMANCE_RESULT",
      details: formatSchemaErrors(validateResult.errors)
    });
  }
  if (!sameCapability(result.capability, binding.capability)) {
    throw new SeedSpecError("Capability conformance result belongs to a different capability revision", {
      code: "STALE_CAPABILITY_CONFORMANCE_RESULT"
    });
  }
  if (result.contract_digest !== binding.contract_digest || result.suite_digest !== binding.suite_digest) {
    throw new SeedSpecError("Capability conformance result belongs to different contract or suite bytes", {
      code: "STALE_CAPABILITY_CONFORMANCE_RESULT",
      details: [
        `contract expected ${binding.contract_digest}, received ${result.contract_digest}`,
        `suite expected ${binding.suite_digest}, received ${result.suite_digest}`
      ]
    });
  }

  const repeatedResults = duplicateIds(result.checks);
  const expectedIds = binding.checks.map((check) => check.id).sort();
  const resultIds = result.checks.map((check) => check.id).sort();
  if (repeatedResults.length > 0 || JSON.stringify(expectedIds) !== JSON.stringify(resultIds)) {
    throw new SeedSpecError("Capability conformance result does not cover the declared suite", {
      code: "CAPABILITY_CONFORMANCE_SCOPE_MISMATCH",
      details: [`suite: ${expectedIds.join(", ")}`, `result: ${resultIds.join(", ")}`]
    });
  }

  const status = deriveStatus(result.checks);
  if (result.status !== status) {
    throw new SeedSpecError("Capability conformance status does not match its check results", {
      code: "CAPABILITY_CONFORMANCE_STATUS_MISMATCH",
      details: [`expected ${status}`, `received ${result.status}`]
    });
  }
  return { status, binding, result };
}

export function formatCapabilityConformance(result) {
  const lines = [
    `Capability: ${result.binding.capability.id}@${result.binding.capability.version}`,
    `Conformance status: ${result.status}`,
    `Contract digest: ${result.binding.contract_digest}`,
    `Suite digest: ${result.binding.suite_digest}`,
    `Declared suite coverage: ${result.binding.coverage}`,
    `Checks: ${result.binding.checks.length}`
  ];
  if (result.result) {
    lines.push(`Realization: ${result.result.realization.reference}`);
  }
  return lines.join("\n");
}
