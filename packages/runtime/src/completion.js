import { createHash } from "node:crypto";
import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { pathExists, readYamlFile } from "./files.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function completionScopeDigest(scope) {
  const content = JSON.stringify(canonicalize(scope));
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function validateReferenceDispositions(item) {
  const seen = new Map();
  for (const field of [
    "included_references",
    "deferred_references",
    "excluded_references"
  ]) {
    for (const reference of item[field] ?? []) {
      const previous = seen.get(reference);
      if (previous) {
        throw new SeedSpecError(
          `Completion reference appears in both ${previous} and ${field}: ${item.id}/${reference}`,
          { code: "INVALID_COMPLETION_SCOPE" }
        );
      }
      seen.set(reference, field);
    }
  }
}

export async function resolveCompletionScope(scopePath, records) {
  let items = [];
  if (scopePath) {
    const input = await readYamlFile(path.resolve(scopePath), "Completion scope");
    const validateInput = await compileProtocolSchema("completion-scope-input.schema.json");
    if (!validateInput(input)) {
      throw new SeedSpecError("Completion scope is invalid", {
        code: "INVALID_COMPLETION_SCOPE",
        details: formatSchemaErrors(validateInput.errors)
      });
    }
    items = input.items;
  }

  const packages = new Map(records.map((record) => [record.manifest.id, record]));
  const itemIds = new Set();
  const coveredPackages = new Set();
  for (const item of items) {
    if (itemIds.has(item.id)) {
      throw new SeedSpecError(`Completion scope item appears more than once: ${item.id}`, {
        code: "INVALID_COMPLETION_SCOPE"
      });
    }
    itemIds.add(item.id);

    const record = packages.get(item.package);
    if (!record) {
      throw new SeedSpecError(
        `Completion scope references an unselected package: ${item.package}`,
        { code: "INVALID_COMPLETION_SCOPE" }
      );
    }
    if (item.kind === "component") {
      if (!record.manifest.components?.acceptance) {
        throw new SeedSpecError(
          `Completion scope references acceptance material not declared by ${item.package}`,
          { code: "INVALID_COMPLETION_SCOPE" }
        );
      }
      validateReferenceDispositions(item);
    }
    if (item.kind === "component" || item.disposition === "included") {
      coveredPackages.add(item.package);
    }
  }

  const uncoveredPackages = records
    .map((record) => record.manifest.id)
    .filter((id) => !coveredPackages.has(id));
  const scope = {
    protocol_version: "0.1",
    status: uncoveredPackages.length > 0 ? "review" : "recorded",
    items,
    uncovered_packages: uncoveredPackages
  };
  const validateScope = await compileProtocolSchema("completion-scope.schema.json");
  if (!validateScope(scope)) {
    throw new SeedSpecError("Resolved completion scope is invalid", {
      code: "INVALID_COMPLETION_SCOPE",
      details: formatSchemaErrors(validateScope.errors)
    });
  }
  return scope;
}

export function createInitialVerificationState(scope) {
  return {
    protocol_version: "0.1",
    scope_digest: completionScopeDigest(scope),
    status: "not-started",
    items: scope.items
      .filter((item) => item.kind === "component" || item.disposition === "included")
      .map((item) => ({
      id: item.id,
      result: "not-run",
      evidence: []
      }))
  };
}

function duplicateIds(items) {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates].sort();
}

function deriveVerificationStatus(scope, state) {
  if (scope.status === "review") return "not-started";
  if (state.items.some((item) => item.result === "fail")) return "failed";
  if (state.items.every((item) => item.result === "not-run")) return "not-started";
  if (state.items.some((item) => item.result === "not-run")) return "in-progress";
  const deferredReferences = scope.items.some(
    (item) => (item.kind === "component" && (item.deferred_references?.length ?? 0) > 0)
      || (item.kind === "criterion" && item.disposition === "deferred")
  );
  if (deferredReferences || state.items.some((item) => item.result === "partial")) {
    return "verified-with-gaps";
  }
  return "verified";
}

