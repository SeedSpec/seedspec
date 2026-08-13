import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  contentId,
  sha256,
  snapshotDirectory
} from "./lib/run-contract.mjs";
import { evaluateAcceptanceCoverage } from "./lib/acceptance-coverage-gate.mjs";

const INCOMPLETE_ACCEPTANCE = `# Acceptance criteria

- Setup provisions the required HubSpot property and dashboard plus the daily
  schedule using the fixed object, property, dashboard, time, timezone, and
  Slack channel.
- Re-running setup does not duplicate properties, dashboards, or schedules.
- An existing resource is reused only when identity, ownership, type, and
  business meaning match. A conflict stops for user direction.
- The query uses the previous calendar day in \`America/Chicago\`, including
  daylight-saving transitions.
- A value briefing identifies the metric, reporting date, value, and timezone.
- A stable authorized dashboard link is included when available. Other links
  are excluded.
- An empty day sends one explicit no-data message and never reports numeric zero.
- A delivery retry does not duplicate the message for a reporting day.
- Delivery failure is visible and safely retryable.
`;

const COMPLETE_ACCEPTANCE = `# Acceptance criteria

- Setup provisions the required HubSpot property, report, and dashboard plus
  the daily schedule using the fixed object, property, dashboard, time,
  timezone, and Slack channel.
- Re-running setup does not duplicate properties, reports, dashboards, or
  schedules.
- An existing resource is reused only when identity, ownership, type, and
  business meaning match. A conflict stops for user direction.
- The query uses the previous calendar day in \`America/Chicago\`, including
  daylight-saving transitions.
- A value briefing identifies the metric, reporting date, value, and timezone.
- A stable authorized dashboard link is included when available. Other links
  are excluded.
- An empty day sends one explicit no-data message and never reports numeric zero.
- A delivery retry does not duplicate the message for a reporting day.
- Delivery failure is recorded without credentials, tokens, cookies, private
  keys, customer records, or raw provider errors and remains safely retryable.
`;

const CRITICAL_OBLIGATIONS = [
  { id: "resource-provisioning" },
  { id: "setup-idempotency" },
  { id: "conflict-safety" },
  { id: "reporting-day" },
  { id: "value-message" },
  { id: "link-authorization" },
  { id: "no-data" },
  { id: "message-idempotency" },
  { id: "visible-retry" },
  { id: "secret-safe-failure" }
];

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (name === "--base" && value) options.base = value;
    else if (name === "--output-root" && value) options.outputRoot = value;
    else throw new Error(
      "Usage: prepare-acceptance-ablation.mjs --base <package> --output-root <directory>"
    );
  }
  if (!options.base || !options.outputRoot) throw new Error("--base and --output-root are required");
  return options;
}

function contract(acceptance, coveredIds) {
  const digest = sha256(acceptance);
  return {
    acceptance_coverage_contract_version: "1",
    critical_obligations: CRITICAL_OBLIGATIONS,
    coverage: coveredIds.map((obligationId) => ({
      obligation_id: obligationId,
      path: "acceptance/criteria.md",
      file_digest: digest
    }))
  };
}

const options = parseArguments(process.argv.slice(2));
const base = path.resolve(options.base);
const outputRoot = path.resolve(options.outputRoot);
const baseSnapshot = await snapshotDirectory(base);
const body = {
  acceptance_ablation_version: "1",
  base_snapshot: baseSnapshot,
  incomplete_acceptance_digest: sha256(INCOMPLETE_ACCEPTANCE),
  complete_acceptance_digest: sha256(COMPLETE_ACCEPTANCE),
  repetitions: 3
};
const ablationId = contentId("acceptance-ablation", body);
const ablationRoot = path.join(outputRoot, ablationId);
await mkdir(ablationRoot, { recursive: true });

const variants = [
  { id: "solution-only", acceptance: INCOMPLETE_ACCEPTANCE },
  { id: "manual-complete", acceptance: COMPLETE_ACCEPTANCE },
  { id: "gated-complete", acceptance: COMPLETE_ACCEPTANCE }
];
for (const variant of variants) {
  const target = path.join(ablationRoot, variant.id);
  try {
    await cp(base, target, { recursive: true, errorOnExist: true });
    await writeFile(path.join(target, "acceptance/criteria.md"), variant.acceptance);
  } catch (error) {
    if (error.code !== "ERR_FS_CP_EEXIST" && error.code !== "EEXIST") throw error;
  }
}

const incompleteCovered = CRITICAL_OBLIGATIONS
  .map((item) => item.id)
  .filter((id) => !["resource-provisioning", "secret-safe-failure"].includes(id));
const completeCovered = CRITICAL_OBLIGATIONS.map((item) => item.id);
const incompleteContract = contract(INCOMPLETE_ACCEPTANCE, incompleteCovered);
const completeContract = contract(COMPLETE_ACCEPTANCE, completeCovered);
const incompleteIssues = await evaluateAcceptanceCoverage(
  incompleteContract,
  path.join(ablationRoot, "solution-only")
);
const completeIssues = await evaluateAcceptanceCoverage(
  completeContract,
  path.join(ablationRoot, "gated-complete")
);
if (incompleteIssues.length !== 2 || completeIssues.length !== 0) {
  throw new Error("Acceptance coverage gate calibration failed");
}

await mkdir(path.join(ablationRoot, "controller"), { recursive: true });
await writeFile(
  path.join(ablationRoot, "controller/incomplete-contract.json"),
  `${JSON.stringify(incompleteContract, null, 2)}\n`
);
await writeFile(
  path.join(ablationRoot, "controller/complete-contract.json"),
  `${JSON.stringify(completeContract, null, 2)}\n`
);

const candidates = variants.flatMap((variant) => Array.from({ length: 3 }, (_, index) => ({
  label: `${variant.id}-r${index + 1}`,
  author_score: null,
  package_path: path.join(ablationRoot, variant.id)
})));
const manifest = {
  implementation_candidate_manifest_version: "1",
  candidates
};
const manifestPath = path.join(ablationRoot, "candidate-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const record = {
  ...body,
  ablation_id: ablationId,
  variants: Object.fromEntries(variants.map((variant) => [
    variant.id,
    {
      package_path: path.join(ablationRoot, variant.id),
      snapshot: null
    }
  ])),
  gate: {
    incomplete_rejected: true,
    incomplete_issues: incompleteIssues,
    complete_admitted: true,
    complete_issues: completeIssues
  },
  candidate_manifest: manifestPath
};
for (const variant of variants) {
  record.variants[variant.id].snapshot = await snapshotDirectory(path.join(ablationRoot, variant.id));
}
await writeFile(path.join(ablationRoot, "ablation.json"), `${JSON.stringify(record, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
