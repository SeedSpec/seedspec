import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import {
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
import { stringify as stringifyYaml } from "yaml";
import {
  protocolRelease,
  protocolReleaseDigest
} from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { readYamlFile } from "./files.js";
import {
  computeDirectoryDigest,
  computeSelectedDirectoryDigest
} from "./integrity.js";
import { PROTOCOL_OWNED_RESOLUTION_PATHS } from "./receipts.js";
import { resolveProject } from "./resolve.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { validatePackage } from "./validate.js";
import { inspectCapabilityConformance } from "./capability-conformance.js";

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

function lexicalCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

async function computeConformanceBundleDigest(root) {
  const files = [];
  async function collect(current) {
    const entries = (await readdir(current, { withFileTypes: true }))
      .sort((left, right) => lexicalCompare(left.name, right.name));
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      const info = lstatSync(absolutePath);
      if (info.isSymbolicLink()) {
        throw new SeedSpecError(`Conformance suites must not contain symbolic links: ${relativePath}`, {
          code: "INVALID_CONFORMANCE_SUITE"
        });
      }
      if (info.isDirectory()) {
        await collect(absolutePath);
      } else if (
        info.isFile()
        && !(relativePath.startsWith("golden/")
          && relativePath.endsWith("/resolution-receipt.json"))
      ) {
        files.push({ absolutePath, relativePath });
      }
    }
  }
  await collect(root);
  files.sort((left, right) => lexicalCompare(left.relativePath, right.relativePath));
  const aggregate = createHash("sha256");
  for (const file of files) {
    const fileHash = createHash("sha256")
      .update(await readFile(file.absolutePath))
      .digest("hex");
    aggregate.update(file.relativePath, "utf8");
    aggregate.update("\0", "utf8");
    aggregate.update(fileHash, "ascii");
    aggregate.update("\n", "utf8");
  }
  return `sha256:${aggregate.digest("hex")}`;
}

function resolveFixture(indexDirectory, relativePath) {
  const resolved = path.resolve(indexDirectory, relativePath);
  const relative = path.relative(indexDirectory, resolved);
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new SeedSpecError(`Conformance fixture path escapes the suite directory: ${relativePath}`, {
      code: "INVALID_CONFORMANCE_SUITE"
    });
  }
  return resolved;
}

function validateFixturePaths(suite, indexDirectory) {
  for (const testCase of suite.cases) {
    const paths = [
      testCase.package,
      testCase.root,
      testCase.decisions,
      testCase.applied_intent,
      testCase.result_file,
      testCase.golden,
      ...(testCase.additions ?? [])
    ].filter(Boolean);
    for (const fixturePath of paths) resolveFixture(indexDirectory, fixturePath);
  }
}

