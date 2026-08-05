#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { withPackageSource } from "../src/package-source.js";
import {
  exportBundledSkills,
  formatBundledSkills,
  listBundledSkills
} from "../src/bundled-skills.js";
import { runInteractiveShell } from "../src/session/interactive.js";
import { runJsonlShell } from "../src/session/jsonl.js";
import { createShellSession } from "../src/session/session.js";
import {
  auditPackage,
  applyDocumentChange,
  applyIntegrationBridgePlan,
  beginPackage,
  computeDirectoryDigest,
  createAuthoringWorkspace,
  createAuthorEvaluation,
  createAdapterRegistry,
  decideDocumentChange,
  decideClarificationCandidate,
  discoverAuthoringWorkspace,
  discoverFeatures,
  discoverProviders,
  discoverFormatIntegrations,
  formatError,
  formatAdapterListing,
  formatArtifactListing,
  formatAuthoringAudit,
  formatAuthoringDocumentation,
  formatAuthoringStarterPrompt,
  answerQuestion,
  attachSource,
  formatAuthoringGuidance,
  listAuthoringGuidanceTopics,
  listAuthoringSchemas,
  proposeDocumentChange,
  recordClarificationCandidate,
  recordObservations,
  reviewArea,
  readAuthoringSchema,
  formatAuthoringWorkspaceCreation,
  formatAuthoringWorkspaceSnapshot,
  formatClarificationProbePreflight,
  formatClarificationProbePreparation,
  formatAuthorEvaluation,
  formatCapabilityConformance,
  formatConformanceResult,
  formatFeatureDiscovery,
  formatContextPreparation,
  formatContextValidation,
  formatIntegrationBridgePlan,
  formatIntegrationDiscovery,
  formatProviderDiscovery,
  formatPackageAgentPrompt,
  formatInspection,
  formatPackageLint,
  formatPackageBeginning,
  formatImplementationResourceListing,
  formatImplementationResourceResolution,
  formatInstallationInspection,
  formatPackResult,
  formatPreparation,
  formatPublishCheck,
  formatProjectCompletion,
  formatUpgrade,
  initPackage,
  inspectPackage,
  inspectCapabilityConformance,
  inspectInstallation,
  inspectAuthoringWorkspace,
  lintPackage,
  inspectProjectCompletion,
  listPackageArtifacts,
  listPackageImplementationResources,
  loadIntegrationAdapter,
  readBundledResource,
  formatBundledResource,
  packPackage,
  preparePackage,
  prepareContext,
  prepareClarificationProbe,
  planIntegrationBridges,
  publishCheckPackage,
  recordImplementationResourceUse,
  recordClarificationProbeRun,
  resolveImplementationResources,
  resolveProject,
  runtimeVersion,
  runBundledConformanceSuite,
  runConformanceSuite,
  conformanceSuiteVersion,
  protocolPackageVersion,
  protocolRelease,
  protocolReleaseDigest,
  protocolVersion,
  readIntegrationDescriptor,
  recordContextUse,
  upgradePackage,
  validateContextModule,
  verifyProjectLock,
  validatePackage,
  verifyClarificationProbe,
  withAuthoringWorkspaceMutationLock
} from "@seedspec/runtime";

const CLI_VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const IMPLEMENTING_GUIDE = readFileSync(
  new URL("../docs/implementing.md", import.meta.url),
  "utf8"
);
const SHELL_GUIDE = readFileSync(
  new URL("../docs/shell.md", import.meta.url),
  "utf8"
);

const HELP = `SeedSpec CLI ${CLI_VERSION} (Protocol ${protocolVersion}, experimental)

Usage:
  seedspec author
  seedspec author prompt [--deep|--minimal]
  seedspec author status [package-path] [--json]
  seedspec author review [package-path] [--area <area>] [--summary]
  seedspec author questions [package-path]
  seedspec author candidates [package-path] [--json]
  seedspec author probes [package-path] [--json]
  seedspec author changes [package-path] [--json]
  seedspec author check [package-path]
  seedspec author history [package-path]
  seedspec author evaluate [package-path] [--output <directory>]
  seedspec author pack [package-path] [--output <directory>]
  seedspec author create <package-path> [--target <depth>]
  seedspec author schema [result|changes|candidates|probe-brief|probe-result|probe-runs]
  seedspec author guidance [--topic <topic>]
  seedspec author record [package-path] --json -
  seedspec author answer [package-path] --json -
  seedspec author attach-source [package-path] --json -
  seedspec author candidate [package-path] --json -
  seedspec author candidate-decide [package-path] --json -
  seedspec author probe-prepare [package-path] --output <directory> --json -
  seedspec author probe-check [package-path] --bundle <directory> [--json]
  seedspec author probe-record [package-path] --json -
  seedspec author propose [package-path] --json -
  seedspec author decide [package-path] --json -
  seedspec author apply [package-path] --json -
  seedspec author reviewed [package-path] --json -
  seedspec author help
  seedspec prepare <package-path> [--state <directory>] [--status] [--json]
  seedspec review <package-path> [--area <area>] [--target <depth>] [--state <directory>] [--status|--summary] [--json]
  seedspec publish-check <package-path> [--state <directory>] [--json]
  seedspec pack <package-path> [--output <directory>] [--state <directory>] [--json]
  seedspec eval <package-path> [--output <directory>] [--json]
  seedspec skills <list|export> [--output <directory>] [--skill <id>] [--json]
  seedspec upgrade <package-path> [--to <release>] [--dry-run|--write] [--json]
  seedspec docs <authoring [area]|implementing|shell>
  seedspec version [--json]
  seedspec doctor [--full] [--json]
  seedspec prompt [root-package-path-or-github-url]
  seedspec begin <root-package-path-or-github-url> [--json]
  seedspec shell <root-package-path-or-github-url> [--jsonl]
  seedspec repl <root-package-path-or-github-url> [--jsonl]
  seedspec validate <path>
  seedspec digest <path>
  seedspec inspect <path> [--json]
  seedspec lint <path> [--json]
  seedspec artifacts <path> [--json]
  seedspec context adapters --integration <path> [--integration <path>] [--json]
  seedspec context discover <package-path> --integration <path> [--integration <path>] [--json]
  seedspec context validate <package-path> <module> --integration <path> [--adapter <id>] [--json]
  seedspec context prepare <project-path> --request <yaml> --output <directory> [--integration <path>] [--json]
  seedspec context record-use <prepared-context-path> --input <json> [--output <json>] [--json]
  seedspec context author <package-path> --integration <path> [--write] [--state <directory>] [--json]
  seedspec resources <path> [--show <resource-id>] [--json]
  seedspec resolve-resources <project-path> [--json]
  seedspec record-resource-use <project-path> <package-id> <resource-id> <consulted|skipped> [--reason <text>] [--json]
  seedspec resource-digest <directory>
  seedspec discover-features <root-package-path> --catalog <path> [--catalog <path>] [--json]
  seedspec discover-providers <package-path> --catalog <path> [--catalog <path>] [--json]
  seedspec conformance [cases.yaml] [--json] [--output <report.json>]
  seedspec verify-lock <project-path> --package <package-path> [--package <package-path>]
  seedspec completion <project-path> [--json]
  seedspec capability-conformance <package-path> <capability-id> [--result <yaml>] [--json]
  seedspec resolve <root-package-path> [options]
  seedspec init <solution|application|feature|component|workflow|automation|configuration|integration> [--output <path>]

Resolve options:
  --add <path>                     Add another SeedSpec package (repeatable)
  --feature <path>                 Compatibility alias for --add
  Bundled children declared through composition.includes are selected recursively
  -i, --implementation <profile>   Prefer an implementation profile; repeatable, package/profile for additions
  --output <path>                  Project directory; defaults to the current directory
  --configuration-selections <yaml>  Select example or complete custom configuration per package
  --applied-intent <yaml>            Affirm package fit and record project-local intent
  --completion-scope <yaml>         Record the implementation completion scope
  --technical-preferences <yaml>   Record implementation preferences separately
  --artifact-selections <yaml>     Record selected, declined, or deferred artifacts
  --decisions <yaml>               Answer package-declared product decisions
`;

