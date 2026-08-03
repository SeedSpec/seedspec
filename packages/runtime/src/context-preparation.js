import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { cp, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  protocolRelease,
  protocolReleaseDigest,
  protocolVersion
} from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { canonicalDigest } from "./receipts.js";
import { pathExists, portablePath, resolvePackagePath } from "./files.js";
import {
  computeDirectoryDigest,
  computeFileDigest,
  computeSelectedDirectoryDigest
} from "./integrity.js";
import { PROTOCOL_OWNED_RESOLUTION_PATHS } from "./receipts.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";

const runtimeVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

async function regularFileDigest(filePath, label) {
  let info;
  try {
    info = await lstat(filePath);
  } catch {
    info = null;
  }
  if (!info?.isFile() || info.isSymbolicLink()) {
    throw new SeedSpecError(`${label} must be a regular file`, {
      code: "CONTEXT_BUNDLE_DIGEST_MISMATCH",
      details: [filePath]
    });
  }
  return computeFileDigest(filePath);
}

function mediaType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".md") return "text/markdown";
  if (extension === ".json") return "application/json";
  if (extension === ".yaml" || extension === ".yml") return "application/yaml";
  if (extension === ".txt") return "text/plain";
  return "application/octet-stream";
}

async function locateResolvedWorkspace(inputPath) {
  const absolute = path.resolve(inputPath);
  const info = await pathExists(absolute);
  if (!info) {
    throw new SeedSpecError(`Resolved project path does not exist: ${inputPath}`, {
      code: "RESOLVED_PROJECT_NOT_FOUND"
    });
  }
  if (info.isFile() && path.basename(absolute) === "context-index.yaml") {
    return { workspace: path.dirname(absolute), indexPath: absolute };
  }
  if (!info.isDirectory()) {
    throw new SeedSpecError(`Expected a resolved project directory: ${inputPath}`, {
      code: "RESOLVED_PROJECT_NOT_FOUND"
    });
  }
  const direct = path.join(absolute, "context-index.yaml");
  if ((await pathExists(direct))?.isFile()) return { workspace: absolute, indexPath: direct };
  const nested = path.join(absolute, ".seedspec", "context-index.yaml");
  if ((await pathExists(nested))?.isFile()) {
    return { workspace: path.dirname(nested), indexPath: nested };
  }
  throw new SeedSpecError(`No resolved context-index.yaml exists under ${inputPath}`, {
    code: "RESOLVED_PROJECT_NOT_FOUND",
    details: ["Run SeedSpec resolution before context preparation."]
  });
}

