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
  const review = await auditPackage(inputPath, {
    stateDirectory,
    target: statusOnly ? undefined : "package",
    toolVersion,
    statusOnly
  });

  let publishCheck = null;
  let phase;
  if (!review.complete) {
    phase = review.current?.outcome === "needs-author"
      ? "author-resolution"
      : "guided-review";
  } else {
    publishCheck = await publishCheckPackage(inputPath, {
      stateDirectory,
      toolVersion
    });
    phase = publishCheck.ready ? "ready-to-pack" : "final-check";
  }

  const phaseStatuses = {
    baseline: "completed",
    "guided-review": review.complete ? "completed" : "active",
    "author-resolution": review.questions.open > 0 ? "active" : "available",
    "publish-check": !publishCheck
      ? "pending"
      : publishCheck.ready ? "completed" : "blocked",
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
        purpose: "Work through the seven versioned review lenses with an author and capable agent."
      },
      {
        id: "author-resolution",
        status: phaseStatuses["author-resolution"],
        purpose: "Resolve consequential questions without inventing answers or hiding deferred judgment."
      },
      {
        id: "publish-check",
        status: phaseStatuses["publish-check"],
        purpose: "Confirm stable bytes, completed review records, and no open authoring questions."
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
      : phase === "final-check"
        ? `seedspec publish-check ${JSON.stringify(record.root)}`
        : `seedspec prepare ${JSON.stringify(record.root)} --state ${JSON.stringify(review.state)}`
  };
}

export function formatPreparation(result, { statusOnly = false } = {}) {
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
  lines.push("", `Next: ${result.next_command}`);
  return lines.join("\n");
}