const AUTHOR_HELP = `SeedSpec authoring

Start a new package, then author it:
  npx @seedspec/cli init application --output my-package
  cd my-package
  npx @seedspec/cli author

Kinds: solution, application, feature, component, workflow, automation, configuration,
integration.

Commands:
  author              Find or resume the local authoring workspace
  author prompt       Print the default exploration prompt; --deep or --minimal changes posture
  author status       Show the draft and current review
  author review       Print the complete versioned agent operating brief
  author questions    Show authoring-session questions and resolutions
  author candidates   Show clarification candidates and author dispositions
  author probes       Show frozen probe runs and question-or-no-action results
  author changes      Inspect proposed, accepted, rejected, and applied changes
  author check        Check structure, guidance, and publication readiness
  author history      Show completed and current review passes
  author schema       Print an authoring state schema (result or changes)
  author guidance     Print one guidance topic (author guidance --topic <id>)
  author evaluate     Create an independent handoff evaluation
  author pack         Create the distributable SeedSpec archive
  author help         Show this guide

Recording work. Each takes one JSON payload on stdin, so multi-sentence prose
never has to survive shell quoting:
  author record         Record findings, questions, inventory, contradictions
  author answer         Record the author's answer, or decline a question
  author attach-source  Attach source material the review may draw findings from
  author candidate      Record one consequential clarification candidate
  author candidate-decide Record the author's candidate disposition
  author probe-prepare   Freeze a source-bound brief without calling a model
  author probe-check     Recheck frozen identity before a model call
  author probe-record    Import one run and its candidate or no-action result
  author propose        Record an inspectable document replacement
  author decide         Record explicit author acceptance or rejection
  author apply          Apply one accepted proposal through the engine
  author reviewed       Close the current thread with a disposition

  echo '{"entries":[{"type":"question","question":"..."}]}' \\
    | npx @seedspec/cli author record --json -

Paths are optional when the command runs inside a SeedSpec project.

The starter prompt carries the selected exploration posture and interaction
rules. The complete review output supplies the version-matched kind lens,
context boundary, private review model, authority rules, and durable record
contract. The optional
author-seedspec skill is a convenience, not a prerequisite.
`;

function parseArguments(args) {
  const positional = [];
  const options = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "-i") {
      const optionValue = args[index + 1];
      if (!optionValue || optionValue.startsWith("-")) {
        throw new Error("Option -i requires a value");
      }
      index += 1;
      options.set("implementation", [...(options.get("implementation") ?? []), optionValue]);
      continue;
    }
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }

    if (value === "--json") {
      if (args[index + 1] === "-") {
        index += 1;
        options.set("json", ["-"]);
      } else {
        options.set("json", [true]);
      }
      continue;
    }
    if (
      value === "--help"
      || value === "--status"
      || value === "--summary"
      || value === "--explore"
      || value === "--deep"
      || value === "--minimal"
      || value === "--full"
      || value === "--write"
      || value === "--dry-run"
      || value === "--jsonl"
    ) {
      options.set(value.slice(2), [true]);
      continue;
    }

    const optionValue = args[index + 1];
    if (!optionValue || optionValue.startsWith("--")) {
      throw new Error(`Option ${value} requires a value`);
    }
    index += 1;
    const name = value.slice(2);
    options.set(name, [...(options.get(name) ?? []), optionValue]);
  }

  return { positional, options };
}

async function registryFromIntegrations(sources) {
  const registry = createAdapterRegistry();
  for (const source of sources) {
    const integration = await readIntegrationDescriptor(source);
    if (integration.descriptor.adapter) await loadIntegrationAdapter(source, registry);
  }
  return registry;
}

function oneOption(options, name) {
  const values = options.get(name) ?? [];
  if (values.length > 1) throw new Error(`Option --${name} may be supplied only once`);
  return values[0];
}

