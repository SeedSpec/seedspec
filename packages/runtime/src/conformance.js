import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
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
      const rootPath = resolveFixture(indexDirectory, testCase.root);
      const additionPaths = testCase.additions.map((addition) => resolveFixture(indexDirectory, addition));
      let configurationSelectionsPath;
      if (testCase.configuration_selection === "examples") {
        const records = await Promise.all([
          validatePackage(rootPath),
          ...additionPaths.map(validatePackage)
        ]);
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
      const result = await resolveProject(
        rootPath,
        {
          additionPaths,
          implementationProfiles: testCase.implementations ?? [],
          configurationSelectionsPath,
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
      if (!validateProject(project)
        || !validateLock(lock)
        || !validateResolvedConfiguration(resolvedConfiguration)
        || !validateArtifactIndex(artifactIndex)
        || !validateImplementationResourceIndex(implementationResourceIndex)
        || !validateImplementationResourceState(implementationResourceState)
        || !validateImplementationProfileState(implementationProfileState)
        || !validateCompletionScope(completionScope)
        || !validateVerificationState(verificationState)) {
        throw new SeedSpecError("Resolution produced non-conforming structured state", {
          code: "CONFORMANCE_ASSERTION_FAILED",
          details: [
            ...formatSchemaErrors(validateProject.errors),
            ...formatSchemaErrors(validateLock.errors),
            ...formatSchemaErrors(validateResolvedConfiguration.errors),
            ...formatSchemaErrors(validateArtifactIndex.errors),
            ...formatSchemaErrors(validateImplementationResourceIndex.errors),
            ...formatSchemaErrors(validateImplementationResourceState.errors),
            ...formatSchemaErrors(validateImplementationProfileState.errors),
            ...formatSchemaErrors(validateCompletionScope.errors),
            ...formatSchemaErrors(validateVerificationState.errors)
          ]
        });
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
        implementationProfileStatus: result.project.implementation_profile_status,
        completionScopeStatus: result.project.completion_scope_status,
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