async function readAndValidate(filePath, schemaName, label) {
  let value;
  try {
    value = parseYaml(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new SeedSpecError(`${label} is not valid YAML: ${filePath}`, {
      code: "INVALID_CONTEXT_PREPARATION_INPUT",
      details: [error.message]
    });
  }
  const validate = await compileProtocolSchema(schemaName);
  if (!validate(value)) {
    throw new SeedSpecError(`${label} is invalid`, {
      code: "INVALID_CONTEXT_PREPARATION_INPUT",
      details: formatSchemaErrors(validate.errors)
    });
  }
  return value;
}

async function readResolutionReceipt(workspace) {
  const receiptPath = path.join(workspace, "resolution-receipt.json");
  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch (error) {
    throw new SeedSpecError("Resolved context requires a valid resolution receipt", {
      code: "INVALID_RESOLUTION_RECEIPT",
      details: [error.message]
    });
  }
  const validate = await compileProtocolSchema("resolution-receipt.schema.json");
  if (!validate(receipt)) {
    throw new SeedSpecError("Resolution receipt is invalid", {
      code: "INVALID_RESOLUTION_RECEIPT",
      details: formatSchemaErrors(validate.errors)
    });
  }
  const expectedId = canonicalDigest(receipt.subject);
  if (receipt.receipt_id !== expectedId) {
    throw new SeedSpecError("Resolution receipt identity does not match its subject", {
      code: "INVALID_RESOLUTION_RECEIPT",
      details: [`declared ${receipt.receipt_id}`, `computed ${expectedId}`]
    });
  }
  if (
    receipt.subject.protocol_release.id !== protocolRelease.release_id
    || receipt.subject.protocol_release.digest !== protocolReleaseDigest
  ) {
    throw new SeedSpecError("Resolution receipt uses a different protocol release", {
      code: "INVALID_RESOLUTION_RECEIPT"
    });
  }
  const outputDigest = await computeSelectedDirectoryDigest(
    workspace,
    PROTOCOL_OWNED_RESOLUTION_PATHS
  );
  if (receipt.subject.result.output_digest !== outputDigest) {
    throw new SeedSpecError("Resolved protocol-owned bytes changed after resolution", {
      code: "INVALID_RESOLUTION_RECEIPT",
      details: [
        `declared ${receipt.subject.result.output_digest}`,
        `computed ${outputDigest}`
      ]
    });
  }
  return receipt;
}

function matchesAny(values, requested) {
  return values.some((value) => requested.includes(value));
}

export function contextApplies(applicability, request) {
  if (!applicability) return true;
  if (applicability.purposes && !applicability.purposes.includes(request.purpose)) return false;
  if (applicability.audiences && !matchesAny(applicability.audiences, request.audiences)) return false;
  if (applicability.capabilities && !matchesAny(applicability.capabilities, request.capabilities ?? [])) return false;
  if (applicability.targets && !matchesAny(applicability.targets, request.targets ?? [])) return false;
  return true;
}

function resolveSelector(selector, modules) {
  if (selector.includes("/")) {
    return modules.find((module) => module.qualified_id === selector) ?? null;
  }
  const matches = modules.filter((module) => module.id === selector);
  if (matches.length > 1) {
    throw new SeedSpecError(`Context module selector is ambiguous: ${selector}`, {
      code: "AMBIGUOUS_CONTEXT_MODULE",
      details: matches.map((module) => module.qualified_id)
    });
  }
  return matches[0] ?? null;
}

function selectorSet(selectors, modules, label) {
  const selected = new Set();
  for (const selector of selectors ?? []) {
    const module = resolveSelector(selector, modules);
    if (!module) {
      throw new SeedSpecError(`${label} references an unknown context module: ${selector}`, {
        code: "CONTEXT_MODULE_NOT_FOUND"
      });
    }
    selected.add(module.qualified_id);
  }
  return selected;
}

function adapterSelections(request, modules) {
  const selections = new Map();
  for (const selection of request.adapter_selections ?? []) {
    const module = resolveSelector(selection.module, modules);
    if (!module) {
      throw new SeedSpecError(`Adapter selection references an unknown context module: ${selection.module}`, {
        code: "CONTEXT_MODULE_NOT_FOUND"
      });
    }
    if (selections.has(module.qualified_id)) {
      throw new SeedSpecError(`Adapter selected more than once for ${module.qualified_id}`, {
        code: "AMBIGUOUS_CONTEXT_ADAPTER"
      });
    }
    selections.set(module.qualified_id, selection.adapter);
  }
  return selections;
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

function sourcePathsFromMarkdown(source) {
  const candidates = new Set();
  const patterns = [
    /\[[^\]]*\]\(([^)\s]+)\)/gu,
    /`([^`\n]+)`/gu
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const candidate = match[1].split("#")[0].split("?")[0];
      if (
        !candidate
        || candidate.includes("://")
        || path.isAbsolute(candidate)
        || (!candidate.includes("/") && !candidate.includes("."))
      ) continue;
      candidates.add(candidate);
    }
  }
  return [...candidates].sort();
}

async function includedSourcePaths(moduleRoot, module, adapterFiles = []) {
  const paths = new Set([module.entrypoint]);
  const entrypoint = resolvePackagePath(moduleRoot, module.entrypoint);
  const source = await readFile(entrypoint, "utf8");
  for (const candidate of [...sourcePathsFromMarkdown(source), ...adapterFiles]) {
    if (typeof candidate !== "string" || !candidate) {
      throw new SeedSpecError(`Adapter returned an invalid supporting file for ${module.qualified_id}`, {
        code: "INVALID_CONTEXT_ADAPTER_RESULT"
      });
    }
    const absolute = resolvePackagePath(moduleRoot, candidate);
    if ((await pathExists(absolute))?.isFile()) paths.add(candidate);
  }
  return [...paths].sort();
}

function moduleRoot(workspace, module) {
  if (module.availability !== "materialized" || !module.root || !module.content_digest) return null;
  return resolvePackagePath(workspace, module.root);
}

async function verifyMaterializedModule(module, root) {
  const entrypoint = resolvePackagePath(root, module.entrypoint);
  await regularFileDigest(entrypoint, `Resolved context entrypoint ${module.qualified_id}`);
  const observedDigest = module.content_digest_scope === "entrypoint"
    ? await computeFileDigest(entrypoint)
    : await computeDirectoryDigest(root);
  if (observedDigest !== module.content_digest) {
    throw new SeedSpecError(`Resolved context module digest does not match: ${module.qualified_id}`, {
      code: "CONTEXT_MODULE_DIGEST_MISMATCH",
      details: [`declared ${module.content_digest}`, `computed ${observedDigest}`]
    });
  }
  return entrypoint;
}

async function copyIncludedFiles({ sourceRoot, selectedPaths, staging, outputRoot }) {
  const included = [];
  for (const selectedPath of selectedPaths) {
    const source = resolvePackagePath(sourceRoot, selectedPath);
    const targetRelative = portablePath(outputRoot, "source", selectedPath);
    const target = resolvePackagePath(staging, targetRelative);
    await mkdir(path.dirname(target), { recursive: true });
    const digest = await regularFileDigest(source, `Context source file ${selectedPath}`);
    await cp(source, target);
    included.push({
      path: selectedPath,
      digest,
      media_type: mediaType(selectedPath)
    });
  }
  return included;
}

async function selectedBridges(workspace, module, modules, request) {
  const selected = [];
  for (const binding of module.bridges ?? []) {
    if (!contextApplies(binding.applies_to, request)) continue;
    const bridge = modules.find((candidate) => candidate.qualified_id === binding.skill);
    if (!bridge) {
      throw new SeedSpecError(`Context bridge references an unknown Skill: ${binding.skill}`, {
        code: "CONTEXT_MODULE_NOT_FOUND"
      });
    }
    if (!moduleRoot(workspace, bridge)) continue;
    selected.push(bridge);
  }
  return selected;
}

async function prepareModule({
  workspace,
  staging,
  module,
  modules,
  request,
  registry,
  selectedAdapter
}) {
  const root = moduleRoot(workspace, module);
  if (!root) return null;
  const entrypoint = await verifyMaterializedModule(module, root);

  const adapter = registry?.match(module, "prepare", selectedAdapter) ?? null;
  let preparedText;
  let supportingFiles = [];
  let validation = { status: "not-run", issues: [] };
  let mechanism;

  if (adapter) {
    const adapterInput = { module, root, entrypoint, request };
    let result;
    try {
      result = await adapter.prepare(adapterInput);
    } catch (error) {
      throw new SeedSpecError(`Context adapter failed while preparing ${module.qualified_id}`, {
        code: "CONTEXT_ADAPTER_EXECUTION_FAILED",
        details: [adapter.id, error?.message ?? String(error)]
      });
    }
    if (!result || typeof result.text !== "string" || !result.text.trim()) {
      throw new SeedSpecError(`Adapter ${adapter.id} returned no prepared context`, {
        code: "INVALID_CONTEXT_ADAPTER_RESULT",
        details: [module.qualified_id]
      });
    }
    preparedText = result.text;
    supportingFiles = result.supporting_files ?? [];
    if (!Array.isArray(supportingFiles)) {
      throw new SeedSpecError(`Adapter ${adapter.id} returned invalid supporting files`, {
        code: "INVALID_CONTEXT_ADAPTER_RESULT"
      });
    }
    if (adapter.capabilities.includes("validate")) {
      let validationResult;
      try {
        validationResult = await adapter.validate(adapterInput);
      } catch (error) {
        throw new SeedSpecError(`Context adapter failed while validating ${module.qualified_id}`, {
          code: "CONTEXT_ADAPTER_EXECUTION_FAILED",
          details: [adapter.id, error?.message ?? String(error)]
        });
      }
      const issues = normalizeIssues(validationResult?.issues);
      const valid = validationResult?.valid === true
        && !issues.some((issue) => issue.severity === "error");
      validation = { status: valid ? "valid" : "invalid", issues };
    }
    mechanism = {
      kind: "native-adapter",
      adapter: adapter.id,
      version: adapter.version
    };
  } else {
    const bridges = await selectedBridges(workspace, module, modules, request);
    const targetText = await readFile(entrypoint, "utf8");
    if (bridges.length > 0) {
      const bridgeSections = [];
      const skills = [];
      for (const bridge of bridges) {
        const bridgeRoot = moduleRoot(workspace, bridge);
        const bridgeEntrypoint = await verifyMaterializedModule(bridge, bridgeRoot);
        const bridgeText = await readFile(bridgeEntrypoint, "utf8");
        bridgeSections.push(`## Bridge instructions: ${bridge.qualified_id}\n\n${bridgeText.trim()}`);
        const bridgePath = portablePath("bridges", bridge.package, bridge.id);
        const bridgeDestination = resolvePackagePath(staging, bridgePath);
        await mkdir(path.dirname(bridgeDestination), { recursive: true });
        await cp(bridgeRoot, bridgeDestination, { recursive: true });
        skills.push({
          skill: bridge.qualified_id,
          digest: await computeDirectoryDigest(bridgeDestination),
          path: `${bridgePath}/`
        });
      }
      preparedText = [
        `# Prepared context: ${module.qualified_id}`,
        ...bridgeSections,
        `## Context module\n\n${targetText.trim()}`
      ].join("\n\n");
      mechanism = { kind: "bridge-skills", skills };
    } else {
      preparedText = targetText;
      mechanism = { kind: "plain-markdown" };
    }
  }

  const outputRoot = portablePath("modules", module.package, module.id);
  const selectedPaths = await includedSourcePaths(root, module, supportingFiles);
  const includedFiles = await copyIncludedFiles({
    sourceRoot: root,
    selectedPaths,
    staging,
    outputRoot
  });
  const preparedPath = portablePath(outputRoot, "CONTEXT.md");
  const preparedFile = resolvePackagePath(staging, preparedPath);
  await mkdir(path.dirname(preparedFile), { recursive: true });
  await writeFile(preparedFile, preparedText.endsWith("\n") ? preparedText : `${preparedText}\n`, "utf8");

  return {
    module: module.qualified_id,
    role: module.role,
    format: module.format,
    ...(module.format_version ? { format_version: module.format_version } : {}),
    source_digest: module.content_digest,
    mechanism,
    included_files: includedFiles,
    output: {
      path: preparedPath,
      digest: await computeFileDigest(preparedFile)
    },
    validation
  };
}