function rejectUnknownOptions(options, allowed) {
  const allowedNames = new Set(allowed);
  const unknown = [...options.keys()].filter((name) => !allowedNames.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown option --${unknown[0]}`);
  }
}

function requirePositional(positional, index, label) {
  if (!positional[index]) throw new Error(`Missing ${label}`);
  return positional[index];
}

async function resolveAuthoringContext(explicitPackagePath, stateDirectory) {
  if (explicitPackagePath && stateDirectory) {
    return {
      packageRoot: path.resolve(explicitPackagePath),
      stateRoot: path.resolve(stateDirectory),
      stateExists: true
    };
  }
  const discovered = await discoverAuthoringWorkspace(explicitPackagePath ?? process.cwd());
  return {
    packageRoot: path.resolve(explicitPackagePath ?? discovered.packageRoot),
    stateRoot: stateDirectory ? path.resolve(stateDirectory) : discovered.stateRoot,
    stateExists: stateDirectory ? true : discovered.stateExists
  };
}

// Write operations take one JSON payload rather than a flag per field.
// Shell-quoting multi-sentence prose into repeated --flags is exactly where
// agents fail, so `--json -` reads the whole record from stdin.
async function readOperationInput(options) {
  const inline = oneOption(options, "json");
  // `--json -` and a bare `--json` both mean "read stdin"; only a string value
  // is treated as an inline payload.
  const source = typeof inline === "string" && inline !== "-"
    ? inline
    : await new Promise((resolve, reject) => {
      let buffer = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { buffer += chunk; });
      process.stdin.on("end", () => resolve(buffer));
      process.stdin.on("error", reject);
    });
  if (!source.trim()) {
    throw new Error("Provide the operation payload as JSON on stdin, or --json '<payload>'");
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Operation payload is not valid JSON: ${error.message}`, { cause: error });
  }
}

function requiredAuthoringRevision(options, input) {
  const revision = oneOption(options, "revision") ?? input.expected_revision;
  if (typeof revision !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(revision)) {
    throw new Error(
      "Authoring mutations require expected_revision from the latest review or mutation receipt"
    );
  }
  return revision;
}

function authorNextCommand(snapshot) {
  if (snapshot.package.status !== "valid") {
    return "Next: update the draft, then run `npx @seedspec/cli author check`.";
  }
  if (snapshot.review.proposals.proposed > 0 || snapshot.review.proposals.accepted > 0) {
    return "Unsettled changes: `npx @seedspec/cli author changes`";
  }
  if (snapshot.review.candidates?.open > 0) {
    return "Unsettled clarification: `npx @seedspec/cli author candidates`";
  }
  if (snapshot.review.current || !snapshot.review.complete) {
    return "Next: `npx @seedspec/cli author review`";
  }
  if (snapshot.review.questions.open > 0) {
    return "Optional session questions: `npx @seedspec/cli author questions`";
  }
  return "Next: `npx @seedspec/cli author check`";
}

function formatOptionalAuthoringSkillOffer() {
  return [
    "Optional authoring skill",
    "A project-local `author-seedspec` skill is bundled with this CLI. It is not required.",
    "Before exporting it, ask the user whether they want it added to this project.",
    "If they accept, run:",
    "`npx @seedspec/cli skills export --skill author-seedspec --output <project-skill-directory>`",
    "If they decline or their agent does not support skills, continue with the CLI work order."
  ].join("\n");
}

function formatAuthoringQuestions(snapshot) {
  const questions = snapshot.review.questions.items;
  const lines = [
    "SeedSpec authoring-session questions",
    `${snapshot.review.questions.open} open, ${snapshot.review.questions.resolved} resolved`
  ];
  if (questions.length === 0) return [...lines, "", "No authoring-session questions recorded."].join("\n");
  lines.push(
    "",
    "These questions belong to the authoring conversation. They are not automatically package configuration, portable questions, or future implementation work."
  );
  for (const question of questions) {
    lines.push(`- ${question.id} — ${question.status ?? "open"}`);
    lines.push(`  ${question.question ?? "No question text recorded."}`);
    if (question.resolution) lines.push(`  Resolution: ${question.resolution}`);
  }
  return lines.join("\n");
}

function formatAuthoringHistory(snapshot) {
  const lines = ["SeedSpec authoring history"];
  if (snapshot.review.passes.length === 0) {
    return [...lines, "", "No review passes recorded."].join("\n");
  }
  lines.push("");
  for (const pass of snapshot.review.passes) {
    lines.push(`- ${pass.id}: ${pass.area} — ${pass.outcome}`);
  }
  return lines.join("\n");
}

function formatAuthoringCandidates(snapshot) {
  const candidates = snapshot.review.candidates?.items ?? [];
  const summary = snapshot.review.candidates ?? { open: 0, accepted: 0, stale: 0 };
  const lines = [
    "SeedSpec clarification candidates",
    `${summary.open} open, ${summary.accepted} accepted, ${summary.stale} stale`
  ];
  if (candidates.length === 0) {
    return [...lines, "", "No clarification candidates recorded."].join("\n");
  }
  lines.push(
    "",
    "Candidates are authoring evidence. They are not package intent until accepted meaning is applied through a document proposal."
  );
  for (const candidate of candidates) {
    lines.push(
      "",
      `${candidate.id} — ${candidate.status}${candidate.stale ? "; stale" : ""}`,
      `Issue: ${candidate.issue}`,
      `Alternatives: ${(candidate.alternatives ?? []).join(" | ")}`,
      `Inference: ${candidate.basis?.inference ?? "No inference recorded."}`
    );
    if (candidate.disposition?.meaning) {
      lines.push(`Author meaning: ${candidate.disposition.meaning}`);
    }
  }
  return lines.join("\n");
}

function formatAuthoringProbes(snapshot) {
  const probes = snapshot.review.probes?.items ?? [];
  const summary = snapshot.review.probes ?? {
    total: 0,
    candidates: 0,
    no_action: 0,
    quarantined: 0
  };
  const lines = [
    "SeedSpec clarification probes",
    `${summary.total} run, ${summary.candidates} candidate, ${summary.no_action} no action, ${summary.quarantined} quarantined`
  ];
  if (probes.length === 0) {
    return [...lines, "", "No clarification probes recorded."].join("\n");
  }
  for (const probe of probes) {
    lines.push(
      "",
      `${probe.id} — ${probe.outcome}`,
      `  Brief: ${probe.brief_id}`,
      `  Model: ${probe.provider}/${probe.requested_model}`,
      `  Occurrence: ${probe.occurrence_id ?? "none"}`,
      `  Comparison groups: ${probe.comparison_group_ids?.length ?? 0}`,
      ...(probe.author_question ? [`  Question: ${probe.author_question}`] : []),
      ...(probe.no_action?.reason ? [`  No action: ${probe.no_action.reason}`] : [])
    );
  }
  return lines.join("\n");
}

