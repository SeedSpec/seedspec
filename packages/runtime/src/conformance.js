import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  conformanceBundlePath,
  conformanceSuiteVersion,
  protocolRelease,
  protocolReleaseDigest
} from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { readYamlFile } from "./files.js";
import { lexicalCompare } from "./integrity.js";
import { inspectPackage } from "./inspect.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { flattenManifest } from "./manifest.js";
import { validatePackage } from "./validate.js";

const require = createRequire(import.meta.url);
const yamlVersion = JSON.parse(
  readFileSync(require.resolve("yaml/package.json"), "utf8")
).version;
const runtimeVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;

function contentDigest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function collectSuiteFiles(root, current = root, files = []) {
  const entries = (await readdir(current, { withFileTypes: true }))
    .sort((left, right) => lexicalCompare(left.name, right.name));
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    const info = await lstat(absolutePath);
    if (info.isSymbolicLink()) {
      throw new SeedSpecError(
        `Conformance suites must not contain symbolic links: ${relativePath}`,
        { code: "INVALID_CONFORMANCE_SUITE" }
      );
    }
    if (info.isDirectory()) {
      await collectSuiteFiles(root, absolutePath, files);
    } else if (info.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

async function computeSuiteDigest(root) {
  const files = (await collectSuiteFiles(root))
    .sort((left, right) => lexicalCompare(left.relativePath, right.relativePath));
  const aggregate = createHash("sha256");
  for (const file of files) {
    const digest = createHash("sha256")
      .update(await readFile(file.absolutePath))
      .digest("hex");
    aggregate.update(file.relativePath, "utf8");
    aggregate.update("\0", "utf8");
    aggregate.update(digest, "ascii");
    aggregate.update("\n", "utf8");
  }
  return `sha256:${aggregate.digest("hex")}`;
}

function resolveFixture(indexDirectory, relativePath) {
  const resolved = path.resolve(indexDirectory, relativePath);
  const relation = path.relative(indexDirectory, resolved);
  if (relation === ".." || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) {
    throw new SeedSpecError(
      `Conformance fixture path escapes the suite directory: ${relativePath}`,
      { code: "INVALID_CONFORMANCE_SUITE" }
    );
  }
  return resolved;
}

function portableSourcePath(packageRoot, sourcePath) {
  return path.relative(packageRoot, sourcePath).split(path.sep).join("/");
}

function inspectionProjection(packageRoot, inspection) {
  const sourcePaths = new Set([
    inspection.sources.spec,
    inspection.sources.base_manifest,
    ...Object.values(inspection.sources.values).map(({ file }) => file),
    ...inspection.overrides.flatMap(({ base, override }) => [
      base.source.file,
      override.source.file
    ]),
    ...inspection.sections.map(({ source }) => source.file)
  ].filter(Boolean).map((sourcePath) => portableSourcePath(packageRoot, sourcePath)));

  return {
    resolved_manifest: inspection.resolved_manifest,
    source_paths: [...sourcePaths].sort(lexicalCompare),
    override_paths: inspection.overrides.map(({ path: manifestPath }) => manifestPath),
    section_ids: inspection.sections.map(({ subject, id }) => `${subject}:${id}`),
    success_anchor_ids: inspection.success_anchors.map(({ id }) => id),
    unanchored_success_criteria: inspection.unanchored_success_criteria,
    bundled_packages: inspection.bundled_packages
  };
}

async function executeCase(testCase, indexDirectory) {
  const packagePath = resolveFixture(indexDirectory, testCase.package);
  if (testCase.operation === "validate") {
    const record = await validatePackage(packagePath);
    return testCase.expect.digest ? { digest: record.digest } : {};
  }
  if (testCase.operation === "digest") {
    return { digest: (await validatePackage(packagePath)).digest };
  }
  if (testCase.operation === "inspect") {
    const info = await lstat(packagePath);
    const packageRoot = info.isDirectory() ? packagePath : path.dirname(packagePath);
    return {
      inspection: inspectionProjection(packageRoot, await inspectPackage(packagePath))
    };
  }
  if (testCase.operation === "flatten") {
    const source = await validatePackage(packagePath);
    const flattened = flattenManifest(source);
    const outputRoot = await mkdtemp(path.join(tmpdir(), "seedspec-flatten-"));
    try {
      await writeFile(path.join(outputRoot, "SPEC.md"), flattened, "utf8");
      const output = await validatePackage(outputRoot);
      return {
        digest: output.digest,
        preserves: {
          "resolved-manifest": isDeepStrictEqual(output.manifest, source.manifest),
          "markdown-body": output.definition === source.definition,
          "source-digest-comment": flattened.split("\n")[1]
            === `# Generated from ${source.digest}. Review before replacing authored sources.`
        }
      };
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  }
  throw new SeedSpecError(`Unsupported conformance operation: ${testCase.operation}`, {
    code: "INVALID_CONFORMANCE_SUITE"
  });
}

function assertExpectedOutput(testCase, output) {
  if (testCase.expect.digest && output.digest !== testCase.expect.digest) {
    throw new SeedSpecError(
      `Package digest mismatch; expected ${testCase.expect.digest}, received ${output.digest}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (
    testCase.expect.inspection
    && !isDeepStrictEqual(output.inspection, testCase.expect.inspection)
  ) {
    throw new SeedSpecError("Inspection output does not match the expected projection", {
      code: "CONFORMANCE_ASSERTION_FAILED",
      details: [
        `expected ${JSON.stringify(testCase.expect.inspection)}`,
        `received ${JSON.stringify(output.inspection)}`
      ]
    });
  }
  for (const invariant of testCase.expect.preserves ?? []) {
    if (output.preserves?.[invariant] !== true) {
      throw new SeedSpecError(`Flatten did not preserve ${invariant}`, {
        code: "CONFORMANCE_ASSERTION_FAILED"
      });
    }
  }
}

export async function runConformanceSuite(indexPath) {
  const absoluteIndex = path.resolve(indexPath);
  const indexDirectory = path.dirname(absoluteIndex);
  const indexBytes = await readFile(absoluteIndex);
  const indexDigest = contentDigest(indexBytes);
  const bundleDigest = await computeSuiteDigest(indexDirectory);
  const suite = await readYamlFile(absoluteIndex, "Conformance suite index");
  const validateSuite = await compileProtocolSchema("conformance.schema.json");
  if (!validateSuite(suite)) {
    throw new SeedSpecError("Invalid conformance suite index", {
      code: "INVALID_CONFORMANCE_SUITE",
      details: formatSchemaErrors(validateSuite.errors)
    });
  }

  const results = [];
  for (const testCase of suite.cases) {
    try {
      const output = await executeCase(testCase, indexDirectory);
      if (testCase.expect.result === "fail") {
        results.push({
          id: testCase.id,
          operation: testCase.operation,
          status: "failed",
          error_code: "CONFORMANCE_ASSERTION_FAILED",
          message: `expected ${testCase.expect.code} but operation succeeded`
        });
        continue;
      }
      assertExpectedOutput(testCase, output);
      results.push({
        id: testCase.id,
        operation: testCase.operation,
        status: "passed",
        ...(Object.keys(output).length ? { output } : {})
      });
    } catch (error) {
      if (testCase.expect.result === "fail" && error.code === testCase.expect.code) {
        results.push({
          id: testCase.id,
          operation: testCase.operation,
          status: "passed",
          output: { expected_error_code: error.code }
        });
      } else {
        results.push({
          id: testCase.id,
          operation: testCase.operation,
          status: "failed",
          message: error.message,
          error_code: error.code ?? "UNEXPECTED_ERROR"
        });
      }
    }
  }

  const passed = results.filter(({ status }) => status === "passed").length;
  const failed = results.filter(({ status }) => status === "failed").length;
  const releaseBound = suite.suite_version === protocolRelease.conformance.suite_version
    && suite.protocol_version === protocolRelease.protocol_family
    && indexDigest === protocolRelease.conformance.index_digest
    && bundleDigest === protocolRelease.conformance.bundle_digest;
  const report = {
    report_version: "1",
    status: releaseBound
      ? failed === 0 ? "conformant" : "nonconformant"
      : "incomplete",
    protocol_release: {
      id: protocolRelease.release_id,
      digest: protocolReleaseDigest
    },
    protocol_family: suite.protocol_version,
    suite: {
      version: suite.suite_version,
      source: releaseBound
        ? protocolRelease.conformance.index
        : path.basename(absoluteIndex),
      index_digest: indexDigest,
      bundle_digest: bundleDigest,
      release_bound: releaseBound
    },
    runtime: { name: "@seedspec/runtime", version: runtimeVersion },
    environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      yaml_parser: `yaml@${yamlVersion}`,
      json_parser: `JSON.parse@node-${process.versions.node}`
    },
    extensions: [],
    totals: { total: results.length, passed, failed, skipped: 0 },
    package_digests: results
      .filter(({ output }) => output?.digest)
      .map(({ id, output }) => ({ case: id, digest: output.digest })),
    results
  };
  const validateReport = await compileProtocolSchema("conformance-report.schema.json");
  if (!validateReport(report)) {
    throw new SeedSpecError("Conformance run produced an invalid report", {
      code: "INVALID_CONFORMANCE_REPORT",
      details: formatSchemaErrors(validateReport.errors)
    });
  }
  return report;
}

function safeBundlePath(relativePath) {
  if (
    typeof relativePath !== "string"
    || !relativePath
    || path.isAbsolute(relativePath)
    || relativePath.includes("\\")
    || relativePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new SeedSpecError(`Unsafe conformance bundle path: ${String(relativePath)}`, {
      code: "INVALID_CONFORMANCE_BUNDLE"
    });
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
    throw new SeedSpecError("Bundled conformance metadata does not match the release", {
      code: "INVALID_CONFORMANCE_BUNDLE"
    });
  }
  const seen = new Set();
  for (const file of bundle.files) {
    const segments = safeBundlePath(file.path);
    if (seen.has(file.path) || typeof file.content_base64 !== "string") {
      throw new SeedSpecError(`Invalid conformance bundle entry: ${file.path}`, {
        code: "INVALID_CONFORMANCE_BUNDLE"
      });
    }
    seen.add(file.path);
    const target = path.join(destination, ...segments);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(file.content_base64, "base64"));
  }
  const computed = await computeSuiteDigest(destination);
  if (computed !== bundle.bundle_digest) {
    throw new SeedSpecError("Bundled conformance files do not match the release digest", {
      code: "INVALID_CONFORMANCE_BUNDLE"
    });
  }
  const indexPath = path.join(destination, "cases.yaml");
  if (contentDigest(await readFile(indexPath)) !== protocolRelease.conformance.index_digest) {
    throw new SeedSpecError("Bundled conformance index does not match the release digest", {
      code: "INVALID_CONFORMANCE_BUNDLE"
    });
  }
  return indexPath;
}

export async function runBundledConformanceSuite() {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-conformance-"));
  try {
    return await runConformanceSuite(
      await materializeConformanceBundle(temporaryRoot)
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export function formatConformanceResult(result) {
  const lines = result.results.map((testCase) => (
    `${testCase.status === "passed" ? "PASS" : "FAIL"} ${testCase.id}`
    + `${testCase.status === "failed" ? ` — ${testCase.error_code}: ${testCase.message}` : ""}`
  ));
  lines.push(
    "",
    `${result.totals.passed}/${result.totals.total} cases passed for SeedSpec Protocol ${result.protocol_family} (suite ${result.suite.version})`,
    `Conformance status: ${result.status}`
  );
  return lines.join("\n");
}
