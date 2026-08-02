import { SeedSpecError } from "./errors.js";
import {
  contextModuleDigest,
  localContextModule
} from "./context.js";
import { validatePackage } from "./validate.js";

function findModule(record, selector) {
  const localId = selector.includes("/") ? selector.split("/").at(-1) : selector;
  const qualifiedId = `${record.manifest.id}/${localId}`;
  if (selector.includes("/") && selector !== qualifiedId) return null;
  return record.manifest.context.modules.find((module) => module.id === localId) ?? null;
}

function normalizeIssues(issues) {
  if (!Array.isArray(issues)) return [];
  return issues.map((issue, index) => ({
    severity: issue?.severity === "warning" ? "warning" : "error",
    code: typeof issue?.code === "string" && issue.code ? issue.code : `ADAPTER_ISSUE_${index + 1}`,
    message: typeof issue?.message === "string" && issue.message
      ? issue.message
      : "The adapter reported an unspecified issue.",
    ...(typeof issue?.path === "string" && issue.path ? { path: issue.path } : {})
  }));
}

export async function validateContextModule(inputPath, selector, {
  registry,
  adapterId = null
} = {}) {
  if (!registry) {
    throw new SeedSpecError("Context module validation requires an adapter registry", {
      code: "CONTEXT_ADAPTER_NOT_FOUND"
    });
  }
  const record = await validatePackage(inputPath);
  const module = findModule(record, selector);
  if (!module) {
    throw new SeedSpecError(`Context module is not declared by ${record.manifest.id}: ${selector}`, {
      code: "CONTEXT_MODULE_NOT_FOUND"
    });
  }
  const local = await localContextModule(record.root, record.manifest, module);
  if (!local) {
    throw new SeedSpecError(`Context module does not have local bytes: ${module.id}`, {
      code: "CONTEXT_MODULE_UNAVAILABLE"
    });
  }
  const adapter = registry.match(module, "validate", adapterId);
  if (!adapter) {
    throw new SeedSpecError(`No registered adapter validates format ${module.format}`, {
      code: "CONTEXT_ADAPTER_NOT_FOUND",
      details: [module.format_version ? `format version: ${module.format_version}` : "format is unversioned"]
    });
  }

  let result;
  try {
    result = await adapter.validate({
      package: {
        id: record.manifest.id,
        version: record.manifest.version,
        digest: record.digest
      },
      module: {
        ...module,
        qualified_id: `${record.manifest.id}/${module.id}`,
        role: record.manifest.definition.module === module.id ? "primary-intent" : "supporting"
      },
      root: local.root,
      entrypoint: local.entrypoint
    });
  } catch (error) {
    throw new SeedSpecError(`Context adapter failed while validating ${module.id}`, {
      code: "CONTEXT_ADAPTER_EXECUTION_FAILED",
      details: [adapter.id, error?.message ?? String(error)]
    });
  }
  const issues = normalizeIssues(result?.issues);
  const valid = result?.valid === true && !issues.some((issue) => issue.severity === "error");
  return {
    validation_version: "1",
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    module: {
      id: module.id,
      qualified_id: `${record.manifest.id}/${module.id}`,
      format: module.format,
      ...(module.format_version ? { format_version: module.format_version } : {})
    },
    source_digest: await contextModuleDigest(local),
    adapter: {
      id: adapter.id,
      version: adapter.version
    },
    valid,
    issues,
    ...(result?.summary && typeof result.summary === "object" ? { summary: result.summary } : {})
  };
}

export function formatContextValidation(result) {
  const lines = [
    `${result.valid ? "Valid" : "Invalid"} context module: ${result.module.qualified_id}`,
    `Format: ${result.module.format}${result.module.format_version ? `@${result.module.format_version}` : ""}`,
    `Adapter: ${result.adapter.id}@${result.adapter.version}`,
    `Source digest: ${result.source_digest}`
  ];
  for (const issue of result.issues) {
    lines.push(`- ${issue.severity} ${issue.code}${issue.path ? ` (${issue.path})` : ""}: ${issue.message}`);
  }
  return lines.join("\n");
}