function formatAuthoringChanges(snapshot) {
  const proposals = snapshot.review.proposals.items;
  const lines = [
    "SeedSpec authoring changes",
    `${snapshot.review.proposals.proposed} proposed, ${snapshot.review.proposals.accepted} accepted, ${snapshot.review.proposals.rejected} rejected, ${snapshot.review.proposals.applied} applied`
  ];
  if (proposals.length === 0) return [...lines, "", "No document changes recorded."].join("\n");
  for (const proposal of proposals) {
    lines.push(
      "",
      `${proposal.id} — ${proposal.status}`,
      `Document: ${proposal.document?.path ?? "unknown"}`,
      `Summary: ${proposal.summary ?? "No summary recorded."}`,
      "Before:",
      proposal.document?.before_content ?? "[new document]",
      "After:",
      proposal.document?.after_content ?? ""
    );
    const decisions = Array.isArray(proposal.decisions) && proposal.decisions.length > 0
      ? proposal.decisions
      : (proposal.decision ? [proposal.decision] : []);
    for (const [index, decision] of decisions.entries()) {
      const label = decisions.length === 1 ? "Decision" : `Decision ${index + 1}`;
      lines.push(`${label}: ${decision.outcome} by ${decision.by}`);
      if (decision.rationale) lines.push(`Rationale: ${decision.rationale}`);
    }
  }
  return lines.join("\n");
}

