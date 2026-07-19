import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { readYamlFile } from "./files.js";
import { resolveProject } from "./resolve.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";
import { validatePackage } from "./validate.js";

function resolveFixture(indexDirectory, relativePath) {
  return path.resolve(indexDirectory, relativePath);
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
    case "resolve": {
      const result = await resolveProject(
        resolveFixture(indexDirectory, testCase.application),
        {
          featurePaths: testCase.features.map((feature) => resolveFixture(indexDirectory, feature)),
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
      const artifactIndex = await readYamlFile(
        path.join(result.workspace, "artifacts.yaml"),
        "Resolved artifact index"
      );
      const validateProject = await compileProtocolSchema("project.schema.json");
      const validateLock = await compileProtocolSchema("lock.schema.json");
      const validateResolvedConfiguration = await compileProtocolSchema("resolved-config.schema.json");
      const validateArtifactIndex = await compileProtocolSchema("artifact-index.schema.json");
      if (!validateProject(project)
        || !validateLock(lock)
        || !validateResolvedConfiguration(resolvedConfiguration)
        || !validateArtifactIndex(artifactIndex)) {
        throw new SeedSpecError("Resolution produced non-conforming structured state", {
          code: "CONFORMANCE_ASSERTION_FAILED",
          details: [
            ...formatSchemaErrors(validateProject.errors),
            ...formatSchemaErrors(validateLock.errors),
            ...formatSchemaErrors(validateResolvedConfiguration.errors),
            ...formatSchemaErrors(validateArtifactIndex.errors)
          ]
        });
      }
      const sourceExtensions = {};
      for (const featureId of result.features) {
        const source = await readYamlFile(
          path.join(result.workspace, "features", featureId, "source.yaml"),
          "Resolved feature source"
        );
        sourceExtensions[featureId] = source.extensions ?? {};
      }
      return {
        featureOrder: result.features,
        projectStatus: result.project.status,
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
  if (testCase.expect.feature_order) {
    const actual = JSON.stringify(output.featureOrder);
    const expected = JSON.stringify(testCase.expect.feature_order);
    if (actual !== expected) {
      throw new SeedSpecError(`Feature order mismatch; expected ${expected}, received ${actual}`, {
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
  const suite = await readYamlFile(absoluteIndex, "Conformance suite index");
  const validateSuite = await compileProtocolSchema("conformance.schema.json");
  if (!validateSuite(suite)) {
    throw new SeedSpecError("Invalid conformance suite index", {
      code: "INVALID_CONFORMANCE_SUITE",
      details: formatSchemaErrors(validateSuite.errors)
    });
  }

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
            passed: false,
            message: `expected ${testCase.expect.code} but operation succeeded`
          });
          continue;
        }
        assertExpectedOutput(testCase, output);
        results.push({ id: testCase.id, passed: true, output });
      } catch (error) {
        if (testCase.expect.result === "fail" && error.code === testCase.expect.code) {
          results.push({ id: testCase.id, passed: true, errorCode: error.code });
        } else {
          results.push({
            id: testCase.id,
            passed: false,
            message: error.message,
            errorCode: error.code ?? "UNEXPECTED_ERROR"
          });
        }
      }
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  return {
    suiteVersion: suite.suite_version,
    protocolVersion: suite.protocol_version,
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    results
  };
}

export function formatConformanceResult(result) {
  const lines = result.results.map((testCase) => (
    `${testCase.passed ? "PASS" : "FAIL"} ${testCase.id}`
    + `${testCase.passed ? "" : ` — ${testCase.errorCode}: ${testCase.message}`}`
  ));
  lines.push(
    "",
    `${result.passed}/${result.total} cases passed for SeedSpec Protocol ${result.protocolVersion}`
  );
  return lines.join("\n");
}