export async function inspectProjectCompletion(projectPath) {
  const absolute = path.resolve(projectPath);
  const workspace = path.basename(absolute) === ".seedspec"
    ? absolute
    : path.join(absolute, ".seedspec");
  const scopePath = path.join(workspace, "completion-scope.yaml");
  const statePath = path.join(workspace, "verification-state.yaml");
  if (!await pathExists(scopePath) || !await pathExists(statePath)) {
    throw new SeedSpecError(`Completion state is missing from ${workspace}`, {
      code: "COMPLETION_STATE_NOT_FOUND"
    });
  }

  const [scope, state] = await Promise.all([
    readYamlFile(scopePath, "Resolved completion scope"),
    readYamlFile(statePath, "Verification state")
  ]);
  const [validateScope, validateState] = await Promise.all([
    compileProtocolSchema("completion-scope.schema.json"),
    compileProtocolSchema("verification-state.schema.json")
  ]);
  if (!validateScope(scope)) {
    throw new SeedSpecError("Resolved completion scope is invalid", {
      code: "INVALID_COMPLETION_SCOPE",
      details: formatSchemaErrors(validateScope.errors)
    });
  }
  if (!validateState(state)) {
    throw new SeedSpecError("Verification state is invalid", {
      code: "INVALID_VERIFICATION_STATE",
      details: formatSchemaErrors(validateState.errors)
    });
  }

  const expectedDigest = completionScopeDigest(scope);
  if (state.scope_digest !== expectedDigest) {
    throw new SeedSpecError("Verification state belongs to a different completion scope", {
      code: "STALE_VERIFICATION_STATE",
      details: [`expected ${expectedDigest}`, `received ${state.scope_digest}`]
    });
  }

  const scopeDuplicates = duplicateIds(scope.items);
  const stateDuplicates = duplicateIds(state.items);
  if (scopeDuplicates.length > 0 || stateDuplicates.length > 0) {
    throw new SeedSpecError("Completion state contains duplicate item IDs", {
      code: "INVALID_VERIFICATION_STATE",
      details: [...scopeDuplicates, ...stateDuplicates]
    });
  }
  const scopeIds = scope.items
    .filter((item) => item.kind === "component" || item.disposition === "included")
    .map((item) => item.id)
    .sort();
  const stateIds = state.items.map((item) => item.id).sort();
  if (JSON.stringify(scopeIds) !== JSON.stringify(stateIds)) {
    throw new SeedSpecError("Verification state does not cover the resolved completion scope", {
      code: "VERIFICATION_SCOPE_MISMATCH",
      details: [`scope: ${scopeIds.join(", ")}`, `state: ${stateIds.join(", ")}`]
    });
  }

  const scopedById = new Map(
    scope.items
      .filter((item) => item.kind === "component" || item.disposition === "included")
      .map((item) => [item.id, item])
  );
  for (const result of state.items) {
    const expectedSubject = scopedById.get(result.id)?.verification?.subject;
    const mismatched = result.evidence.filter(
      (evidence) => evidence.subject !== expectedSubject
    );
    if (mismatched.length > 0) {
      throw new SeedSpecError(`Verification evidence has the wrong subject: ${result.id}`, {
        code: "EVIDENCE_SUBJECT_MISMATCH",
        details: [
          `expected ${expectedSubject}`,
          ...mismatched.map((evidence) => (
            `received ${evidence.subject}: ${evidence.reference}`
          ))
        ]
      });
    }
  }

  const derivedStatus = deriveVerificationStatus(scope, state);
  if (state.status !== derivedStatus) {
    throw new SeedSpecError("Recorded verification status does not match item results", {
      code: "VERIFICATION_STATUS_MISMATCH",
      details: [`expected ${derivedStatus}`, `received ${state.status}`]
    });
  }

  return {
    workspace,
    status: scope.status === "review" ? "scope-review" : derivedStatus,
    scope,
    state
  };
}

export function formatProjectCompletion(result) {
  const lines = [
    `Completion status: ${result.status}`,
    `Scope status: ${result.scope.status}`,
    `Scoped items: ${result.scope.items.length}`
  ];
  if (result.scope.uncovered_packages.length > 0) {
    lines.push(`Uncovered packages: ${result.scope.uncovered_packages.join(", ")}`);
  }
  return lines.join("\n");
}
