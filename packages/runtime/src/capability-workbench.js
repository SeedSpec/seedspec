import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { buildSearchCorpus } from "./search-corpus.js";
import { SeedSpecError } from "./errors.js";
import { pathExists, resolvePackagePath } from "./files.js";
import { canonicalDigest } from "./receipts.js";
import { compileConfigurationSchema, formatSchemaErrors } from "./schema.js";
import { validatePackage } from "./validate.js";

export const CAPABILITY_BUNDLE_VERSION = "0.4-experimental";
export const CAPABILITY_STAGE_REPORT_VERSION = "0.4-experimental";

const schemaDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "schemas",
  "capabilities",
  "v1"
);

const schemaFiles = Object.freeze({
  bundle: "capability-bundle.schema.json",
  proposal: "capability-proposal-output.schema.json",
  composition: "capability-composition.schema.json",
  evidence: "capability-stage-evidence.schema.json"
});
const validators = new Map();

async function validator(name) {
  if (!validators.has(name)) {
    const file = schemaFiles[name];
    if (!file) throw new Error(`Unknown capability schema: ${name}`);
    const schema = JSON.parse(await readFile(path.join(schemaDirectory, file), "utf8"));
    validators.set(name, compileConfigurationSchema(schema));
  }
  return validators.get(name);
}

function fail(message, code, details = []) {
  throw new SeedSpecError(message, { code, details });
}

function assertSchema(validate, value, label) {
  if (!validate(value)) {
    fail(`${label} is invalid`, "INVALID_CAPABILITY_WORKBENCH_ARTIFACT", formatSchemaErrors(validate.errors));
  }
}

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function bundleSubject(bundle) {
  const { bundle_digest: _digest, ...subject } = bundle;
  return subject;
}

export function capabilityBundleDigest(bundle) {
  return canonicalDigest(bundleSubject(bundle));
}

async function readYamlArtifact(filePath, label) {
  let value;
  try {
    value = parseYaml(await readFile(path.resolve(filePath), "utf8"));
  } catch (error) {
    fail(`${label} is not readable YAML`, "INVALID_CAPABILITY_WORKBENCH_ARTIFACT", [error.message]);
  }
  return value;
}

async function packageSections(record) {
  const corpus = await buildSearchCorpus(record);
  return corpus.index.sections.filter((section) => (
    section.scope === "package" && section.package === record.manifest.id
  ));
}

function endpointKey(endpoint) {
  return `${endpoint.capability}\0${endpoint.edge}`;
}

function outcomeKey(capability, outcome) {
  return `${capability.id}\0${outcome.id}`;
}

function checkKey(capability, outcome, check) {
  return `${capability.id}\0${outcome.id}\0${check.id}`;
}

function packageRecordMap(rootRecord) {
  const records = new Map();
  function visit(record) {
    if (records.has(record.manifest.id)) return;
    records.set(record.manifest.id, record);
    for (const edge of record.composition.includes) visit(edge.record);
  }
  visit(rootRecord);
  return records;
}

function verifyUniqueBundleIds(bundle) {
  const issues = [];
  for (const id of duplicates(bundle.capabilities.map((item) => item.id))) {
    issues.push(`capability ID is repeated: ${id}`);
  }
  for (const capability of bundle.capabilities) {
    for (const id of duplicates(capability.outcomes.map((item) => item.id))) {
      issues.push(`${capability.id} repeats outcome ID: ${id}`);
    }
    const edges = [
      ...(capability.integration?.offers ?? []),
      ...(capability.integration?.needs ?? [])
    ];
    for (const id of duplicates(edges.map((item) => item.id))) {
      issues.push(`${capability.id} repeats integration edge ID: ${id}`);
    }
    for (const outcome of capability.outcomes) {
      for (const id of duplicates(outcome.acceptance.map((item) => item.id))) {
        issues.push(`${capability.id}/${outcome.id} repeats acceptance check ID: ${id}`);
      }
    }
  }
  if (issues.length > 0) fail("Capability bundle repeats identifiers", "INVALID_CAPABILITY_BUNDLE", issues);
}

