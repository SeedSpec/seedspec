import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { pathExists } from "./files.js";
import { validatePackage } from "./validate.js";

export const PROJECT_FILE_VERSION = "0.4";
export const DEFAULT_PROJECT_FILE = ".seedspec/project.yaml";

function objectValue(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function parseSetValue(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+$/u.test(raw)) return Number(raw);
  if (/^-?\d+\.\d+$/u.test(raw)) return Number(raw);
  if (
    (raw.startsWith("[") && raw.endsWith("]"))
    || (raw.startsWith("{") && raw.endsWith("}"))
    || (raw.startsWith("\"") && raw.endsWith("\""))
  ) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function emptyProject(packagePath) {
  return {
    project_version: PROJECT_FILE_VERSION,
    package: {
      path: packagePath
    },
    configuration: {},
    profile: null,
    optional_packages: []
  };
}

export function parseProjectDocument(raw, label = "Project file") {
  const document = typeof raw === "string" ? parseYaml(raw) : raw;
  if (!objectValue(document)) {
    throw new SeedSpecError(`${label} must contain a mapping`, {
      code: "INVALID_PROJECT"
    });
  }
  const packagePath = typeof document.package === "string"
    ? document.package
    : document.package?.path;
  if (typeof packagePath !== "string" || !packagePath) {
    throw new SeedSpecError(`${label} must declare package.path`, {
      code: "INVALID_PROJECT"
    });
  }
  return {
    project_version: document.project_version ?? PROJECT_FILE_VERSION,
    package: {
      path: packagePath,
      digest: typeof document.package === "object" ? document.package.digest ?? null : null
    },
    configuration: objectValue(document.configuration) ? document.configuration : {},
    profile: typeof document.profile === "string" && document.profile ? document.profile : null,
    optional_packages: Array.isArray(document.optional_packages)
      ? document.optional_packages.filter((id) => typeof id === "string" && id)
      : []
  };
}

export async function loadProject(filePath) {
  const source = await readFile(filePath, "utf8");
  return parseProjectDocument(source, filePath);
}

export async function saveProject(filePath, project) {
  const destination = path.resolve(filePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, stringifyYaml({
    project_version: PROJECT_FILE_VERSION,
    package: project.package,
    configuration: project.configuration,
    profile: project.profile,
    optional_packages: project.optional_packages
  }), "utf8");
  return destination;
}

function matchesType(value, type, itemType) {
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "string") return typeof value === "string";
  if (type === "array") {
    return Array.isArray(value) && value.every((item) => matchesType(item, itemType));
  }
  return false;
}

export async function validateProject(project, packagePath) {
  const record = await validatePackage(packagePath);
  const issues = [];
  if (project.package.digest && project.package.digest !== record.digest) {
    issues.push({
      severity: "error",
      code: "PROJECT_DIGEST_MISMATCH",
      message: `Project pins ${project.package.digest}, package digest is ${record.digest}`
    });
  }
  const variables = new Map(
    (record.manifest.configuration?.variables ?? []).map((variable) => [variable.id, variable])
  );
  for (const [id, value] of Object.entries(project.configuration)) {
    const variable = variables.get(id);
    if (!variable) {
      issues.push({
        severity: "error",
        code: "UNKNOWN_CONFIGURATION",
        message: `Project sets unknown configuration ${id}`
      });
      continue;
    }
    if (!matchesType(value, variable.type, variable.items?.type)) {
      issues.push({
        severity: "error",
        code: "INVALID_CONFIGURATION_VALUE",
        message: `Project value for ${id} does not match type ${variable.type}`
      });
    }
    if (variable.options && !variable.options.some((option) => JSON.stringify(option) === JSON.stringify(value))) {
      issues.push({
        severity: "error",
        code: "INVALID_CONFIGURATION_VALUE",
        message: `Project value for ${id} is not one of its options`
      });
    }
  }
  if (project.profile) {
    const module = (record.manifest.context_modules ?? [])
      .find((item) => item.id === project.profile);
    if (!module || module.type !== "implementation-profile") {
      issues.push({
        severity: "error",
        code: "UNKNOWN_PROFILE",
        message: `Project profile ${project.profile} is not an implementation-profile module`
      });
    }
  }
  const bundled = new Map(
    (record.manifest.bundled_packages ?? []).map((item) => [item.id, item])
  );
  for (const id of project.optional_packages) {
    const child = bundled.get(id);
    if (!child) {
      issues.push({
        severity: "error",
        code: "UNKNOWN_BUNDLED_PACKAGE",
        message: `Project enables unknown bundled package ${id}`
      });
    } else if (child.optional !== true) {
      issues.push({
        severity: "error",
        code: "REQUIRED_BUNDLED_PACKAGE",
        message: `Bundled package ${id} is required and does not need selection`
      });
    }
  }
  return {
    status: issues.some(({ severity }) => severity === "error") ? "fail" : "pass",
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    project,
    issues
  };
}

export function applyProjectUpdates(project, {
  profile,
  sets = [],
  enable = []
} = {}) {
  const next = {
    ...project,
    configuration: { ...project.configuration },
    optional_packages: [...project.optional_packages]
  };
  if (profile !== undefined) next.profile = profile || null;
  for (const assignment of sets) {
    const index = assignment.indexOf("=");
    if (index <= 0) {
      throw new SeedSpecError(`Configuration assignment must be id=value: ${assignment}`, {
        code: "INVALID_ARGUMENTS"
      });
    }
    next.configuration[assignment.slice(0, index)] = parseSetValue(assignment.slice(index + 1));
  }
  for (const id of enable) {
    if (!next.optional_packages.includes(id)) next.optional_packages.push(id);
  }
  return next;
}

export async function resolveProjectFile(packagePath, filePath = DEFAULT_PROJECT_FILE) {
  const destination = path.resolve(filePath);
  const record = await validatePackage(packagePath);
  if (inside(record.root, destination)) {
    throw new SeedSpecError(
      "Project state must live outside the package so it cannot change the package digest",
      { code: "PROJECT_INSIDE_PACKAGE" }
    );
  }
  return destination;
}

export async function loadOrCreateProject(packagePath, filePath = DEFAULT_PROJECT_FILE) {
  const destination = await resolveProjectFile(packagePath, filePath);
  if (await pathExists(destination)) return { file: destination, project: await loadProject(destination) };
  return {
    file: destination,
    project: emptyProject(path.resolve(packagePath))
  };
}

export function formatProject(report, filePath) {
  const lines = [
    `${report.status.toUpperCase()} project ${filePath}`,
    `Package: ${report.package.id}@${report.package.version}`,
    `Digest: ${report.package.digest}`,
    `Profile: ${report.project.profile ?? "none"}`,
    `Configuration: ${Object.keys(report.project.configuration).length}`,
    `Optional packages: ${report.project.optional_packages.length || "none"}`
  ];
  for (const issue of report.issues) {
    lines.push(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
  }
  return lines.join("\n");
}
