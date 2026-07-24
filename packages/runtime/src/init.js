import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { validatePackage } from "./validate.js";

const definitionSectionsByKind = Object.freeze({
  solution: [
    ["Outcome", "Describe the compound result that should be accomplished."],
    ["Boundaries", "Define what belongs in the solution and what remains outside it."],
    ["Participants and dependencies", "Identify the people, agents, systems, and existing capabilities involved."],
    ["Behavior and coordination", "Define the important behavior, handoffs, state changes, failures, and edge cases."],
    ["Observable success", "Describe evidence that the overall outcome works."]
  ],
  application: [
    ["Outcome", "Describe the user-facing product outcome."],
    ["Actors and permissions", "Define the people, agents, and systems involved and what each may do."],
    ["Domain concepts and state", "Define observable concepts, rules, state, and lifecycle behavior."],
    ["Workflows", "Describe primary and exceptional user workflows without prescribing interface architecture."],
    ["Failure behavior", "Describe errors, conflicts, recovery, and important edge cases."],
    ["Observable success", "Describe product behavior that demonstrates the application works."]
  ],
  feature: [
    ["Host boundary", "Describe the existing solution this behavior extends and what the feature must not replace."],
    ["Added behavior", "Define the observable behavior introduced or changed."],
    ["Capabilities and integration", "Describe required and provided capabilities plus host integration expectations."],
    ["Configurable variation", "Describe meaningful variations without embedding implementation options."],
    ["Failure behavior", "Describe failures, conflicts, recovery, and host-safe behavior."],
    ["Observable success", "Describe acceptance that remains meaningful across host implementations."]
  ],
  workflow: [
    ["Outcome", "Describe the coordinated result the workflow should produce."],
    ["Participants", "Identify people, agents, and systems plus their responsibilities and authority."],
    ["Starting conditions", "Define what starts the workflow and what must already be true."],
    ["Stages and handoffs", "Describe stages, decisions, handoffs, and information passed between participants."],
    ["Failure and recovery", "Describe interruption, retry, compensation, escalation, and duplicate handling."],
    ["Completion evidence", "Describe how participants can establish that the workflow completed faithfully."]
  ],
  automation: [
    ["Outcome and ownership", "Describe the automated result and the accountable operational owner."],
    ["Trigger or schedule", "Define events, cadence, time boundaries, and timezone behavior."],
    ["Behavior and idempotency", "Describe processing rules, state, duplicate prevention, and replay behavior."],
    ["Permissions and side effects", "Define allowed access and consequential changes or deliveries."],
    ["Failure and observability", "Describe retries, terminal failures, monitoring, alerting, and recovery."],
    ["Completion evidence", "Describe records or observations that demonstrate each run's outcome."]
  ],
  configuration: [
    ["Desired state", "Describe the observable state that should exist in the target system."],
    ["Target and existing-state discovery", "Identify the target boundary and how current state should be inspected before change."],
    ["Access, ownership, and naming", "Define required authority, accountable owners, and durable resource identity."],
    ["Reconciliation and idempotency", "Describe safe reruns, drift handling, conflicts, and duplicate prevention."],
    ["Rollback and recovery", "Describe how incorrect or partial configured state can be corrected."],
    ["Verification evidence", "Describe durable identifiers, observations, or records that establish the desired state."]
  ],
  integration: [
    ["Outcome and participating systems", "Describe the cross-system result and the boundary of every participating system."],
    ["Concept and data mappings", "Define how relevant concepts, records, fields, and meanings correspond."],
    ["Direction and synchronization", "Describe source authority, directionality, timing, ordering, and reconciliation."],
    ["Authorization boundary", "Define permissions, credential ownership, data handling, and prohibited access."],
    ["Partial failure and recovery", "Describe retries, idempotency, duplicates, conflicts, and partial completion."],
    ["Verification evidence", "Describe how to establish faithful behavior across all participating systems."]
  ]
});

function starterDefinition(title, kind) {
  const [purpose, ...remaining] = definitionSectionsByKind[kind];
  const success = remaining.at(-1);
  const obligations = remaining.slice(0, -1)
    .map(([heading, prompt]) => `### ${heading}\n\n${prompt}`)
    .join("\n\n");
  return `# ${title}\n\n> \`${kind}\` is an authoring hint that shapes these prompts, not an implementation constraint.\n\n## Purpose\n\n### ${purpose[0]}\n\n${purpose[1]} Explain why the outcome matters and whose situation should change.\n\n## Obligations and boundaries\n\nState required outcomes, invariants, genuine constraints, forbidden states, and non-goals explicitly. A non-goal is not required; a forbidden state is not allowed.\n\n${obligations}\n\n## Success and evidence\n\n${success[1]} Separate the verification plan from actual evidence. Identify whether each observation proves the realization itself or a later outcome; neither proves that the package is generally trustworthy.\n\n## Decision latitude\n\nState what is fixed by intent, what the end user must decide for a realization, and what a capable implementing agent may choose. Keep provider-, architecture-, and tool-specific suggestions in implementation profiles unless they are genuine outcome constraints.\n`;
}

function titleFromDirectory(directory) {
  return path.basename(directory)
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function idFromDirectory(directory) {
  const slug = path.basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "package";
  return `org.example.${slug}`;
}

export async function initPackage(kind, outputDirectory) {
  const supportedKinds = [
    "solution",
    "application",
    "feature",
    "workflow",
    "automation",
    "configuration",
    "integration"
  ];
  if (!supportedKinds.includes(kind)) {
    throw new SeedSpecError(`Unknown package kind: ${kind}`, { code: "INVALID_KIND" });
  }

  const root = path.resolve(outputDirectory);
  const title = titleFromDirectory(root);
  const manifest = {
    protocol_version: "0.2",
    id: idFromDirectory(root),
    name: title,
    version: "0.1.0",
    kind,
    description: `Describe the ${kind}'s intended outcome.`,
    definition: {
      entrypoint: `definition/${kind}.md`
    },
    configuration: {
      schema: "configuration/schema.json",
      example: "configuration/example.yaml"
    },
    ...(kind === "feature" ? {
      requires: { capabilities: [] }
    } : {}),
    provides: { capabilities: [] },
    ...(kind === "feature" ? {
      compatibility: { scope: "generic" }
    } : {}),
    components: {
      acceptance: "acceptance/"
    }
  };
  const definition = starterDefinition(title, kind);
  const configurationSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `${title} configuration`,
    type: "object",
    additionalProperties: false,
    properties: {}
  };

  await Promise.all([
    mkdir(path.join(root, "definition"), { recursive: true }),
    mkdir(path.join(root, "configuration"), { recursive: true }),
    mkdir(path.join(root, "acceptance"), { recursive: true })
  ]);
  await Promise.all([
    writeFile(path.join(root, "seedspec.yaml"), stringifyYaml(manifest), "utf8"),
    writeFile(path.join(root, manifest.definition.entrypoint), definition, "utf8"),
    writeFile(path.join(root, "configuration/schema.json"), `${JSON.stringify(configurationSchema, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "configuration/example.yaml"), "{}\n", "utf8"),
    writeFile(path.join(root, "acceptance/criteria.md"), `# ${title} acceptance criteria\n\n1. Replace this item with an observable condition of the realization.\n\nFor each criterion, explain what observation would prove it and whether the evidence concerns the realization or a later outcome. Actual evidence is recorded only after work begins.\n`, "utf8")
  ]);

  await validatePackage(root);
  return { root, manifest };
}
