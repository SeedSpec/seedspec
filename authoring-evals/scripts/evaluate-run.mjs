import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parse as parseYaml } from "yaml";
import { runPath, verifyRunContract } from "./lib/run-contract.mjs";

const execFileAsync = promisify(execFile);

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!["--run", "--output"].includes(name) || !value) {
      throw new Error("Usage: evaluate-run.mjs --run <directory> [--output <report.json>]");
    }
    options[name.slice(2)] = value;
  }
  if (!options.run) throw new Error("--run is required");
  return options;
}

async function cliJson(cliPath, args) {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, ...args], {
    maxBuffer: 10 * 1024 * 1024
  });
  return JSON.parse(stdout);
}

function countCandidates(items, outcome) {
  return items.filter((candidate) => candidate.disposition?.outcome === outcome).length;
}

function includesText(content, phrase) {
  return content.toLocaleLowerCase("en-US").includes(phrase.toLocaleLowerCase("en-US"));
}

const options = parseArguments(process.argv.slice(2));
const runDirectory = path.resolve(options.run);
const contract = await verifyRunContract(runDirectory);
const subjectDirectory = runPath(runDirectory, "control/subject", "control subject path");
const packagePath = runPath(runDirectory, contract.workspace.package, "workspace.package");
const statePath = runPath(runDirectory, contract.workspace.state, "workspace.state");
const cliPath = contract.cli.executable;
const subject = parseYaml(await readFile(path.join(subjectDirectory, "subject.yaml"), "utf8"));
if (subject.id !== contract.subject.id) throw new Error("Frozen subject identity does not match the run contract");

const [inspection, lint, status, publish] = await Promise.all([
  cliJson(cliPath, ["inspect", packagePath, "--json"]),
  cliJson(cliPath, ["lint", packagePath, "--json"]),
  cliJson(cliPath, ["author", "status", packagePath, "--json"]),
  cliJson(cliPath, ["publish-check", packagePath, "--state", statePath, "--json"])
]);

const checks = [];
function check(id, passed, detail, category = "integrity") {
  checks.push({ id, category, passed: Boolean(passed), detail });
}

check("protocol-valid", inspection.id && lint.protocol_valid, lint.diagnostics ?? []);
check("lint-clean", (lint.diagnostics ?? []).length === 0, lint.diagnostics ?? []);
check("publish-ready", publish.ready === true, publish.checks ?? []);
check(
  "review-complete",
  status.review.complete === subject.expectations.state.review_complete,
  status.review.complete,
  "outcome"
);

for (const [field, expected] of Object.entries(subject.expectations.state.questions ?? {})) {
  check(
    `questions-${field}`,
    status.review.questions[field] === expected,
    status.review.questions[field],
    field === "open" ? "outcome" : "process-observation"
  );
}
const candidates = status.review.candidates.items ?? [];
for (const [field, expected] of Object.entries(subject.expectations.state.candidates ?? {})) {
  const actual = field === "open"
    ? status.review.candidates.open
    : countCandidates(candidates, field === "accepted" ? "accept" : field.replace(/d$/u, ""));
  check(
    `candidates-${field}`,
    actual === expected,
    actual,
    field === "open" ? "outcome" : "process-observation"
  );
}
const proposals = status.review.proposals.items ?? [];
check(
  "proposals-applied",
  status.review.proposals.applied === subject.expectations.state.proposals.applied,
  status.review.proposals.applied,
  "process-observation"
);
const actualProposalPaths = proposals
  .filter(({ status: proposalStatus }) => proposalStatus === "applied")
  .map(({ document }) => document.path);
check(
  "proposal-paths",
  JSON.stringify(actualProposalPaths) === JSON.stringify(subject.expectations.state.proposals.paths),
  actualProposalPaths,
  "process-observation"
);
const requiredProposalPaths = subject.expectations.state.proposals.required_paths ?? [];
check(
  "required-proposal-paths",
  requiredProposalPaths.every((requiredPath) => actualProposalPaths.includes(requiredPath)),
  actualProposalPaths,
  "outcome"
);

for (const expectation of subject.expectations.documents) {
  const content = await readFile(path.join(packagePath, expectation.path), "utf8");
  for (const phrase of expectation.contains ?? []) {
    check(`contains:${expectation.path}:${phrase}`, includesText(content, phrase), phrase, "lexical-proxy");
  }
  for (const phrase of expectation.excludes ?? []) {
    check(`excludes:${expectation.path}:${phrase}`, !includesText(content, phrase), phrase, "lexical-proxy");
  }
  for (const [index, alternatives] of (expectation.contains_any ?? []).entries()) {
    check(
      `contains-any:${expectation.path}:${index + 1}`,
      alternatives.some((phrase) => includesText(content, phrase)),
      alternatives,
      "lexical-proxy"
    );
  }
}

const acceptedCandidate = candidates.find(({ disposition }) => disposition?.outcome === "accept");
const declinedCandidate = candidates.find(({ disposition }) => disposition?.outcome === "decline");
check(
  "accepted-candidate-meaning",
  includesText(
    acceptedCandidate?.disposition?.meaning ?? "",
    subject.expectations.candidate_meaning.accepted_contains
  ),
  acceptedCandidate?.disposition?.meaning ?? null,
  "process-observation"
);
check(
  "declined-expansion",
  includesText(
    declinedCandidate?.issue ?? "",
    subject.expectations.candidate_meaning.declined_issue_contains
  ),
  declinedCandidate?.issue ?? null,
  "outcome"
);
const appliedMeaning = subject.expectations.authority?.applied_meaning_contains;
if (appliedMeaning) {
  const grounded = proposals.some((proposal) => (
    proposal.status === "applied" && includesText(proposal.document?.after_content ?? "", appliedMeaning)
  ));
  check("author-approved-applied-meaning", grounded, appliedMeaning, "outcome");
}

const gatingChecks = checks.filter(({ category }) => category !== "process-observation");

const report = {
  authoring_eval_report_version: "2",
  run_id: contract.run_id,
  contract_id: contract.contract_id,
  subject: subject.id,
  execution: contract.execution,
  cli: {
    version: contract.cli.version,
    protocol_release: contract.cli.protocol_release,
    source_commit: contract.cli.source_commit,
    source_dirty: contract.cli.source_dirty,
    source_digest: contract.snapshots.cli_source.digest
  },
  package: {
    id: inspection.id,
    version: inspection.version,
    digest: inspection.digest
  },
  passed: gatingChecks.every(({ passed }) => passed),
  observations_matched: checks.every(({ passed }) => passed),
  metrics: {
    questions: status.review.questions.total,
    candidates: status.review.candidates.total,
    proposals: status.review.proposals.total
  },
  checks
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (options.output) {
  const outputPath = path.resolve(options.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serialized, "utf8");
}
process.stdout.write(serialized);
if (!report.passed) process.exitCode = 1;
