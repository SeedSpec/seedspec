import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  AUTHORING_AREAS,
  AUTHORING_STATE_FORMAT,
  AUTHORING_TARGETS,
  resolveAuthoringStateDirectory
} from "./authoring.js";
import { SeedSpecError } from "./errors.js";
import { resolvePackageLocation } from "./files.js";
import { computeDirectoryDigest } from "./integrity.js";
import { validatePackage } from "./validate.js";

export const AUTHORING_WORKSPACE_SNAPSHOT_FORMAT = "1";
export const AUTHORING_WORKSPACE_OPERATION_FORMAT = "1";
export const AUTHORING_WORKSPACE_REVISION_ALGORITHM = "seedspec-authoring-workspace-sha256-v1";

const TERMINAL_OUTCOMES = new Set(["completed", "abandoned", "superseded"]);
const RESOLVED_QUESTION_STATUSES = new Set(["resolved", "closed", "rejected"]);

function lexicalCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function mediaType(relativePath) {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === ".md") return "text/markdown";
  if (extension === ".yaml" || extension === ".yml") return "application/yaml";
  if (extension === ".json") return "application/json";
  if (extension === ".txt") return "text/plain";
  return "application/octet-stream";
}

async function collectDocuments(root, current = root, documents = []) {
  const entries = (await readdir(current, { withFileTypes: true }))
    .sort((left, right) => lexicalCompare(left.name, right.name));
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    const info = await lstat(absolutePath);
    if (info.isSymbolicLink()) {
      throw new SeedSpecError(`SeedSpec packages must not contain symbolic links: ${relativePath}`, {
        code: "UNSAFE_PACKAGE_CONTENT"
      });
    }
    if (info.isDirectory()) {
      await collectDocuments(root, absolutePath, documents);
      continue;
    }
    if (!info.isFile()) {
      throw new SeedSpecError(`SeedSpec packages may contain only regular files and directories: ${relativePath}`, {
        code: "UNSAFE_PACKAGE_CONTENT"
      });
    }
    const content = await readFile(absolutePath);
    documents.push({
      id: relativePath,
      path: relativePath,
      media_type: mediaType(relativePath),
      bytes: content.byteLength,
      digest: `sha256:${createHash("sha256").update(content).digest("hex")}`
    });
  }
  return documents;
}