function receiptMechanism(mechanism) {
  if (mechanism.kind === "native-adapter") {
    return { kind: mechanism.kind, id: mechanism.adapter, version: mechanism.version };
  }
  if (mechanism.kind === "bridge-skills") {
    return {
      kind: mechanism.kind,
      skills: mechanism.skills.map((skill) => ({ id: skill.skill, digest: skill.digest }))
    };
  }
  return { kind: mechanism.kind };
}

async function commitDirectory(staging, output) {
  const existing = await pathExists(output);
  const backup = `${output}.backup-${randomUUID()}`;
  if (existing) await rename(output, backup);
  try {
    await rename(staging, output);
  } catch (error) {
    if (existing) await rename(backup, output);
    throw error;
  }
  if (existing) await rm(backup, { recursive: true, force: true });
}

export async function prepareContext(inputPath, requestPath, outputPath, {
  registry = null
} = {}) {
  const { workspace, indexPath } = await locateResolvedWorkspace(inputPath);
  const request = await readAndValidate(
    path.resolve(requestPath),
    "context-request.schema.json",
    "Context request"
  );
  const index = await readAndValidate(
    indexPath,
    "context-index.schema.json",
    "Context index"
  );
  const resolutionReceipt = await readResolutionReceipt(workspace);
  const modules = index.modules;
  const includes = selectorSet(request.include_modules, modules, "Context request include_modules");
  const excludes = selectorSet(request.exclude_modules, modules, "Context request exclude_modules");
  const selections = adapterSelections(request, modules);
  const bridgeModules = new Set(
    modules.flatMap((module) => (module.bridges ?? []).map((bridge) => bridge.skill))
  );

  const output = path.resolve(outputPath);
  if (isWithin(workspace, output) || isWithin(output, workspace)) {
    throw new SeedSpecError("Prepared context output must remain separate from the resolved workspace", {
      code: "UNSAFE_CONTEXT_OUTPUT",
      details: [`workspace: ${workspace}`, `output: ${output}`]
    });
  }
  const staging = `${output}.staging-${randomUUID()}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  const preparedModules = [];
  const excludedModules = [];
  try {
    for (const module of modules) {
      const primary = module.role === "primary-intent";
      const explicitlyIncluded = includes.has(module.qualified_id);
      let reason = null;
      if (primary && module.availability !== "materialized") {
        throw new SeedSpecError("Primary intent is unavailable for context preparation", {
          code: "CONTEXT_MODULE_UNAVAILABLE",
          details: [module.qualified_id]
        });
      }
      if (excludes.has(module.qualified_id) && !primary) reason = "explicitly-excluded";
      else if (module.availability !== "materialized") reason = "unavailable";
      else if (
        !primary
        && !explicitlyIncluded
        && (bridgeModules.has(module.qualified_id) || !contextApplies(module.applies_to, request))
      ) reason = "not-applicable";

      if (reason) {
        excludedModules.push({ module: module.qualified_id, reason });
        continue;
      }
      const prepared = await prepareModule({
        workspace,
        staging,
        module,
        modules,
        request,
        registry,
        selectedAdapter: selections.get(module.qualified_id) ?? null
      });
      if (!prepared) {
        excludedModules.push({ module: module.qualified_id, reason: "unavailable" });
      } else {
        preparedModules.push(prepared);
      }
    }

    const requestDigest = canonicalDigest(request);
    const contextIndexDigest = await computeFileDigest(indexPath);
    const bundleSubject = {
      bundle_version: "1",
      protocol_version: protocolVersion,
      request: {
        digest: requestDigest,
        summary: request.summary,
        purpose: request.purpose,
        audiences: request.audiences,
        ...(request.capabilities ? { capabilities: request.capabilities } : {}),
        ...(request.targets ? { targets: request.targets } : {})
      },
      source: {
        context_index_digest: contextIndexDigest,
        resolution_receipt: resolutionReceipt.receipt_id
      },
      modules: preparedModules,
      excluded_modules: excludedModules
    };
    const bundle = { ...bundleSubject, bundle_id: canonicalDigest(bundleSubject) };
    const validateBundle = await compileProtocolSchema("context-bundle.schema.json");
    if (!validateBundle(bundle)) {
      throw new SeedSpecError("Context preparation produced an invalid bundle", {
        code: "INVALID_CONTEXT_BUNDLE",
        details: formatSchemaErrors(validateBundle.errors)
      });
    }
    const bundlePath = path.join(staging, "context-bundle.yaml");
    await writeFile(bundlePath, stringifyYaml(bundle), "utf8");
    const bundleDigest = await computeFileDigest(bundlePath);

    const receiptSubject = {
      operation: "prepare-context",
      protocol_release: {
        id: protocolRelease.release_id,
        digest: protocolReleaseDigest
      },
      resolution_receipt: resolutionReceipt.receipt_id,
      context_index_digest: contextIndexDigest,
      request_digest: requestDigest,
      modules: preparedModules.map((module) => ({
        module: module.module,
        source_digest: module.source_digest,
        mechanism: receiptMechanism(module.mechanism)
      })),
      result: { bundle_id: bundle.bundle_id, bundle_digest: bundleDigest }
    };
    const receipt = {
      receipt_version: "1",
      receipt_id: canonicalDigest(receiptSubject),
      subject: receiptSubject,
      producer: { name: "@seedspec/runtime", version: runtimeVersion }
    };
    const validateReceipt = await compileProtocolSchema("context-preparation-receipt.schema.json");
    if (!validateReceipt(receipt)) {
      throw new SeedSpecError("Context preparation produced an invalid receipt", {
        code: "INVALID_CONTEXT_PREPARATION_RECEIPT",
        details: formatSchemaErrors(validateReceipt.errors)
      });
    }
    await writeFile(
      path.join(staging, "preparation-receipt.json"),
      `${JSON.stringify(receipt, null, 2)}\n`,
      "utf8"
    );
    await commitDirectory(staging, output);
    return { output, bundle, receipt };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function verifyPreparedBundleFiles(preparedRoot, bundle) {
  for (const module of bundle.modules) {
    const output = resolvePackagePath(preparedRoot, module.output.path);
    const outputDigest = await regularFileDigest(output, `Prepared output ${module.module}`);
    if (outputDigest !== module.output.digest) {
      throw new SeedSpecError(`Prepared context output changed: ${module.module}`, {
        code: "CONTEXT_BUNDLE_DIGEST_MISMATCH",
        details: [`declared ${module.output.digest}`, `computed ${outputDigest}`]
      });
    }
    const moduleOutputRoot = path.posix.dirname(module.output.path);
    for (const included of module.included_files) {
      const source = resolvePackagePath(
        preparedRoot,
        portablePath(moduleOutputRoot, "source", included.path)
      );
      const digest = await regularFileDigest(source, `Prepared source ${included.path}`);
      if (digest !== included.digest) {
        throw new SeedSpecError(`Prepared context source changed: ${module.module}/${included.path}`, {
          code: "CONTEXT_BUNDLE_DIGEST_MISMATCH",
          details: [`declared ${included.digest}`, `computed ${digest}`]
        });
      }
    }
    if (module.mechanism.kind === "bridge-skills") {
      for (const skill of module.mechanism.skills) {
        const bridgeRoot = resolvePackagePath(preparedRoot, skill.path);
        const digest = await computeDirectoryDigest(bridgeRoot);
        if (digest !== skill.digest) {
          throw new SeedSpecError(`Prepared bridge Skill changed: ${skill.skill}`, {
            code: "CONTEXT_BUNDLE_DIGEST_MISMATCH",
            details: [`declared ${skill.digest}`, `computed ${digest}`]
          });
        }
      }
    }
  }
}

function assertUseOutputSafe(preparedRoot, output) {
  if (isWithin(output, preparedRoot)) {
    throw new SeedSpecError("Context use output must not replace the prepared bundle", {
      code: "UNSAFE_CONTEXT_OUTPUT"
    });
  }
  if (!isWithin(preparedRoot, output)) return;
  const relative = path.relative(preparedRoot, output).split(path.sep).join("/");
  if (
    relative === "context-bundle.yaml"
    || relative === "preparation-receipt.json"
    || relative === "modules"
    || relative.startsWith("modules/")
    || relative === "bridges"
    || relative.startsWith("bridges/")
  ) {
    throw new SeedSpecError("Context use output must not replace prepared context bytes", {
      code: "UNSAFE_CONTEXT_OUTPUT",
      details: [relative]
    });
  }
}

async function writeFileAtomic(target, content) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.staging-${randomUUID()}`;
  try {
    await writeFile(temporary, content, "utf8");
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function recordContextUse(preparedPath, usage, outputPath) {
  const preparedRoot = path.resolve(preparedPath);
  const bundlePath = path.join(preparedRoot, "context-bundle.yaml");
  const receiptPath = path.join(preparedRoot, "preparation-receipt.json");
  const bundle = await readAndValidate(bundlePath, "context-bundle.schema.json", "Context bundle");
  const preparationReceipt = JSON.parse(await readFile(receiptPath, "utf8"));
  const validatePreparationReceipt = await compileProtocolSchema(
    "context-preparation-receipt.schema.json"
  );
  if (!validatePreparationReceipt(preparationReceipt)) {
    throw new SeedSpecError("Preparation receipt is invalid", {
      code: "INVALID_CONTEXT_PREPARATION_RECEIPT",
      details: formatSchemaErrors(validatePreparationReceipt.errors)
    });
  }
  const bundleSubject = { ...bundle };
  delete bundleSubject.bundle_id;
  const expectedBundleId = canonicalDigest(bundleSubject);
  if (bundle.bundle_id !== expectedBundleId) {
    throw new SeedSpecError("Context bundle identity does not match its contents", {
      code: "CONTEXT_BUNDLE_DIGEST_MISMATCH",
      details: [`declared ${bundle.bundle_id}`, `computed ${expectedBundleId}`]
    });
  }
  const expectedPreparationReceiptId = canonicalDigest(preparationReceipt.subject);
  if (preparationReceipt.receipt_id !== expectedPreparationReceiptId) {
    throw new SeedSpecError("Preparation receipt identity does not match its subject", {
      code: "INVALID_CONTEXT_PREPARATION_RECEIPT",
      details: [
        `declared ${preparationReceipt.receipt_id}`,
        `computed ${expectedPreparationReceiptId}`
      ]
    });
  }
  if (
    preparationReceipt.subject.protocol_release.id !== protocolRelease.release_id
    || preparationReceipt.subject.protocol_release.digest !== protocolReleaseDigest
    || preparationReceipt.subject.resolution_receipt !== bundle.source.resolution_receipt
    || preparationReceipt.subject.context_index_digest !== bundle.source.context_index_digest
    || preparationReceipt.subject.request_digest !== bundle.request.digest
  ) {
    throw new SeedSpecError("Preparation receipt does not bind this bundle source", {
      code: "CONTEXT_BUNDLE_RECEIPT_MISMATCH"
    });
  }
  if (preparationReceipt.subject.result.bundle_id !== bundle.bundle_id) {
    throw new SeedSpecError("Preparation receipt does not bind this context bundle", {
      code: "CONTEXT_BUNDLE_RECEIPT_MISMATCH"
    });
  }
  const observedBundleDigest = await computeFileDigest(bundlePath);
  if (preparationReceipt.subject.result.bundle_digest !== observedBundleDigest) {
    throw new SeedSpecError("Prepared context bundle bytes changed after preparation", {
      code: "CONTEXT_BUNDLE_DIGEST_MISMATCH",
      details: [
        `declared ${preparationReceipt.subject.result.bundle_digest}`,
        `computed ${observedBundleDigest}`
      ]
    });
  }
  await verifyPreparedBundleFiles(preparedRoot, bundle);
  const knownModules = new Set(bundle.modules.map((module) => module.module));
  if (!usage || typeof usage !== "object" || !Array.isArray(usage.modules)) {
    throw new SeedSpecError("Context use input must contain a modules array", {
      code: "INVALID_CONTEXT_USE"
    });
  }
  const reportedModules = new Set();
  for (const module of usage.modules) {
    if (!knownModules.has(module.module)) {
      throw new SeedSpecError(`Context use references a module outside the bundle: ${module.module}`, {
        code: "INVALID_CONTEXT_USE"
      });
    }
    if (reportedModules.has(module.module)) {
      throw new SeedSpecError(`Context use repeats module: ${module.module}`, {
        code: "INVALID_CONTEXT_USE"
      });
    }
    reportedModules.add(module.module);
  }
  const omitted = [...knownModules].filter((module) => !reportedModules.has(module));
  if (omitted.length > 0) {
    throw new SeedSpecError("Context use must report every prepared module", {
      code: "INVALID_CONTEXT_USE",
      details: omitted
    });
  }
  const subject = {
    operation: "record-context-use",
    preparation_receipt: preparationReceipt.receipt_id,
    bundle_id: bundle.bundle_id,
    modules: usage.modules
  };
  const receipt = {
    receipt_version: "1",
    receipt_id: canonicalDigest(subject),
    subject,
    consumer: usage.consumer,
    producer: { name: "@seedspec/runtime", version: runtimeVersion },
    observed_at: usage.observed_at ?? new Date().toISOString()
  };
  const validate = await compileProtocolSchema("context-use-receipt.schema.json");
  if (!validate(receipt)) {
    throw new SeedSpecError("Context use receipt is invalid", {
      code: "INVALID_CONTEXT_USE_RECEIPT",
      details: formatSchemaErrors(validate.errors)
    });
  }
  const output = path.resolve(outputPath);
  assertUseOutputSafe(preparedRoot, output);
  await writeFileAtomic(output, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export function formatContextPreparation(result) {
  return [
    `Prepared context: ${result.output}`,
    `Bundle: ${result.bundle.bundle_id}`,
    `Included modules: ${result.bundle.modules.length}`,
    `Excluded modules: ${result.bundle.excluded_modules.length}`,
    `Receipt: ${result.receipt.receipt_id}`
  ].join("\n");
}