async function executeCase(testCase, indexDirectory, outputDirectory) {
  switch (testCase.operation) {
    case "validate":
      await validatePackage(resolveFixture(indexDirectory, testCase.package));
      return {};
    case "digest-stability": {
      const packagePath = resolveFixture(indexDirectory, testCase.package);
      const first = await validatePackage(packagePath);
      const second = await validatePackage(packagePath);
      if (first.digest !== second.digest) {
        throw new SeedSpecError("Repeated package digests differ", {
          code: "UNSTABLE_PACKAGE_DIGEST",
          details: [first.digest, second.digest]
        });
      }
      return { digest: first.digest };
    }
    case "capability-conformance": {
      const result = await inspectCapabilityConformance(
        resolveFixture(indexDirectory, testCase.package),
        testCase.capability,
        resolveFixture(indexDirectory, testCase.result_file)
      );
      return { capabilityStatus: result.status };
    }
    case "resolve": {
      const rootPath = resolveFixture(indexDirectory, testCase.root);
      const additionPaths = testCase.additions.map((addition) => resolveFixture(indexDirectory, addition));
      const records = await Promise.all([
        validatePackage(rootPath),
        ...additionPaths.map(validatePackage)
      ]);
      let configurationSelectionsPath;
      if (testCase.configuration_selection === "examples") {
        configurationSelectionsPath = path.join(outputDirectory, "configuration-selections.yaml");
        await mkdir(outputDirectory, { recursive: true });
        await writeFile(configurationSelectionsPath, stringifyYaml({
          protocol_version: "0.1",
          packages: records.map((record) => ({
            package: record.manifest.id,
            selection: "example"
          }))
        }), "utf8");
      }
      let appliedIntentPath = testCase.applied_intent
        ? resolveFixture(indexDirectory, testCase.applied_intent)
        : undefined;
      if (!appliedIntentPath && testCase.intent_selection === "affirmed") {
        appliedIntentPath = path.join(outputDirectory, "applied-intent.yaml");
        await mkdir(outputDirectory, { recursive: true });
        await writeFile(appliedIntentPath, stringifyYaml({
          protocol_version: "0.1",
          packages: records.map((record) => ({
            package: record.manifest.id,
            use: "as-authored"
          })),
          contributions: []
        }), "utf8");
      }
      const result = await resolveProject(
        rootPath,
        {
          additionPaths,
          implementationProfiles: testCase.implementations ?? [],
          configurationSelectionsPath,
          appliedIntentPath,
          decisionsPath: testCase.decisions
            ? resolveFixture(indexDirectory, testCase.decisions)
            : undefined,
          outputDirectory
        }
      );
      const project = await readYamlFile(
        path.join(result.workspace, "project.yaml"),
        "Resolved project"
      );
      const lock = await readYamlFile(
        path.join(result.workspace, "dependencies.lock.yaml"),
        "Resolved dependency lock"
      );
      const resolvedConfiguration = await readYamlFile(
        path.join(result.workspace, "resolved-config.yaml"),
        "Resolved configuration"
      );
      const resolvedIntent = await readYamlFile(
        path.join(result.workspace, "resolved-intent.yaml"),
        "Resolved intent"
      );
      const artifactIndex = await readYamlFile(
        path.join(result.workspace, "artifacts.yaml"),
        "Resolved artifact index"
      );
      const implementationResourceIndex = await readYamlFile(
        path.join(result.workspace, "implementation-resources.yaml"),
        "Implementation resource index"
      );
      const implementationResourceState = await readYamlFile(
        path.join(result.workspace, "implementation-resource-state.yaml"),
        "Implementation resource state"
      );
      const implementationProfileState = await readYamlFile(
        path.join(result.workspace, "implementation-profile-state.yaml"),
        "Implementation profile state"
      );
      const completionScope = await readYamlFile(
        path.join(result.workspace, "completion-scope.yaml"),
        "Resolved completion scope"
      );
      const verificationState = await readYamlFile(
        path.join(result.workspace, "verification-state.yaml"),
        "Verification state"
      );
      const validateProject = await compileProtocolSchema("project.schema.json");
      const validateLock = await compileProtocolSchema("lock.schema.json");
      const validateResolvedConfiguration = await compileProtocolSchema("resolved-config.schema.json");
      const validateResolvedIntent = await compileProtocolSchema("resolved-intent.schema.json");
      const validateArtifactIndex = await compileProtocolSchema("artifact-index.schema.json");
      const validateImplementationResourceIndex = await compileProtocolSchema(
        "implementation-resource-index.schema.json"
      );
      const validateImplementationResourceState = await compileProtocolSchema(
        "implementation-resource-state.schema.json"
      );
      const validateImplementationProfileState = await compileProtocolSchema(
        "implementation-profile-state.schema.json"
      );
      const validateCompletionScope = await compileProtocolSchema("completion-scope.schema.json");
      const validateVerificationState = await compileProtocolSchema("verification-state.schema.json");
      const validateResolutionReceipt = await compileProtocolSchema("resolution-receipt.schema.json");
      const resolutionReceipt = JSON.parse(await readFile(
        path.join(result.workspace, "resolution-receipt.json"),
        "utf8"
      ));
      if (!validateProject(project)
        || !validateLock(lock)
        || !validateResolvedConfiguration(resolvedConfiguration)
        || !validateResolvedIntent(resolvedIntent)
        || !validateArtifactIndex(artifactIndex)
        || !validateImplementationResourceIndex(implementationResourceIndex)
        || !validateImplementationResourceState(implementationResourceState)
        || !validateImplementationProfileState(implementationProfileState)
        || !validateCompletionScope(completionScope)
        || !validateVerificationState(verificationState)
        || !validateResolutionReceipt(resolutionReceipt)) {
        throw new SeedSpecError("Resolution produced non-conforming structured state", {
          code: "CONFORMANCE_ASSERTION_FAILED",
          details: [
            ...formatSchemaErrors(validateProject.errors),
            ...formatSchemaErrors(validateLock.errors),
            ...formatSchemaErrors(validateResolvedConfiguration.errors),
            ...formatSchemaErrors(validateResolvedIntent.errors),
            ...formatSchemaErrors(validateArtifactIndex.errors),
            ...formatSchemaErrors(validateImplementationResourceIndex.errors),
            ...formatSchemaErrors(validateImplementationResourceState.errors),
            ...formatSchemaErrors(validateImplementationProfileState.errors),
            ...formatSchemaErrors(validateCompletionScope.errors),
            ...formatSchemaErrors(validateVerificationState.errors),
            ...formatSchemaErrors(validateResolutionReceipt.errors)
          ]
        });
      }
      let goldenDigest;
      if (testCase.golden) {
        const goldenPath = resolveFixture(indexDirectory, testCase.golden);
        const actualDigest = await computeSelectedDirectoryDigest(
          result.workspace,
          [...PROTOCOL_OWNED_RESOLUTION_PATHS, "resolution-receipt.json"]
        );
        goldenDigest = await computeDirectoryDigest(goldenPath);
        if (actualDigest !== goldenDigest) {
          throw new SeedSpecError("Resolution does not match its complete golden handoff", {
            code: "CONFORMANCE_ASSERTION_FAILED",
            details: [`expected ${goldenDigest}`, `received ${actualDigest}`]
          });
        }
      }
      const sourceExtensions = {};
      for (const additionId of result.additions) {
        const source = await readYamlFile(
          path.join(result.workspace, "additions", additionId, "source.yaml"),
          "Resolved addition source"
        );
        sourceExtensions[additionId] = source.extensions ?? {};
      }
      return {
        additionOrder: result.additions,
        projectStatus: result.project.status,
        configurationStatus: result.project.configuration_status,
        intentStatus: result.project.intent_status,
        implementationProfileStatus: result.project.implementation_profile_status,
        completionScopeStatus: result.project.completion_scope_status,
        receiptId: resolutionReceipt.receipt_id,
        outputDigest: resolutionReceipt.subject.result.output_digest,
        ...(goldenDigest ? { goldenDigest } : {}),
        reviewCount: result.lock.reviews.length,
        sourceExtensions
      };
    }
    default:
      throw new SeedSpecError(`Unsupported conformance operation: ${testCase.operation}`, {
        code: "INVALID_CONFORMANCE_SUITE"
      });
  }
}