async function run() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    process.stdout.write(HELP);
    return;
  }
  if (command === "--version") {
    process.stdout.write(`${CLI_VERSION}\n`);
    return;
  }

  const { positional, options } = parseArguments(rest);
  if (options.has("help")) {
    process.stdout.write(HELP);
    return;
  }

  switch (command) {
    case "shell":
    case "repl": {
      rejectUnknownOptions(options, ["jsonl"]);
      const packageInput = requirePositional(positional, 0, "root package path or GitHub URL");
      if (positional.length > 1) throw new Error(`${command} accepts one package path or GitHub URL`);
      await withPackageSource(packageInput, async ({ packagePath, source }) => {
        const session = await createShellSession(packagePath, {
          source: source?.original ?? packageInput,
          implementingGuide: {
            path: "@seedspec/cli/docs/implementing.md",
            version: CLI_VERSION,
            text: IMPLEMENTING_GUIDE
          }
        });
        if (options.has("jsonl")) await runJsonlShell(session);
        else await runInteractiveShell(session);
      });
      break;
    }
    case "author": {
      const supportedActions = new Set([
        "open",
        "create",
        "prompt",
        "schema",
        "guidance",
        "record",
        "answer",
        "attach-source",
        "candidate",
        "candidate-decide",
        "probe-prepare",
        "probe-check",
        "probe-record",
        "propose",
        "decide",
        "apply",
        "reviewed",
        "status",
        "review",
        "questions",
        "candidates",
        "probes",
        "changes",
        "check",
        "history",
        "evaluate",
        "pack",
        "help"
      ]);
      const action = supportedActions.has(positional[0]) ? positional[0] : "open";
      const packagePath = action === "open" ? positional[0] : positional[1];
      if (action === "create") {
        rejectUnknownOptions(options, ["target", "state", "json"]);
        const requiredPackagePath = requirePositional(positional, 1, "package path");
        const result = await createAuthoringWorkspace(requiredPackagePath, {
          stateDirectory: oneOption(options, "state"),
          target: oneOption(options, "target"),
          toolVersion: CLI_VERSION
        });
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(result, null, 2)}\n`
          : `${formatAuthoringWorkspaceCreation(result)}\n`);
      } else if (action === "help") {
        rejectUnknownOptions(options, []);
        process.stdout.write(AUTHOR_HELP);
      } else if (action === "prompt") {
        rejectUnknownOptions(options, ["deep", "minimal", "explore"]);
        if (options.has("deep") && options.has("minimal")) {
          throw new Error("Choose either --deep or --minimal");
        }
        const mode = options.has("deep")
          ? "deep"
          : options.has("minimal") ? "minimal" : "shape";
        process.stdout.write(`${formatAuthoringStarterPrompt({ mode })}\n`);
      } else if (action === "probe-prepare") {
        rejectUnknownOptions(options, ["state", "json", "pass", "revision", "output"]);
        const context = await resolveAuthoringContext(positional[1], oneOption(options, "state"));
        const input = await readOperationInput(options);
        const result = await prepareClarificationProbe(context.packageRoot, {
          stateRoot: context.stateRoot,
          outputDirectory: oneOption(options, "output") ?? input.output_directory,
          pass: oneOption(options, "pass") ?? input.pass,
          probe: input.probe ?? input,
          expectedRevision: oneOption(options, "revision") ?? input.expected_revision ?? null
        });
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(result, null, 2)}\n`
          : `${formatClarificationProbePreparation(result)}\n`);
      } else if (action === "probe-check") {
        rejectUnknownOptions(options, ["state", "json", "bundle"]);
        const context = await resolveAuthoringContext(positional[1], oneOption(options, "state"));
        const result = await verifyClarificationProbe(context.packageRoot, {
          stateRoot: context.stateRoot,
          bundleDirectory: oneOption(options, "bundle")
        });
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(result, null, 2)}\n`
          : `${formatClarificationProbePreflight(result)}\n`);
        if (!result.ready) process.exitCode = 1;
      } else if ([
        "record",
        "answer",
        "attach-source",
        "candidate",
        "candidate-decide",
        "probe-record",
        "propose",
        "decide",
        "apply",
        "reviewed"
      ].includes(action)) {
        rejectUnknownOptions(options, ["state", "json", "pass", "revision"]);
        const context = await resolveAuthoringContext(positional[1], oneOption(options, "state"));
        const input = await readOperationInput(options);
        const shared = {
          stateRoot: context.stateRoot,
          expectedRevision: requiredAuthoringRevision(options, input)
        };
        const pass = oneOption(options, "pass") ?? input.pass;
        const operation = () => action === "record"
          ? recordObservations(context.packageRoot, { ...shared, pass, entries: input.entries })
          : action === "answer"
            ? answerQuestion(context.packageRoot, {
              ...shared,
              questionId: input.question_id ?? input.questionId,
              answer: input.answer,
              resolution: input.resolution ?? "resolved"
            })
            : action === "attach-source"
              ? attachSource(context.packageRoot, { ...shared, source: input.source ?? input })
              : action === "candidate"
                ? recordClarificationCandidate(context.packageRoot, {
                  ...shared,
                  pass,
                  candidate: input.candidate ?? input
                })
                : action === "candidate-decide"
                  ? decideClarificationCandidate(context.packageRoot, {
                    ...shared,
                    candidateId: input.candidate_id ?? input.candidateId,
                    decision: input.decision,
                    decidedBy: input.decided_by ?? input.decidedBy ?? "author",
                    meaning: input.meaning,
                    rationale: input.rationale
                  })
                  : action === "probe-record"
                    ? recordClarificationProbeRun(context.packageRoot, {
                      ...shared,
                      bundleDirectory: input.bundle_directory ?? input.bundleDirectory
                    })
                  : action === "propose"
                    ? proposeDocumentChange(context.packageRoot, {
                      ...shared,
                      pass,
                      proposal: input.proposal ?? input
                    })
                    : action === "decide"
                      ? decideDocumentChange(context.packageRoot, {
                        ...shared,
                        proposalId: input.proposal_id ?? input.proposalId,
                        decision: input.decision,
                        decidedBy: input.decided_by ?? input.decidedBy ?? "author",
                        rationale: input.rationale
                      })
                      : action === "apply"
                        ? applyDocumentChange(context.packageRoot, {
                          ...shared,
                          proposalId: input.proposal_id ?? input.proposalId
                        })
                        : reviewArea(context.packageRoot, {
                          ...shared,
                          pass,
                          summary: input.summary,
                          disposition: input.disposition,
                          outcome: input.outcome ?? "reviewed"
                        });
        const result = await withAuthoringWorkspaceMutationLock(context.stateRoot, operation);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else if (action === "guidance") {
        rejectUnknownOptions(options, ["topic"]);
        const topic = oneOption(options, "topic") ?? positional[1];
        if (!topic) {
          process.stdout.write(`${listAuthoringGuidanceTopics()
            .map(({ id, summary }) => `  ${id.padEnd(16)} ${summary}`)
            .join("\n")}\n`);
        } else {
          process.stdout.write(`${formatAuthoringGuidance(topic)}\n`);
        }
      } else if (action === "schema") {
        rejectUnknownOptions(options, []);
        const requested = positional[1];
        if (!requested) {
          process.stdout.write(`Available authoring schemas: ${listAuthoringSchemas().join(", ")}\n`);
        } else {
          process.stdout.write(`${JSON.stringify(await readAuthoringSchema(requested), null, 2)}\n`);
        }
      } else {
        const allowedOptions = {
          open: ["state", "json"],
          status: ["state", "json"],
          review: ["area", "target", "state", "status", "summary", "json"],
          questions: ["state", "json"],
          candidates: ["state", "json"],
          probes: ["state", "json"],
          changes: ["state", "json"],
          check: ["state", "json"],
          history: ["state", "json"],
          evaluate: ["state", "output", "json"],
          pack: ["state", "output", "json"]
        };
        rejectUnknownOptions(options, allowedOptions[action]);
        if (action === "review" && options.has("status") && options.has("summary")) {
          throw new Error("Choose either --status or --summary");
        }
        const context = await resolveAuthoringContext(packagePath, oneOption(options, "state"));
        if (action === "open" && !context.stateExists) {
          await createAuthoringWorkspace(context.packageRoot, {
            stateDirectory: context.stateRoot,
            toolVersion: CLI_VERSION
          });
        }

        if (action === "open" || action === "status") {
          const snapshot = await inspectAuthoringWorkspace(context.packageRoot, {
            stateDirectory: context.stateRoot,
            toolVersion: CLI_VERSION
          });
          process.stdout.write(options.has("json")
            ? `${JSON.stringify(snapshot, null, 2)}\n`
            : `${formatAuthoringWorkspaceSnapshot(snapshot)}\n\n${authorNextCommand(snapshot)}${
              action === "open" ? `\n\n${formatOptionalAuthoringSkillOffer()}` : ""
            }\n`);
        } else if (action === "review") {
          const reviewOperation = () => auditPackage(context.packageRoot, {
            area: oneOption(options, "area"),
            target: oneOption(options, "target"),
            stateDirectory: context.stateRoot,
            toolVersion: CLI_VERSION,
            // `--summary` is a shorter human view, so it reads without
            // starting a pass. Only a bare `review` begins work.
            statusOnly: options.has("status") || options.has("summary")
          });
          const result = options.has("status") || options.has("summary")
            ? await reviewOperation()
            : await withAuthoringWorkspaceMutationLock(context.stateRoot, reviewOperation);
          process.stdout.write(options.has("json")
            ? `${JSON.stringify(result, null, 2)}\n`
            : `${formatAuthoringAudit(result, {
              statusOnly: options.has("status"),
              summary: options.has("summary")
            })}\n`);
        } else if (["questions", "candidates", "probes", "changes", "history"].includes(action)) {
          const snapshot = await inspectAuthoringWorkspace(context.packageRoot, {
            stateDirectory: context.stateRoot,
            toolVersion: CLI_VERSION
          });
          process.stdout.write(options.has("json")
            ? `${JSON.stringify(
              action === "questions"
                ? snapshot.review.questions
                : action === "candidates"
                  ? snapshot.review.candidates
                  : action === "probes"
                    ? snapshot.review.probes
                  : action === "changes" ? snapshot.review.proposals : snapshot.review.passes,
              null,
              2
            )}\n`
            : `${action === "questions"
              ? formatAuthoringQuestions(snapshot)
              : action === "candidates"
                ? formatAuthoringCandidates(snapshot)
                : action === "probes"
                  ? formatAuthoringProbes(snapshot)
                : action === "changes"
                  ? formatAuthoringChanges(snapshot)
                  : formatAuthoringHistory(snapshot)}\n`);
        } else if (action === "check") {
          const snapshot = await inspectAuthoringWorkspace(context.packageRoot, {
            stateDirectory: context.stateRoot,
            toolVersion: CLI_VERSION
          });
          if (snapshot.package.status !== "valid") {
            process.stdout.write(options.has("json")
              ? `${JSON.stringify(snapshot, null, 2)}\n`
              : `${formatAuthoringWorkspaceSnapshot(snapshot)}\n`);
            process.exitCode = 1;
          } else {
            const result = await preparePackage(context.packageRoot, {
              stateDirectory: context.stateRoot,
              toolVersion: CLI_VERSION,
              statusOnly: true
            });
            process.stdout.write(options.has("json")
              ? `${JSON.stringify(result, null, 2)}\n`
              : `${formatPreparation(result, {
                statusOnly: true,
                authorCommand: true
              })}\n`);
          }
        } else if (action === "evaluate") {
          const result = await createAuthorEvaluation(context.packageRoot, {
            outputDirectory: oneOption(options, "output"),
            toolVersion: CLI_VERSION
          });
          process.stdout.write(options.has("json")
            ? `${JSON.stringify(result, null, 2)}\n`
            : `${formatAuthorEvaluation(result)}\n`);
        } else if (action === "pack") {
          const result = await packPackage(context.packageRoot, {
            outputDirectory: oneOption(options, "output"),
            stateDirectory: context.stateRoot,
            toolVersion: CLI_VERSION
          });
          process.stdout.write(options.has("json")
            ? `${JSON.stringify(result, null, 2)}\n`
            : `${formatPackResult(result)}\n`);
        }
      }
      break;
    }
    case "version": {
      rejectUnknownOptions(options, ["json"]);
      const versions = {
        protocol_version: protocolVersion,
        protocol_release: protocolRelease.release_id,
        protocol_release_digest: protocolReleaseDigest,
        protocol_package_version: protocolPackageVersion,
        conformance_suite_version: conformanceSuiteVersion,
        runtime_version: runtimeVersion,
        cli_version: CLI_VERSION
      };
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(versions, null, 2)}\n`
        : [
            `SeedSpec CLI: ${versions.cli_version}`,
            `Runtime: ${versions.runtime_version}`,
            `Protocol family: ${versions.protocol_version}`,
            `Exact protocol release: ${versions.protocol_release}`,
            `Protocol release digest: ${versions.protocol_release_digest}`,
            `Protocol schema package: ${versions.protocol_package_version}`,
            `Conformance suite: ${versions.conformance_suite_version}`
          ].join("\n") + "\n");
      break;
    }
    case "doctor": {
      rejectUnknownOptions(options, ["full", "json"]);
      const result = await inspectInstallation({
        cliVersion: CLI_VERSION,
        full: options.has("full")
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatInstallationInspection(result)}\n`);
      if (result.status !== "healthy") process.exitCode = 1;
      break;
    }
    case "review": {
      rejectUnknownOptions(options, ["area", "target", "state", "status", "summary", "json"]);
      if (options.has("status") && options.has("summary")) {
        throw new Error("Choose either --status or --summary");
      }
      const packagePath = requirePositional(positional, 0, "package path");
      const statusOnly = options.has("status") || options.has("summary");
      const context = await resolveAuthoringContext(packagePath, oneOption(options, "state"));
      const reviewOperation = () => auditPackage(context.packageRoot, {
        area: oneOption(options, "area"),
        target: oneOption(options, "target"),
        stateDirectory: context.stateRoot,
        toolVersion: CLI_VERSION,
        statusOnly
      });
      const result = statusOnly
        ? await reviewOperation()
        : await withAuthoringWorkspaceMutationLock(context.stateRoot, reviewOperation);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatAuthoringAudit(result, {
          statusOnly,
          summary: options.has("summary")
        })}\n`);
      break;
    }
    case "prepare": {
      rejectUnknownOptions(options, ["state", "status", "json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const statusOnly = options.has("status");
      const result = await preparePackage(packagePath, {
        stateDirectory: oneOption(options, "state"),
        toolVersion: CLI_VERSION,
        statusOnly
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatPreparation(result, { statusOnly })}\n`);
      break;
    }
    case "publish-check": {
      rejectUnknownOptions(options, ["state", "json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const result = await publishCheckPackage(packagePath, {
        stateDirectory: oneOption(options, "state"),
        toolVersion: CLI_VERSION
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatPublishCheck(result)}\n`);
      if (!result.ready) process.exitCode = 1;
      break;
    }
    case "pack": {
      rejectUnknownOptions(options, ["output", "state", "json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const result = await packPackage(packagePath, {
        outputDirectory: oneOption(options, "output"),
        stateDirectory: oneOption(options, "state"),
        toolVersion: CLI_VERSION
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatPackResult(result)}\n`);
      break;
    }
    case "eval": {
      rejectUnknownOptions(options, ["output", "json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const result = await createAuthorEvaluation(packagePath, {
        outputDirectory: oneOption(options, "output"),
        toolVersion: CLI_VERSION
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatAuthorEvaluation(result)}\n`);
      break;
    }
    case "skills": {
      rejectUnknownOptions(options, ["output", "skill", "json"]);
      const action = positional[0] ?? "list";
      let result;
      if (action === "list") {
        if (oneOption(options, "output") || oneOption(options, "skill")) {
          throw new Error("skills list does not accept --output or --skill");
        }
        result = await listBundledSkills();
      } else if (action === "export") {
        result = await exportBundledSkills(
          oneOption(options, "output") ?? ".agents/skills",
          { skill: oneOption(options, "skill") }
        );
      } else {
        throw new Error(`Unknown skills action: ${action}`);
      }
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatBundledSkills(result)}\n`);
      break;
    }
    case "upgrade": {
      rejectUnknownOptions(options, ["to", "write", "dry-run", "json"]);
      if (options.has("write") && options.has("dry-run")) {
        throw new Error("Choose either --dry-run or --write");
      }
      const packagePath = requirePositional(positional, 0, "package path");
      const result = await upgradePackage(packagePath, {
        to: oneOption(options, "to"),
        write: options.has("write")
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatUpgrade(result)}\n`);
      break;
    }
    case "docs": {
      rejectUnknownOptions(options, []);
      const topic = positional[0] ?? "authoring";
      if (topic === "authoring") {
        process.stdout.write(`SeedSpec CLI: ${CLI_VERSION}\n${formatAuthoringDocumentation(positional[1])}\n`);
      } else if (topic === "implementing") {
        if (positional[1]) throw new Error("Implementing documentation does not accept a subsection");
        process.stdout.write(`SeedSpec CLI: ${CLI_VERSION}\n${IMPLEMENTING_GUIDE.trim()}\n`);
      } else if (topic === "shell") {
        if (positional[1]) throw new Error("Shell documentation does not accept a subsection");
        process.stdout.write(`SeedSpec CLI: ${CLI_VERSION}\n${SHELL_GUIDE.trim()}\n`);
      } else {
        throw new Error(`Unknown documentation topic: ${topic}`);
      }
      break;
    }
    case "prompt": {
      rejectUnknownOptions(options, []);
      if (positional.length > 1) {
        throw new Error("prompt accepts at most one package path or GitHub URL");
      }
      process.stdout.write(`${formatPackageAgentPrompt(positional[0])}\n`);
      break;
    }
    case "begin": {
      rejectUnknownOptions(options, ["json"]);
      const packageInput = requirePositional(positional, 0, "root package path or GitHub URL");
      const beginning = await withPackageSource(packageInput, async ({ packagePath, source }) => {
        const result = await beginPackage(packagePath);
        if (!source) return result;
        return {
          ...result,
          package: {
            ...result.package,
            root: source.original
          },
          resolve_command: result.resolve_command.replace(JSON.stringify(packagePath), JSON.stringify(source.original))
        };
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(beginning, null, 2)}\n`
        : `${formatPackageBeginning(beginning)}\n`);
      break;
    }
    case "validate": {
      const packagePath = requirePositional(positional, 0, "package path");
      const record = await validatePackage(packagePath);
      process.stdout.write(`Valid SeedSpec package: ${record.manifest.id}@${record.manifest.version}\nKind hint: ${record.manifest.kind}\nDigest: ${record.digest}\n`);
      break;
    }
    case "digest": {
      const packagePath = requirePositional(positional, 0, "package path");
      const record = await validatePackage(packagePath);
      process.stdout.write(`${record.digest}\n`);
      break;
    }
    case "inspect": {
      const packagePath = requirePositional(positional, 0, "package path");
      const inspection = await inspectPackage(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(inspection, null, 2)}\n`
        : `${formatInspection(inspection)}\n`);
      break;
    }
    case "lint": {
      rejectUnknownOptions(options, ["json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const lint = await lintPackage(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(lint, null, 2)}\n`
        : `${formatPackageLint(lint)}\n`);
      break;
    }
    case "artifacts": {
      const packagePath = requirePositional(positional, 0, "package path");
      const listing = await listPackageArtifacts(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(listing, null, 2)}\n`
        : `${formatArtifactListing(listing)}\n`);
      break;
    }
    case "context": {
      const action = requirePositional(positional, 0, "context action");
      const integrations = options.get("integration") ?? [];
      if (action === "adapters") {
        rejectUnknownOptions(options, ["integration", "json"]);
        const registry = await registryFromIntegrations(integrations);
        const adapters = registry.list();
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(adapters, null, 2)}\n`
          : `${formatAdapterListing(adapters)}\n`);
        break;
      }
      if (action === "discover") {
        rejectUnknownOptions(options, ["integration", "json"]);
        const packagePath = requirePositional(positional, 1, "package path");
        const discovery = await discoverFormatIntegrations(packagePath, integrations);
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(discovery, null, 2)}\n`
          : `${formatIntegrationDiscovery(discovery)}\n`);
        break;
      }
      if (action === "validate") {
        rejectUnknownOptions(options, ["integration", "adapter", "json"]);
        const packagePath = requirePositional(positional, 1, "package path");
        const module = requirePositional(positional, 2, "context module");
        const registry = await registryFromIntegrations(integrations);
        const result = await validateContextModule(packagePath, module, {
          registry,
          adapterId: oneOption(options, "adapter")
        });
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(result, null, 2)}\n`
          : `${formatContextValidation(result)}\n`);
        if (!result.valid) process.exitCode = 1;
        break;
      }
      if (action === "prepare") {
        rejectUnknownOptions(options, ["request", "output", "integration", "json"]);
        const projectPath = requirePositional(positional, 1, "resolved project path");
        const request = oneOption(options, "request");
        if (!request) throw new Error("Option --request is required");
        const output = oneOption(options, "output");
        if (!output) throw new Error("Option --output is required");
        const registry = await registryFromIntegrations(integrations);
        const result = await prepareContext(projectPath, request, output, { registry });
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(result, null, 2)}\n`
          : `${formatContextPreparation(result)}\n`);
        if (result.bundle.modules.some((module) => module.validation.status === "invalid")) {
          process.exitCode = 1;
        }
        break;
      }
      if (action === "record-use") {
        rejectUnknownOptions(options, ["input", "output", "json"]);
        const preparedPath = requirePositional(positional, 1, "prepared context path");
        const inputPath = oneOption(options, "input");
        if (!inputPath) throw new Error("Option --input is required");
        const usage = JSON.parse(readFileSync(path.resolve(inputPath), "utf8"));
        const output = oneOption(options, "output")
          ?? path.join(path.resolve(preparedPath), "context-use-receipt.json");
        const result = await recordContextUse(preparedPath, usage, output);
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(result, null, 2)}\n`
          : `Recorded context use: ${result.receipt_id}\nReceipt: ${path.resolve(output)}\n`);
        break;
      }
      if (action === "author") {
        rejectUnknownOptions(options, ["integration", "write", "dry-run", "state", "json"]);
        const packagePath = requirePositional(positional, 1, "package path");
        if (integrations.length === 0) throw new Error("Supply at least one --integration source");
        const plan = await planIntegrationBridges(packagePath, integrations);
        const result = options.has("write")
          ? await applyIntegrationBridgePlan(plan, { stateRoot: oneOption(options, "state") })
          : null;
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(result ?? plan, null, 2)}\n`
          : `${formatIntegrationBridgePlan(plan)}${result ? `\nApplied package digest: ${result.digest}` : "\nDry run. Add --write to apply."}\n`);
        break;
      }
      throw new Error(`Unknown context action: ${action}`);
    }
    case "resources": {
      rejectUnknownOptions(options, ["json", "show"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const show = oneOption(options, "show");
      if (show) {
        const bundled = await readBundledResource(packagePath, show);
        process.stdout.write(options.has("json")
          ? `${JSON.stringify(bundled, null, 2)}\n`
          : `${formatBundledResource(bundled)}\n`);
        break;
      }
      const listing = await listPackageImplementationResources(packagePath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(listing, null, 2)}\n`
        : `${formatImplementationResourceListing(listing)}\n`);
      break;
    }
    case "resolve-resources": {
      rejectUnknownOptions(options, ["json"]);
      const projectPath = requirePositional(positional, 0, "project path");
      const state = await resolveImplementationResources(projectPath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(state, null, 2)}\n`
        : `${formatImplementationResourceResolution(state)}\n`);
      break;
    }
    case "record-resource-use": {
      rejectUnknownOptions(options, ["reason", "json"]);
      const projectPath = requirePositional(positional, 0, "project path");
      const packageId = requirePositional(positional, 1, "package ID");
      const resourceId = requirePositional(positional, 2, "resource ID");
      const useStatus = requirePositional(positional, 3, "consulted or skipped status");
      const result = await recordImplementationResourceUse(projectPath, {
        packageId,
        resourceId,
        useStatus,
        reason: oneOption(options, "reason")
      });
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `Recorded ${result.package}/${result.id}: ${result.use_status}${result.use_reason ? ` — ${result.use_reason}` : ""}\n`);
      break;
    }
    case "resource-digest": {
      rejectUnknownOptions(options, []);
      const resourcePath = requirePositional(positional, 0, "resource directory");
      process.stdout.write(`${await computeDirectoryDigest(resourcePath)}\n`);
      break;
    }
    case "discover-providers": {
      const consumerPath = requirePositional(positional, 0, "package path");
      const providerResult = await discoverProviders(consumerPath, options.get("catalog") ?? []);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(providerResult, null, 2)}\n`
        : `${formatProviderDiscovery(providerResult)}\n`);
      break;
    }
    case "discover-features": {
      const rootPath = requirePositional(positional, 0, "root package path");
      const result = await discoverFeatures(rootPath, options.get("catalog") ?? []);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatFeatureDiscovery(result)}\n`);
      break;
    }
    case "resolve": {
      rejectUnknownOptions(options, [
        "feature",
        "add",
        "implementation",
        "output",
        "configuration-selections",
        "applied-intent",
        "completion-scope",
        "technical-preferences",
        "artifact-selections",
        "decisions"
      ]);
      const rootInput = requirePositional(positional, 0, "root package path or GitHub URL");
      const result = await withPackageSource(
        rootInput,
        ({ packagePath }) => resolveProject(packagePath, {
          additionPaths: options.get("add") ?? [],
          featurePaths: options.get("feature") ?? [],
          implementationProfiles: options.get("implementation") ?? [],
          outputDirectory: oneOption(options, "output"),
          configurationSelectionsPath: oneOption(options, "configuration-selections"),
          appliedIntentPath: oneOption(options, "applied-intent"),
          completionScopePath: oneOption(options, "completion-scope"),
          technicalPreferencesPath: oneOption(options, "technical-preferences"),
          artifactSelectionsPath: oneOption(options, "artifact-selections"),
          decisionsPath: oneOption(options, "decisions")
        })
      );
      process.stdout.write(`Resolved ${result.project.root.id} with ${result.additions.length} addition(s)\nProject status: ${result.project.status}\nWorkspace: ${result.workspace}\n`);
      break;
    }
    case "completion": {
      rejectUnknownOptions(options, ["json"]);
      const projectPath = requirePositional(positional, 0, "project path");
      const result = await inspectProjectCompletion(projectPath);
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatProjectCompletion(result)}\n`);
      break;
    }
    case "capability-conformance": {
      rejectUnknownOptions(options, ["result", "json"]);
      const packagePath = requirePositional(positional, 0, "package path");
      const capabilityId = requirePositional(positional, 1, "capability ID");
      const result = await inspectCapabilityConformance(
        packagePath,
        capabilityId,
        oneOption(options, "result")
      );
      process.stdout.write(options.has("json")
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatCapabilityConformance(result)}\n`);
      break;
    }
    case "init": {
      const kind = requirePositional(positional, 0, "package kind");
      const output = oneOption(options, "output") ?? `${kind}-package`;
      const result = await initPackage(kind, output);
      process.stdout.write(`Created valid SeedSpec package (kind hint: ${kind}): ${result.root}\n`);
      break;
    }
    case "conformance": {
      rejectUnknownOptions(options, ["json", "output"]);
      const result = positional[0]
        ? await runConformanceSuite(positional[0])
        : await runBundledConformanceSuite();
      const reportJson = `${JSON.stringify(result, null, 2)}\n`;
      const outputPath = oneOption(options, "output");
      if (outputPath) {
        await writeFile(path.resolve(outputPath), reportJson, "utf8");
      }
      process.stdout.write(options.has("json")
        ? reportJson
        : `${formatConformanceResult(result)}${outputPath ? `\nReport: ${path.resolve(outputPath)}` : ""}\n`);
      if (result.status !== "conformant") process.exitCode = 1;
      break;
    }
    case "verify-lock": {
      const projectPath = requirePositional(positional, 0, "project path");
      const result = await verifyProjectLock(projectPath, options.get("package") ?? []);
      process.stdout.write(`Verified ${result.verifiedPackages.length} package(s) and ${result.verifiedCapabilityDeclarations.length} capability declaration(s)\n`);
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

run().catch((error) => {
  process.stderr.write(`Error: ${formatError(error)}\n`);
  process.exitCode = 1;
});