async function pathStatus(candidate) {
  try {
    return await stat(candidate);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function workspaceBinding(stateRoot) {
  const workspacePath = path.join(stateRoot, "workspace.yaml");
  let source;
  try {
    source = await readFile(workspacePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  let workspace;
  try {
    workspace = parseYaml(source);
  } catch {
    return null;
  }
  if (typeof workspace?.package?.path !== "string") return null;

  return {
    packageRoot: path.resolve(stateRoot, workspace.package.path),
    stateRoot: path.resolve(stateRoot)
  };
}

function suggestedStateRoot(packageRoot) {
  return path.basename(packageRoot) === "seedspec"
    ? path.join(path.dirname(packageRoot), "authoring")
    : `${packageRoot}.seedspec-authoring`;
}

async function discoveryCandidates(directory) {
  const candidates = [];
  const stateRoots = [
    directory,
    path.join(directory, "authoring"),
    `${directory}.seedspec-authoring`,
    path.join(path.dirname(directory), "authoring")
  ];
  for (const stateRoot of stateRoots) {
    const binding = await workspaceBinding(stateRoot);
    if (binding) candidates.push({ ...binding, stateExists: true });
  }

  const packageRoots = [directory, path.join(directory, "seedspec")];
  for (const packageRoot of packageRoots) {
    const manifest = await pathStatus(path.join(packageRoot, "seedspec.yaml"));
    if (!manifest?.isFile()) continue;
    const stateRoot = suggestedStateRoot(packageRoot);
    const binding = await workspaceBinding(stateRoot);
    candidates.push(binding
      ? { ...binding, stateExists: true }
      : { packageRoot, stateRoot, stateExists: false });
  }

  return [...new Map(candidates.map((candidate) => [
    `${path.resolve(candidate.packageRoot)}\0${path.resolve(candidate.stateRoot)}`,
    {
      packageRoot: path.resolve(candidate.packageRoot),
      stateRoot: path.resolve(candidate.stateRoot),
      stateExists: candidate.stateExists
    }
  ])).values()];
}

export async function discoverAuthoringWorkspace(startPath = process.cwd()) {
  const requested = path.resolve(startPath);
  const requestedInfo = await pathStatus(requested);
  if (!requestedInfo) {
    throw new SeedSpecError(`Authoring location does not exist: ${startPath}`, {
      code: "AUTHORING_LOCATION_NOT_FOUND"
    });
  }

  let directory = requestedInfo.isDirectory() ? requested : path.dirname(requested);
  while (true) {
    const candidates = await discoveryCandidates(directory);
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      throw new SeedSpecError("More than one SeedSpec authoring workspace was found", {
        code: "AMBIGUOUS_AUTHORING_WORKSPACE",
        details: candidates.map(({ packageRoot }) => packageRoot)
      });
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new SeedSpecError("No SeedSpec authoring project was found here", {
    code: "AUTHORING_WORKSPACE_NOT_FOUND",
    details: [
      "Run this command inside a SeedSpec project.",
      "To start a package explicitly, use `seedspec author create <package-path>`."
    ]
  });
}

async function writeIfMissing(filePath, content) {
  try {
    await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}

function sanitizeText(value, replacements) {
  let result = String(value);
  for (const [absolutePath, label] of replacements) {
    result = result.split(absolutePath).join(label);
  }
  return result;
}

function sanitizeValue(value, replacements) {
  if (typeof value === "string") return sanitizeText(value, replacements);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeValue(item, replacements)])
    );
  }
  return value;
}

function diagnosticFromError(error, replacements) {
  return {
    code: error instanceof SeedSpecError ? error.code : "SEEDSPEC_ERROR",
    message: sanitizeText(error.message, replacements),
    details: Array.isArray(error.details)
      ? error.details.map((detail) => sanitizeText(detail, replacements))
      : []
  };
}

async function readYamlState(filePath, resource, diagnostics) {
  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    diagnostics.push({
      code: "AUTHORING_STATE_NOT_READABLE",
      resource,
      message: `${resource} is not readable`,
      details: []
    });
    return null;
  }
  try {
    return parseYaml(source);
  } catch (error) {
    diagnostics.push({
      code: "INVALID_AUTHORING_STATE",
      resource,
      message: `${resource} is invalid YAML`,
      details: [error.message]
    });
    return null;
  }
}

async function inspectReviewState(stateRoot, stateExists) {
  if (!stateExists) {
    return {
      status: "not-created",
      target: null,
      areas: AUTHORING_AREAS.map((area, index) => ({
        index: index + 1,
        id: area,
        status: "not-audited"
      })),
      passes: [],
      current: null,
      questions: { total: 0, open: 0, resolved: 0, items: [] },
      diagnostics: []
    };
  }

  const diagnostics = [];
  const workspace = await readYamlState(
    path.join(stateRoot, "workspace.yaml"),
    "workspace.yaml",
    diagnostics
  );
  if (workspace === undefined) {
    diagnostics.push({
      code: "AUTHORING_STATE_FILE_MISSING",
      resource: "workspace.yaml",
      message: "workspace.yaml is missing",
      details: []
    });
  }
  const questionState = await readYamlState(
    path.join(stateRoot, "open-questions.yaml"),
    "open-questions.yaml",
    diagnostics
  );
  if (questionState === undefined) {
    diagnostics.push({
      code: "AUTHORING_STATE_FILE_MISSING",
      resource: "open-questions.yaml",
      message: "open-questions.yaml is missing",
      details: []
    });
  }
  const questionItems = Array.isArray(questionState?.questions) ? questionState.questions : [];
  if (questionState && !Array.isArray(questionState.questions)) {
    diagnostics.push({
      code: "INVALID_AUTHORING_STATE",
      resource: "open-questions.yaml",
      message: "open-questions.yaml must contain a questions array",
      details: []
    });
  }

  const passes = [];
  const passesRoot = path.join(stateRoot, "passes");
  const passesInfo = await pathStatus(passesRoot);
  if (passesInfo?.isDirectory()) {
    const entries = (await readdir(passesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const request = await readYamlState(
        path.join(passesRoot, entry.name, "request.yaml"),
        `passes/${entry.name}/request.yaml`,
        diagnostics
      );
      const result = await readYamlState(
        path.join(passesRoot, entry.name, "result.yaml"),
        `passes/${entry.name}/result.yaml`,
        diagnostics
      );
      if (request === undefined || result === undefined) {
        diagnostics.push({
          code: "AUTHORING_STATE_FILE_MISSING",
          resource: `passes/${entry.name}`,
          message: `Authoring pass ${entry.name} must contain request.yaml and result.yaml`,
          details: []
        });
      }
      passes.push({
        id: entry.name,
        area: typeof request?.area === "string" ? request.area : null,
        target: typeof request?.target === "string" ? request.target : null,
        outcome: typeof result?.outcome === "string" ? result.outcome : "invalid",
        package_digest_before: typeof request?.package_digest_before === "string"
          ? request.package_digest_before
          : null,
        package_digest_after: typeof result?.package_digest_after === "string"
          ? result.package_digest_after
          : null
      });
    }
  }

  const areas = AUTHORING_AREAS.map((area, index) => {
    const relevant = passes.filter((pass) => pass.area === area);
    return {
      index: index + 1,
      id: area,
      status: relevant.length > 0 ? relevant.at(-1).outcome : "not-audited"
    };
  });
  const current = passes.find((pass) => !TERMINAL_OUTCOMES.has(pass.outcome)) ?? null;

  return {
    status: diagnostics.length > 0 ? "invalid" : "available",
    target: typeof workspace?.target === "string" ? workspace.target : null,
    areas,
    passes,
    current,
    questions: {
      total: questionItems.length,
      open: questionItems.filter((question) => !RESOLVED_QUESTION_STATUSES.has(question?.status)).length,
      resolved: questionItems.filter((question) => RESOLVED_QUESTION_STATUSES.has(question?.status)).length,
      items: questionItems
    },
    diagnostics,
    workspace
  };
}

function revisionDigest(packageDigest, stateDigest) {
  const hash = createHash("sha256");
  hash.update(`${AUTHORING_WORKSPACE_REVISION_ALGORITHM}\n`, "utf8");
  hash.update(`package:${packageDigest}\n`, "utf8");
  hash.update(`state:${stateDigest ?? "not-created"}\n`, "utf8");
  return `sha256:${hash.digest("hex")}`;
}

function bestEffortManifest(source) {
  try {
    const manifest = parseYaml(source);
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return {};
    return {
      id: typeof manifest.id === "string" ? manifest.id : null,
      version: typeof manifest.version === "string" ? manifest.version : null,
      kind: typeof manifest.kind === "string" ? manifest.kind : null,
      protocol_version: typeof manifest.protocol_version === "string"
        ? manifest.protocol_version
        : null
    };
  } catch {
    return {};
  }
}

export async function inspectAuthoringWorkspace(inputPath, {
  stateDirectory,
  toolVersion = "unknown"
} = {}) {
  const { root: packageRoot, manifestPath } = await resolvePackageLocation(inputPath);
  const stateRoot = resolveAuthoringStateDirectory(packageRoot, stateDirectory);
  const stateInfo = await pathStatus(stateRoot);
  if (stateInfo && !stateInfo.isDirectory()) {
    throw new SeedSpecError("Authoring state path must be a directory", {
      code: "INVALID_AUTHORING_STATE"
    });
  }

  const replacements = [
    [packageRoot, "<package>"],
    [stateRoot, "<authoring-state>"]
  ];
  const documents = await collectDocuments(packageRoot);
  const draftDigest = await computeDirectoryDigest(packageRoot);
  const stateDigest = stateInfo ? await computeDirectoryDigest(stateRoot) : null;
  const review = await inspectReviewState(stateRoot, Boolean(stateInfo));

  let manifestHints = {};
  try {
    manifestHints = bestEffortManifest(await readFile(manifestPath, "utf8"));
  } catch {
    manifestHints = {};
  }

  let validation;
  let validRecord = null;
  try {
    validRecord = await validatePackage(packageRoot);
    validation = { status: "valid", diagnostics: [] };
  } catch (error) {
    validation = {
      status: "invalid",
      diagnostics: [diagnosticFromError(error, replacements)]
    };
  }

  const workspaceId = typeof review.workspace?.workspace_id === "string"
    ? review.workspace.workspace_id
    : null;
  const revision = revisionDigest(draftDigest, stateDigest);
  const manifest = validRecord?.manifest ?? manifestHints;

  return {
    authoring_workspace_snapshot_version: AUTHORING_WORKSPACE_SNAPSHOT_FORMAT,
    revision_algorithm: AUTHORING_WORKSPACE_REVISION_ALGORITHM,
    tool_version: toolVersion,
    workspace: {
      id: workspaceId,
      identity_status: workspaceId
        ? "assigned"
        : stateInfo ? "missing" : "not-created",
      revision,
      state_format: review.workspace?.authoring_state_version ?? null,
      state_digest: stateDigest
    },
    package: {
      id: manifest.id ?? null,
      version: manifest.version ?? null,
      kind: manifest.kind ?? null,
      protocol_version: manifest.protocol_version ?? null,
      status: validation.status,
      digest: validRecord?.digest ?? null,
      draft_digest: draftDigest,
      diagnostics: validation.diagnostics
    },
    documents,
    review: {
      status: review.status,
      target: review.target,
      areas: review.areas,
      passes: review.passes,
      current: review.current,
      questions: {
        ...review.questions,
        items: sanitizeValue(review.questions.items, replacements)
      },
      diagnostics: review.diagnostics,
      complete: review.areas.every((area) => area.status === "completed")
    }
  };
}

export async function createAuthoringWorkspace(inputPath, {
  stateDirectory,
  target = "shape",
  toolVersion = "unknown"
} = {}) {
  if (!AUTHORING_TARGETS.includes(target)) {
    throw new SeedSpecError(`Unknown authoring target: ${target}`, {
      code: "INVALID_AUTHORING_TARGET",
      details: [`supported: ${AUTHORING_TARGETS.join(", ")}`]
    });
  }

  const requested = path.resolve(inputPath);
  const requestedInfo = await pathStatus(requested);
  let packageRoot;
  if (!requestedInfo) {
    packageRoot = requested;
    await mkdir(packageRoot, { recursive: true });
  } else if (requestedInfo.isDirectory()) {
    packageRoot = requested;
  } else if (requestedInfo.isFile() && path.basename(requested) === "seedspec.yaml") {
    packageRoot = path.dirname(requested);
  } else {
    throw new SeedSpecError(`Expected a package directory or seedspec.yaml: ${inputPath}`, {
      code: "INVALID_PACKAGE_PATH"
    });
  }

  const stateRoot = resolveAuthoringStateDirectory(packageRoot, stateDirectory);
  await Promise.all([
    mkdir(path.join(stateRoot, "passes"), { recursive: true }),
    mkdir(path.join(stateRoot, "candidates"), { recursive: true })
  ]);

  let manifest = {};
  try {
    manifest = bestEffortManifest(
      await readFile(path.join(packageRoot, "seedspec.yaml"), "utf8")
    );
  } catch {
    manifest = {};
  }
  const workspacePath = path.join(stateRoot, "workspace.yaml");
  const created = await writeIfMissing(workspacePath, stringifyYaml({
    authoring_state_version: AUTHORING_STATE_FORMAT,
    workspace_id: randomUUID(),
    package: {
      path: path.relative(stateRoot, packageRoot) || ".",
      id: manifest.id ?? null,
      version: manifest.version ?? null,
      kind: manifest.kind ?? null
    },
    protocol_version: manifest.protocol_version ?? null,
    target,
    created_with: toolVersion,
    last_observed_draft_digest: await computeDirectoryDigest(packageRoot)
  }));
  await Promise.all([
    writeIfMissing(path.join(stateRoot, "sources.yaml"), stringifyYaml({
      authoring_state_version: AUTHORING_STATE_FORMAT,
      sources: []
    })),
    writeIfMissing(path.join(stateRoot, "open-questions.yaml"), stringifyYaml({
      authoring_state_version: AUTHORING_STATE_FORMAT,
      questions: []
    }))
  ]);

  return {
    authoring_workspace_operation_version: AUTHORING_WORKSPACE_OPERATION_FORMAT,
    operation: "create",
    created,
    snapshot: await inspectAuthoringWorkspace(packageRoot, {
      stateDirectory: stateRoot,
      toolVersion
    })
  };
}

export function formatAuthoringWorkspaceCreation(result) {
  const prefix = result.created
    ? "Created SeedSpec authoring workspace."
    : "SeedSpec authoring workspace already exists.";
  return `${prefix}\n${formatAuthoringWorkspaceSnapshot(result.snapshot)}`;
}

export function formatAuthoringWorkspaceSnapshot(snapshot) {
  const packageName = snapshot.package.id
    ? `${snapshot.package.id}${snapshot.package.version ? `@${snapshot.package.version}` : ""}`
    : "unidentified draft";
  const lines = [
    "SeedSpec authoring",
    `Draft: ${packageName}`,
    `Status: ${snapshot.package.status}`,
    `Documents: ${snapshot.documents.length}`,
    `Questions: ${snapshot.review.questions.open} open, ${snapshot.review.questions.resolved} resolved`
  ];
  if (snapshot.review.current) {
    const area = snapshot.review.areas.find(({ id }) => id === snapshot.review.current.area);
    lines.push(
      `Review: ${area?.index ?? "?"} of ${snapshot.review.areas.length} — ${snapshot.review.current.area}`,
      `Current work: ${snapshot.review.current.outcome}`
    );
  } else if (snapshot.review.complete) {
    lines.push("Review: complete");
  } else {
    lines.push("Review: not started");
  }
  const diagnostics = [
    ...snapshot.package.diagnostics,
    ...snapshot.review.diagnostics
  ];
  if (diagnostics.length > 0) {
    lines.push("", "Diagnostics:");
    for (const diagnostic of diagnostics) {
      lines.push(`- [${diagnostic.code}] ${diagnostic.message}`);
    }
  }
  return lines.join("\n");
}