async function validateBundleAgainstRecord(record, bundle, { requireAccepted = false } = {}) {
  assertSchema(await validator("bundle"), bundle, "Capability bundle");
  verifyUniqueBundleIds(bundle);
  const expectedBinding = {
    id: record.manifest.id,
    version: record.manifest.version,
    digest: record.digest
  };
  for (const field of ["id", "version", "digest"]) {
    if (bundle.package[field] !== expectedBinding[field]) {
      fail("Capability bundle belongs to different package bytes", "STALE_CAPABILITY_BUNDLE", [
        `${field}: expected ${expectedBinding[field]}, received ${bundle.package[field]}`
      ]);
    }
  }
  if (requireAccepted && bundle.authorship.status !== "accepted") {
    fail("Capability bundle has not been accepted by the author", "CAPABILITY_BUNDLE_NOT_ACCEPTED");
  }
  if (bundle.authorship.status === "accepted") {
    const digest = capabilityBundleDigest(bundle);
    if (bundle.bundle_digest !== digest) {
      fail("Capability bundle digest does not match its accepted contents", "STALE_CAPABILITY_BUNDLE", [
        `expected ${digest}`,
        `received ${bundle.bundle_digest}`
      ]);
    }
  }

  const sections = await packageSections(record);
  const availableRefs = new Set(sections.map((section) => section.id));
  const unknownRefs = [];
  for (const capability of bundle.capabilities) {
    for (const sourceRef of capability.source_refs) {
      if (!availableRefs.has(sourceRef)) unknownRefs.push(`${capability.id}: ${sourceRef}`);
    }
    for (const outcome of capability.outcomes) {
      for (const sourceRef of outcome.source_refs) {
        if (!availableRefs.has(sourceRef)) {
          unknownRefs.push(`${capability.id}/${outcome.id}: ${sourceRef}`);
        }
      }
      for (const check of outcome.acceptance) {
        if (check.verification.kind !== "script") continue;
        const scriptPath = resolvePackagePath(record.root, check.verification.path);
        if (!(await pathExists(scriptPath))?.isFile()) {
          fail("Capability verification script is missing", "INVALID_CAPABILITY_BUNDLE", [
            `${capability.id}/${outcome.id}/${check.id}: ${check.verification.path}`
          ]);
        }
      }
    }
  }
  if (unknownRefs.length > 0) {
    fail("Capability bundle contains stale or foreign source references", "STALE_CAPABILITY_BUNDLE", unknownRefs);
  }
  return { record, bundle, sections };
}

export async function validateCapabilityBundle(inputPath, bundlePath, options = {}) {
  const [record, bundle] = await Promise.all([
    validatePackage(inputPath),
    readYamlArtifact(bundlePath, "Capability bundle")
  ]);
  return validateBundleAgainstRecord(record, bundle, options);
}

function extractionPrompt(packageId) {
  return [
    `Extract a small set of proposed capabilities from ${packageId}.`,
    "",
    "The kit contains only source-bound package sections. Treat them as authority.",
    "A capability is an observable product contract and acceptance rubric, not a component, endpoint, screen, datastore, or implementation method.",
    "Do not create a capability for every sentence. Select only behavior whose explicit verification would reduce material implementation drift or define a reusable integration edge.",
    "Preserve uncertainty. Do not fill gaps from generic product patterns.",
    "Cite the exact section IDs supporting every capability and outcome.",
    "Give every outcome at least one acceptance check. Use script, agent-review, or human-observation verification without claiming deterministic proof for nondeterministic checks.",
    "Describe integration offers and needs in package-local language. Do not invent a universal taxonomy or require another author to share identifiers.",
    "Write a proposed bundle that conforms to capability-bundle.schema.json. Keep authorship.status set to proposed.",
    "Do not edit the SeedSpec package. The author accepts or rejects the proposal separately."
  ].join("\n");
}

export async function prepareCapabilityExtraction(inputPath, outputDirectory) {
  const record = await validatePackage(inputPath);
  const output = path.resolve(outputDirectory);
  const relation = path.relative(record.root, output);
  if (!relation.startsWith("..") && !path.isAbsolute(relation)) {
    fail("Capability extraction output must remain outside the package", "UNSAFE_CAPABILITY_OUTPUT");
  }
  const outputs = ["extraction-kit.json", "PROMPT.md", "capability-proposal.schema.json"];
  for (const filename of outputs) {
    if (await pathExists(path.join(output, filename))) {
      fail("Capability extraction output already exists", "CAPABILITY_OUTPUT_EXISTS", [path.join(output, filename)]);
    }
  }
  const sections = await packageSections(record);
  const kit = {
    capability_extraction_version: CAPABILITY_BUNDLE_VERSION,
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    instructions: "PROMPT.md",
    output_schema: "capability-proposal.schema.json",
    sections
  };
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(path.join(output, "extraction-kit.json"), `${JSON.stringify(kit, null, 2)}\n`, { flag: "wx" }),
    writeFile(path.join(output, "PROMPT.md"), `${extractionPrompt(record.manifest.id)}\n`, { flag: "wx" }),
    writeFile(
      path.join(output, "capability-proposal.schema.json"),
      await readFile(path.join(schemaDirectory, schemaFiles.proposal)),
      { flag: "wx" }
    )
  ]);
  return { output, package: kit.package, sections: sections.length, files: outputs };
}