function assertExpectedOutput(testCase, output) {
  if (testCase.expect.digest && output.digest !== testCase.expect.digest) {
    throw new SeedSpecError(
      `Package digest mismatch; expected ${testCase.expect.digest}, received ${output.digest}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (testCase.expect.capability_status
    && output.capabilityStatus !== testCase.expect.capability_status) {
    throw new SeedSpecError(
      `Capability conformance status mismatch; expected ${testCase.expect.capability_status}, received ${output.capabilityStatus}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (testCase.expect.addition_order) {
    const actual = JSON.stringify(output.additionOrder);
    const expected = JSON.stringify(testCase.expect.addition_order);
    if (actual !== expected) {
      throw new SeedSpecError(`Addition order mismatch; expected ${expected}, received ${actual}`, {
        code: "CONFORMANCE_ASSERTION_FAILED"
      });
    }
  }
  if (testCase.expect.project_status && output.projectStatus !== testCase.expect.project_status) {
    throw new SeedSpecError(
      `Project status mismatch; expected ${testCase.expect.project_status}, received ${output.projectStatus}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (testCase.expect.configuration_status
    && output.configurationStatus !== testCase.expect.configuration_status) {
    throw new SeedSpecError(
      `Configuration status mismatch; expected ${testCase.expect.configuration_status}, received ${output.configurationStatus}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (testCase.expect.intent_status && output.intentStatus !== testCase.expect.intent_status) {
    throw new SeedSpecError(
      `Intent status mismatch; expected ${testCase.expect.intent_status}, received ${output.intentStatus}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (testCase.expect.implementation_profile_status
    && output.implementationProfileStatus !== testCase.expect.implementation_profile_status) {
    throw new SeedSpecError(
      `Implementation profile status mismatch; expected ${testCase.expect.implementation_profile_status}, received ${output.implementationProfileStatus}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (testCase.expect.completion_scope_status
    && output.completionScopeStatus !== testCase.expect.completion_scope_status) {
    throw new SeedSpecError(
      `Completion scope status mismatch; expected ${testCase.expect.completion_scope_status}, received ${output.completionScopeStatus}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (Number.isInteger(testCase.expect.review_count)
    && output.reviewCount !== testCase.expect.review_count) {
    throw new SeedSpecError(
      `Capability review count mismatch; expected ${testCase.expect.review_count}, received ${output.reviewCount}`,
      { code: "CONFORMANCE_ASSERTION_FAILED" }
    );
  }
  if (testCase.expect.preserved_extension) {
    const expectation = testCase.expect.preserved_extension;
    if (!Object.hasOwn(output.sourceExtensions?.[expectation.package] ?? {}, expectation.key)) {
      throw new SeedSpecError(
        `Extension ${expectation.key} was not preserved for ${expectation.package}`,
        { code: "CONFORMANCE_ASSERTION_FAILED" }
      );
    }
  }
}

export async function runConformanceSuite(indexPath) {
  const absoluteIndex = path.resolve(indexPath);
  const indexDirectory = path.dirname(absoluteIndex);
  const suiteBytes = await readFile(absoluteIndex);
  const indexDigest = contentDigest(suiteBytes);
  const bundleDigest = await computeConformanceBundleDigest(indexDirectory);
  const suite = await readYamlFile(absoluteIndex, "Conformance suite index");
  const validateSuite = await compileProtocolSchema("conformance.schema.json");
  if (!validateSuite(suite)) {
    throw new SeedSpecError("Invalid conformance suite index", {
      code: "INVALID_CONFORMANCE_SUITE",
      details: formatSchemaErrors(validateSuite.errors)
    });
  }
  validateFixturePaths(suite, indexDirectory);

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-conformance-"));
  const results = [];

  try {
    for (const testCase of suite.cases) {
      const outputDirectory = path.join(temporaryRoot, testCase.id);
      try {
        const output = await executeCase(testCase, indexDirectory, outputDirectory);
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
          ...(Object.keys(output).length > 0 ? { output } : {})
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
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  const passed = results.filter((result) => result.status === "passed").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const releaseBound = suite.suite_version === protocolRelease.conformance.suite_version
    && suite.protocol_version === protocolRelease.protocol_family
    && indexDigest === protocolRelease.conformance.index_digest
    && bundleDigest === protocolRelease.conformance.bundle_digest;
  const report = {
    report_version: "1",
    status: releaseBound
      ? failed === 0 && skipped === 0 ? "conformant" : "nonconformant"
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
    runtime: {
      name: "@seedspec/runtime",
      version: runtimeVersion
    },
    environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      yaml_parser: `yaml@${yamlVersion}`,
      json_parser: `JSON.parse@node-${process.versions.node}`
    },
    extensions: [],
    totals: {
      total: results.length,
      passed,
      failed,
      skipped
    },
    package_digests: results
      .filter((result) => result.output?.digest)
      .map((result) => ({
        case: result.id,
        digest: result.output.digest
      })),
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

export function formatConformanceResult(result) {
  const lines = result.results.map((testCase) => (
    `${testCase.status === "passed" ? "PASS" : testCase.status === "skipped" ? "SKIP" : "FAIL"} ${testCase.id}`
    + `${testCase.status === "failed" ? ` — ${testCase.error_code}: ${testCase.message}` : ""}`
  ));
  lines.push(
    "",
    `${result.totals.passed}/${result.totals.total} cases passed for SeedSpec Protocol ${result.protocol_family} (suite ${result.suite.version})`,
    `Conformance status: ${result.status}`
  );
  return lines.join("\n");
}
