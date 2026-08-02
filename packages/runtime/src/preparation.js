import { auditPackage, formatAuthoringAudit } from "./authoring.js";
import {
  formatPublishCheck,
  publishCheckPackage
} from "./publishing.js";
import { lintPackage } from "./lint.js";
import { validatePackage } from "./validate.js";

export const PREPARATION_FORMAT = "1";

export async function preparePackage(inputPath, {
  stateDirectory,
  toolVersion = "unknown",
  statusOnly = false
} = {}) {
  const [record, lint] = await Promise.all([
    validatePackage(inputPath),
    lintPackage(inputPath)
  ]);
  // Preparation reports readiness; it never starts a review pass or changes the
  // author's coaching depth. Silently resetting `target` to "package" as a side
  // effect of asking "am I ready?" discarded an in-flight session's setting.
  const review = await auditPackage(inputPath, {
    stateDirectory,
    toolVersion,
    statusOnly: true
  });

  const publishCheck = await publishCheckPackage(inputPath, {
    stateDirectory,
    toolVersion
  });
  const phase = publishCheck.ready
    ? "ready-to-pack"
    : review.current?.outcome === "needs-author"
      || review.proposals.proposed > 0
      || review.proposals.accepted > 0
      ? "author-resolution"
      : "final-check";

  const phaseStatuses = {
    baseline: "completed",
    "guided-review": review.complete ? "completed" : review.current ? "available" : "optional",
    "author-resolution": review.questions.open > 0
      || review.proposals.proposed > 0
      || review.proposals.accepted > 0
      ? "available"
      : "not-needed",
    "publish-check": publishCheck.ready ? "completed" : "blocked",
    "agent-evaluation": "optional",
    pack: publishCheck?.ready ? "ready" : "pending"
  };

  return {
    preparation_version: PREPARATION_FORMAT,
    phase,
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      protocol_version: record.manifest.protocol_version,
      digest: record.digest
    },
    phases: [
      {
        id: "baseline",
        status: phaseStatuses.baseline,
        purpose: "Validate protocol structure, content integrity, and deterministic authoring diagnostics."
      },
      {
        id: "guided-review",
        status: phaseStatuses["guided-review"],
        purpose: "Optionally work through four source-bound conversations; good enough is a valid outcome."
      },
      {
        id: "author-resolution",
        status: phaseStatuses["author-resolution"],
        purpose: "Resolve optional session questions and decide or apply document proposals without turning them into protocol obligations."
      },
      {
        id: "publish-check",
        status: phaseStatuses["publish-check"],
        purpose: "Confirm stable valid bytes and a separate package-authored success document."
      },
      {
        id: "agent-evaluation",
        status: phaseStatuses["agent-evaluation"],
        purpose: "Optionally test an independent handoff and feed observed specification gaps back to the author."
      },
      {
        id: "pack",
        status: phaseStatuses.pack,
        purpose: "Create a distributable archive, inspection record, publish check, and digest-bound receipt."
      }
    ],
    lint,
    review,
    publish_check: publishCheck,
    next_command: phase === "ready-to-pack"
      ? `seedspec pack ${JSON.stringify(record.root)}`
      : `seedspec publish-check ${JSON.stringify(record.root)}`
  };
}

export function formatPreparation(result, {
  statusOnly = false,
  authorCommand = false
} = {}) {
  const lines = [
    `SeedSpec preparation: ${result.package.id}@${result.package.version}`,
    `Current phase: ${result.phase}`,
    `Package digest: ${result.package.digest}`,
    "",
    "Lifecycle:"
  ];
  for (const [index, phase] of result.phases.entries()) {
    lines.push(`${index + 1}. ${phase.id} — ${phase.status}`);
    lines.push(`   ${phase.purpose}`);
  }
  lines.push("");
  if (result.publish_check) {
    lines.push(formatPublishCheck(result.publish_check));
  } else {
    lines.push(formatAuthoringAudit(result.review, { statusOnly }));
  }
  const nextCommand = authorCommand
    ? result.phase === "ready-to-pack"
      ? "npx @seedspec/cli author pack"
      : result.phase === "final-check"
        ? "npx @seedspec/cli author check"
        : "npx @seedspec/cli author review"
    : result.next_command;
  lines.push("", `Next: ${nextCommand}`);
  return lines.join("\n");
}