export async function acceptCapabilityBundle(inputPath, bundlePath, {
  acceptedBy,
  outputPath,
  acceptedAt = new Date().toISOString()
}) {
  if (!acceptedBy?.trim()) fail("Accepted capability bundles require an author identity", "CAPABILITY_ACCEPTANCE_REQUIRED");
  const { record, bundle } = await validateCapabilityBundle(inputPath, bundlePath);
  if (bundle.authorship.status !== "proposed") {
    fail("Only a proposed capability bundle can be accepted", "CAPABILITY_BUNDLE_ALREADY_DISPOSED");
  }
  const accepted = {
    ...bundle,
    authorship: {
      status: "accepted",
      accepted_by: acceptedBy.trim(),
      accepted_at: acceptedAt
    }
  };
  accepted.bundle_digest = capabilityBundleDigest(accepted);
  await validateBundleAgainstRecord(record, accepted, { requireAccepted: true });
  const destination = path.resolve(outputPath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, stringifyYaml(accepted), { flag: "wx" });
  return { output: destination, bundle: accepted };
}

function stageReport(stage, checks, bindings) {
  return {
    capability_stage_report_version: CAPABILITY_STAGE_REPORT_VERSION,
    stage,
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    bundles: bindings,
    checks
  };
}

function authoringChecks(validated) {
  return validated.flatMap(({ bundle }) => bundle.capabilities.flatMap((capability) => [
    {
      id: `${capability.id}/source-grounding`,
      status: "pass",
      description: `${capability.source_refs.length} capability source reference(s) remain bound to package bytes.`
    },
    ...capability.outcomes.map((outcome) => ({
      id: `${capability.id}/${outcome.id}`,
      status: "pass",
      description: `${outcome.acceptance.length} acceptance check(s) cover this source-backed outcome.`
    }))
  ]));
}

async function compositionChecks(validated, evidencePath) {
  const composition = await readYamlArtifact(evidencePath, "Capability composition map");
  assertSchema(await validator("composition"), composition, "Capability composition map");
  const expectedBindings = validated.map(({ bundle }) => ({
    package: bundle.package.id,
    bundle_digest: bundle.bundle_digest
  })).sort((left, right) => left.package.localeCompare(right.package));
  const receivedBindings = [...composition.bundles]
    .sort((left, right) => left.package.localeCompare(right.package));
  if (JSON.stringify(expectedBindings) !== JSON.stringify(receivedBindings)) {
    fail("Composition map does not bind the selected capability bundles", "CAPABILITY_COMPOSITION_SCOPE_MISMATCH");
  }
  const needs = new Map();
  const offers = new Set();
  for (const { bundle } of validated) {
    for (const capability of bundle.capabilities) {
      for (const edge of capability.integration?.needs ?? []) {
        needs.set(endpointKey({ capability: capability.id, edge: edge.id }), edge);
      }
      for (const edge of capability.integration?.offers ?? []) {
        offers.add(endpointKey({ capability: capability.id, edge: edge.id }));
      }
    }
  }
  const mappedNeeds = new Set();
  const issues = [];
  for (const connection of composition.connections) {
    const need = endpointKey(connection.need);
    const offer = endpointKey(connection.offer);
    if (!needs.has(need)) issues.push(`unknown need endpoint: ${need.replace("\0", "/")}`);
    if (!offers.has(offer)) issues.push(`unknown offer endpoint: ${offer.replace("\0", "/")}`);
    mappedNeeds.add(need);
  }
  const checks = [...needs.entries()].map(([key, edge]) => ({
    id: key.replace("\0", "/"),
    status: !edge.required || mappedNeeds.has(key) ? "pass" : "fail",
    description: edge.required && !mappedNeeds.has(key)
      ? "Required integration need has no agent-authored connection."
      : "Integration need is optional or has an agent-authored connection."
  }));
  checks.push(...issues.map((description, index) => ({
    id: `composition-invalid-${index + 1}`,
    status: "fail",
    description
  })));
  return checks;
}

