import path from "node:path";
import { analyzeCapabilityDeclarations } from "./capabilities.js";
import { SeedSpecError } from "./errors.js";
import { pathExists, readYamlFile } from "./files.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { validatePackage } from "./validate.js";

function stableJson(value) {
  return JSON.stringify(value);
}

function compareLockedPackage(expected, actual) {
  return expected.id === actual.manifest.id
    && expected.version === actual.manifest.version
    && expected.kind === actual.manifest.kind
    && expected.digest === actual.digest;
}

export async function verifyProjectLock(projectPath, packagePaths) {
  const absolute = path.resolve(projectPath);
  const workspace = path.basename(absolute) === ".seedspec"
    ? absolute
    : path.join(absolute, ".seedspec");
  const lockPath = path.join(workspace, "dependencies.lock.yaml");
  if (!await pathExists(lockPath)) {
    throw new SeedSpecError(`SeedSpec lock file does not exist: ${lockPath}`, {
      code: "LOCK_NOT_FOUND"
    });
  }

  const lock = await readYamlFile(lockPath, "SeedSpec dependency lock");
  const validateLock = await compileProtocolSchema("lock.schema.json");
  if (!validateLock(lock)) {
    throw new SeedSpecError("SeedSpec dependency lock is invalid", {
      code: "INVALID_LOCK",
      details: formatSchemaErrors(validateLock.errors)
    });
  }

  const records = await Promise.all(packagePaths.map(validatePackage));
  const supplied = new Map();
  for (const record of records) {
    if (supplied.has(record.manifest.id)) {
      throw new SeedSpecError(`Package supplied more than once: ${record.manifest.id}`, {
        code: "DUPLICATE_LOCK_PACKAGE"
      });
    }
    supplied.set(record.manifest.id, record);
  }

  const expectedPackages = [lock.root, ...lock.additions];
  const missing = expectedPackages
    .filter((expected) => !supplied.has(expected.id))
    .map((expected) => expected.id);
  if (missing.length > 0) {
    throw new SeedSpecError("Packages required by the lock were not supplied", {
      code: "LOCK_PACKAGE_MISSING",
      details: missing
    });
  }

  const mismatches = expectedPackages
    .filter((expected) => !compareLockedPackage(expected, supplied.get(expected.id)))
    .map((expected) => {
      const actual = supplied.get(expected.id);
      return `${expected.id}: expected ${expected.version} ${expected.digest}, received ${actual.manifest.version} ${actual.digest}`;
    });
  if (mismatches.length > 0) {
    throw new SeedSpecError("Supplied package bytes do not match the lock", {
      code: "LOCK_PACKAGE_MISMATCH",
      details: mismatches
    });
  }

  const unexpected = [...supplied.keys()].filter(
    (id) => !expectedPackages.some((expected) => expected.id === id)
  );
  if (unexpected.length > 0) {
    throw new SeedSpecError("Packages not present in the lock were supplied", {
      code: "LOCK_PACKAGE_UNEXPECTED",
      details: unexpected
    });
  }

  const root = supplied.get(lock.root.id);
  const additions = lock.additions.map((addition) => supplied.get(addition.id));
  const graph = analyzeCapabilityDeclarations(root, additions);
  const graphOrder = graph.orderedAdditions.map((addition) => addition.manifest.id);
  const lockOrder = lock.additions.map((addition) => addition.id);

  if (stableJson(graphOrder) !== stableJson(lockOrder)
    || stableJson(graph.capabilities) !== stableJson(lock.capabilities)
    || stableJson(graph.requirements) !== stableJson(lock.requirements)
    || stableJson(graph.reviews) !== stableJson(lock.reviews)) {
    throw new SeedSpecError("Locked addition order or declaration analysis does not match package declarations", {
      code: "LOCK_GRAPH_MISMATCH"
    });
  }

  return {
    workspace,
    lock,
    verifiedPackages: expectedPackages.map((item) => item.id),
    verifiedCapabilityDeclarations: lock.capabilities.map((item) => item.id)
  };
}
