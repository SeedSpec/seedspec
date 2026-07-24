import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  conformanceBundlePath,
  conformanceSuiteVersion,
  protocolPackageVersion,
  protocolRelease,
  protocolReleaseDigest,
  protocolSchemaNames,
  schemaDirectory
} from "@seedspec/protocol";
import { runConformanceSuite } from "./conformance.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { validatePackage } from "./validate.js";

const runtimeVersion = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
).version;

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function lexicalCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function safeBundlePath(relativePath) {
  if (
    typeof relativePath !== "string"
    || !relativePath
    || path.isAbsolute(relativePath)
    || relativePath.includes("\\")
    || relativePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe conformance bundle path: ${String(relativePath)}`);
  }
  return relativePath.split("/");
}

async function materializeConformanceBundle(destination) {
  const bundle = JSON.parse(await readFile(conformanceBundlePath, "utf8"));
  if (
    bundle.bundle_version !== "1"
    || bundle.suite_version !== conformanceSuiteVersion
    || bundle.protocol_family !== protocolRelease.protocol_family
    || bundle.bundle_digest !== protocolRelease.conformance.bundle_digest
    || !Array.isArray(bundle.files)
  ) {
    throw new Error("Bundled conformance metadata does not match the exact protocol release");
  }

  const seen = new Set();
  const digestedFiles = [];
  for (const file of bundle.files) {
    const segments = safeBundlePath(file.path);
    if (seen.has(file.path)) throw new Error(`Duplicate conformance bundle path: ${file.path}`);
    seen.add(file.path);
    if (typeof file.content_base64 !== "string") {
      throw new Error(`Missing conformance bundle content: ${file.path}`);
    }
    const bytes = Buffer.from(file.content_base64, "base64");
    const target = path.join(destination, ...segments);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    if (!(file.path.startsWith("golden/")
      && file.path.endsWith("/resolution-receipt.json"))) {
      digestedFiles.push({
        path: file.path,
        digest: createHash("sha256").update(bytes).digest("hex")
      });
    }
  }

  digestedFiles.sort((left, right) => lexicalCompare(left.path, right.path));
  const aggregate = createHash("sha256");
  for (const file of digestedFiles) {
    aggregate.update(file.path, "utf8");
    aggregate.update("\0", "utf8");
    aggregate.update(file.digest, "ascii");
    aggregate.update("\n", "utf8");
  }
  const computed = `sha256:${aggregate.digest("hex")}`;
  if (computed !== bundle.bundle_digest) {
    throw new Error("Bundled conformance files do not match the release digest");
  }

  const indexPath = path.join(destination, "cases.yaml");
  if (digest(await readFile(indexPath)) !== protocolRelease.conformance.index_digest) {
    throw new Error("Bundled conformance index does not match the release digest");
  }
  return indexPath;
}

async function verifySchemas() {
  const releasedSchemas = new Map(protocolRelease.schemas.map((entry) => [
    path.basename(entry.path),
    entry.digest
  ]));
  const expected = [...protocolSchemaNames].sort();
  const released = [...releasedSchemas.keys()].sort();
  if (JSON.stringify(expected) !== JSON.stringify(released)) {
    throw new Error("Installed and released schema inventories differ");
  }
  for (const name of expected) {
    const actual = digest(await readFile(path.join(schemaDirectory, name)));
    if (actual !== releasedSchemas.get(name)) {
      throw new Error(`Schema digest mismatch: ${name}`);
    }
  }
  return `${expected.length} schema digests match`;
}

async function checked(id, action) {
  try {
    return {
      id,
      status: "passed",
      detail: await action()
    };
  } catch (error) {
    return {
      id,
      status: "failed",
      detail: error.message
    };
  }
}

export async function inspectInstallation({
  cliVersion,
  full = false
} = {}) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-doctor-"));
  let bundledIndex;
  let fullReport;
  try {
    const checks = [];
    checks.push(await checked("release-manifest", async () => {
      const validate = await compileProtocolSchema("protocol-release.schema.json");
      if (!validate(protocolRelease)) {
        throw new Error(formatSchemaErrors(validate.errors).join("; "));
      }
      return `${protocolRelease.release_id} (${protocolReleaseDigest})`;
    }));
    checks.push(await checked("version-coherence", async () => {
      const expected = protocolRelease.implementations;
      if (
        protocolPackageVersion !== protocolRelease.schema_package.version
        || runtimeVersion !== expected.runtime.version
        || (cliVersion && cliVersion !== expected.cli.version)
      ) {
        throw new Error("Installed package versions do not match the exact protocol release");
      }
      return `protocol ${protocolPackageVersion}; runtime ${runtimeVersion}${cliVersion ? `; CLI ${cliVersion}` : ""}`;
    }));
    checks.push(await checked("schema-digests", verifySchemas));
    checks.push(await checked("conformance-bundle", async () => {
      bundledIndex = await materializeConformanceBundle(temporaryRoot);
      return `${conformanceSuiteVersion} matches ${protocolRelease.conformance.bundle_digest}`;
    }));
    checks.push(await checked("offline-smoke-test", async () => {
      if (!bundledIndex) throw new Error("Conformance bundle is unavailable");
      const fixture = path.join(temporaryRoot, "fixtures/portable-feature");
      const first = await validatePackage(fixture);
      const second = await validatePackage(fixture);
      if (first.digest !== second.digest) {
        throw new Error("Repeated package digests differ");
      }
      return `validated and digested ${first.manifest.id}`;
    }));
    if (full) {
      checks.push(await checked("full-conformance", async () => {
        if (!bundledIndex) throw new Error("Conformance bundle is unavailable");
        fullReport = await runConformanceSuite(bundledIndex);
        if (fullReport.status !== "conformant") {
          throw new Error(`Conformance status is ${fullReport.status}`);
        }
        return `${fullReport.totals.passed}/${fullReport.totals.total} cases passed`;
      }));
    }

    return {
      doctor_version: "1",
      status: checks.every((check) => check.status === "passed")
        ? "healthy"
        : "unhealthy",
      protocol_release: {
        id: protocolRelease.release_id,
        digest: protocolReleaseDigest
      },
      runtime: {
        name: "@seedspec/runtime",
        version: runtimeVersion
      },
      ...(cliVersion ? {
        cli: {
          name: "@seedspec/cli",
          version: cliVersion
        }
      } : {}),
      checks,
      ...(fullReport ? { conformance: fullReport } : {})
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function runBundledConformanceSuite() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-conformance-"));
  try {
    const indexPath = await materializeConformanceBundle(temporaryRoot);
    return await runConformanceSuite(indexPath);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export function formatInstallationInspection(result) {
  return [
    `SeedSpec installation: ${result.status}`,
    `Exact protocol release: ${result.protocol_release.id}`,
    `Release digest: ${result.protocol_release.digest}`,
    "",
    ...result.checks.map((check) => (
      `${check.status === "passed" ? "PASS" : "FAIL"} ${check.id} — ${check.detail}`
    ))
  ].join("\n");
}