async function evidenceChecks(validated, stage, evidencePath) {
  if (validated.length !== 1) {
    fail(`${stage} evidence evaluates exactly one capability bundle`, "CAPABILITY_STAGE_SCOPE_MISMATCH");
  }
  const [{ bundle }] = validated;
  const evidence = await readYamlArtifact(evidencePath, "Capability stage evidence");
  assertSchema(await validator("evidence"), evidence, "Capability stage evidence");
  if (evidence.stage !== stage || evidence.bundle_digest !== bundle.bundle_digest) {
    fail("Capability evidence belongs to another stage or bundle", "CAPABILITY_STAGE_SCOPE_MISMATCH");
  }
  const expected = new Map();
  for (const capability of bundle.capabilities) {
    for (const outcome of capability.outcomes) {
      if (stage === "implementation") {
        expected.set(outcomeKey(capability, outcome), `${capability.id}/${outcome.id}`);
      } else {
        for (const check of outcome.acceptance) {
          expected.set(checkKey(capability, outcome, check), `${capability.id}/${outcome.id}/${check.id}`);
        }
      }
    }
  }
  const received = new Map();
  const issues = [];
  for (const record of evidence.records) {
    const key = stage === "implementation"
      ? `${record.capability}\0${record.outcome}`
      : `${record.capability}\0${record.outcome}\0${record.check ?? ""}`;
    if (received.has(key)) issues.push(`duplicate evidence record: ${expected.get(key) ?? key}`);
    received.set(key, record);
    if (!expected.has(key)) issues.push(`unknown evidence record: ${key.split("\0").join("/")}`);
    const allowed = stage === "implementation"
      ? ["addressed", "not-addressed"]
      : ["pass", "fail", "not-run"];
    if (!allowed.includes(record.status)) issues.push(`invalid ${stage} status for ${key.split("\0").join("/")}`);
    if ((record.status === "addressed" || record.status === "pass" || record.status === "fail")
      && record.evidence.length === 0) {
      issues.push(`evidence is required for ${key.split("\0").join("/")}`);
    }
  }
  const checks = [...expected.entries()].map(([key, id]) => {
    const record = received.get(key);
    const passed = stage === "implementation"
      ? record?.status === "addressed"
      : record?.status === "pass";
    return {
      id,
      status: passed ? "pass" : "fail",
      description: record
        ? `${stage} status: ${record.status}; evidence records: ${record.evidence.length}.`
        : `No ${stage} evidence record exists.`
    };
  });
  checks.push(...issues.map((description, index) => ({
    id: `${stage}-invalid-${index + 1}`,
    status: "fail",
    description
  })));
  return checks;
}

export async function evaluateCapabilityStage(inputPath, bundlePaths, {
  stage,
  evidencePath
}) {
  if (!["authoring", "composition", "implementation", "verification"].includes(stage)) {
    fail(`Unknown capability stage: ${stage}`, "UNKNOWN_CAPABILITY_STAGE");
  }
  if (!Array.isArray(bundlePaths) || bundlePaths.length === 0) {
    fail("At least one capability bundle is required", "CAPABILITY_BUNDLE_REQUIRED");
  }
  const record = await validatePackage(inputPath);
  const records = packageRecordMap(record);
  const validated = [];
  for (const bundlePath of bundlePaths) {
    const bundle = await readYamlArtifact(bundlePath, "Capability bundle");
    const packageRecord = records.get(bundle?.package?.id);
    if (!packageRecord) {
      fail("Capability bundle package is not selected by the composition root", "CAPABILITY_STAGE_SCOPE_MISMATCH", [
        bundle?.package?.id ?? "missing package ID"
      ]);
    }
    validated.push(await validateBundleAgainstRecord(packageRecord, bundle, {
      requireAccepted: stage !== "authoring"
    }));
  }
  if (stage !== "authoring" && !evidencePath) {
    fail(`${stage} stage requires an evidence artifact`, "CAPABILITY_EVIDENCE_REQUIRED");
  }
  const checks = stage === "authoring"
    ? authoringChecks(validated)
    : stage === "composition"
      ? await compositionChecks(validated, evidencePath)
      : await evidenceChecks(validated, stage, evidencePath);
  return stageReport(stage, checks, validated.map(({ bundle }) => ({
    package: bundle.package.id,
    bundle_digest: bundle.bundle_digest ?? capabilityBundleDigest(bundle)
  })));
}

export function formatCapabilityExtraction(result) {
  return [
    `Capability extraction prepared: ${result.package.id}@${result.package.version}`,
    `Package digest: ${result.package.digest}`,
    `Source sections: ${result.sections}`,
    `Workspace: ${result.output}`,
    "No model was called and no package file was changed."
  ].join("\n");
}

export function formatCapabilityAcceptance(result) {
  return [
    `Accepted capability bundle: ${result.bundle.bundle_digest}`,
    `Capabilities: ${result.bundle.capabilities.length}`,
    `Output: ${result.output}`
  ].join("\n");
}

export function formatCapabilityStageReport(report) {
  const passed = report.checks.filter((check) => check.status === "pass").length;
  return [
    `Capability stage: ${report.stage}`,
    `Status: ${report.status}`,
    `Checks: ${passed}/${report.checks.length} passed`,
    ...report.checks.filter((check) => check.status !== "pass")
      .map((check) => `- ${check.id}: ${check.description}`)
  ].join("\n");
}
