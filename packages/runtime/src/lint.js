import { readMarkdownComponent } from "./files.js";
import { validatePackage } from "./validate.js";

const implementationSignals = Object.freeze([
  ["Next.js", /\bnext\.?js\b/i],
  ["Rails", /\brails\b/i],
  ["React", /\breact\b/i],
  ["Vue", /\bvue(?:\.js)?\b/i],
  ["Angular", /\bangular\b/i],
  ["PostgreSQL", /\bpostgres(?:ql)?\b/i],
  ["MySQL", /\bmysql\b/i],
  ["Vercel", /\bvercel\b/i],
  ["AWS", /\baws\b/i],
  ["Azure", /\bazure\b/i],
  ["Kubernetes", /\bkubernetes\b/i],
  ["Docker", /\bdocker\b/i],
  ["repository layout", /\brepository layout\b/i],
  ["folder structure", /\bfolder structure\b/i]
]);

const uiSignals = /\b(screen|page|route|component|navigation|design system)\b/gi;

function diagnostic(code, level, scope, message, suggestion) {
  return { code, level, scope, message, suggestion };
}

function implementationDetailDiagnostics(kind, definition) {
  const detected = implementationSignals
    .filter(([, pattern]) => pattern.test(definition))
    .map(([label]) => label);
  const diagnostics = [];
  if (detected.length > 0) {
    diagnostics.push(diagnostic(
      "CORE_INTENT_MAY_CONTAIN_IMPLEMENTATION_DETAIL",
      "review",
      "definition",
      `The core definition names implementation-specific technology: ${detected.join(", ")}.`,
      "Keep it in core intent only when the outcome genuinely depends on it; otherwise move it to an implementation profile or user implementation preference."
    ));
  }
  if (["configuration", "integration"].includes(kind)) {
    const uiTerms = [...new Set([...definition.matchAll(uiSignals)].map((match) => match[1].toLowerCase()))];
    if (uiTerms.length > 0) {
      diagnostics.push(diagnostic(
        "KIND_SCOPE_MAY_INCLUDE_APPLICATION_UI",
        "review",
        "definition",
        `The ${kind} definition contains application-UI language: ${uiTerms.join(", ")}.`,
        "Retain UI behavior only when it is part of the intended outcome; move screen architecture and component choices into an implementation profile."
      ));
    }
  }
  return diagnostics;
}

function implementationProfileDiagnostics(manifest) {
  const profiles = manifest.implementation_profiles ?? [];
  return profiles.flatMap((profile) => {
    const scope = `implementation_profiles.${profile.id}`;
    const conditions = [...(profile.prerequisites ?? []), ...(profile.blockers ?? [])];
    const diagnostics = [];
    for (const condition of conditions) {
      if (condition.statement.trim().endsWith("?")) {
        diagnostics.push(diagnostic(
          "PROFILE_CONDITION_IS_QUESTION",
          "review",
          `${scope}.${condition.id}`,
          "The condition is written as a question rather than a declarative assertion.",
          "State the fact that must be established; the implementing agent can choose appropriate question wording when confirmation is needed."
        ));
      }
      const method = condition.verification.method;
      if (method.includes(".")) {
        diagnostics.push(diagnostic(
          "CUSTOM_VERIFICATION_METHOD",
          "information",
          `${scope}.${condition.id}`,
          `The condition uses namespaced verification method ${method}.`,
          "Ensure the package guidance explains interoperable behavior for tools that do not recognize this method."
        ));
      }
      if (["tool-check", "document-review"].includes(method)
        && condition.verification.evidence === "none") {
        diagnostics.push(diagnostic(
          "VERIFICATION_EVIDENCE_UNRECORDED",
          "review",
          `${scope}.${condition.id}`,
          `${method} is configured without an evidence expectation.`,
          "Prefer optional or required evidence when a tool result or document determines whether a profile is viable."
        ));
      }
    }
    return diagnostics;
  });
}

async function successMaterialDiagnostics(record) {
  if (!record.manifest.components?.acceptance) {
    return [diagnostic(
      "SUCCESS_MATERIAL_UNDECLARED",
      "review",
      "components.acceptance",
      "The package has no separate author-authored success document.",
      "Add the smallest success Markdown that describes observable results already supported by the seed."
    )];
  }
  const success = await readMarkdownComponent(record, "acceptance");
  if (success.trim() === "") {
    return [diagnostic(
      "SUCCESS_MATERIAL_EMPTY",
      "review",
      "components.acceptance",
      "The declared success component contains no readable Markdown.",
      "Add at least one observable result supported by the seed."
    )];
  }
  if (/replace this item|describe observable success|describe at least one result/i.test(success)) {
    return [diagnostic(
      "SUCCESS_MATERIAL_PLACEHOLDER",
      "review",
      "components.acceptance",
      "The success document still contains starter placeholder text.",
      "Replace the placeholder with at least one observable result supported by the seed."
    )];
  }
  return [];
}

function starterMaterialDiagnostics(record) {
  const diagnostics = [];
  if (record.definition.includes(
    "Describe what should exist or change, who it is for, and why it matters."
  )) {
    diagnostics.push(diagnostic(
      "STARTER_INTENT_PLACEHOLDER",
      "review",
      "definition",
      "The primary intent still contains starter scaffold text.",
      "Replace the scaffold with the product direction the author supplied and confirmed."
    ));
  }
  if (record.manifest.description === `Describe the ${record.manifest.kind}'s intended outcome.`) {
    diagnostics.push(diagnostic(
      "STARTER_DESCRIPTION_PLACEHOLDER",
      "review",
      "description",
      "The package description still contains starter placeholder text.",
      "Replace the placeholder with a concise description of the confirmed product direction."
    ));
  }
  if (record.manifest.id === "org.example.seedspec" && record.manifest.name === "Seedspec") {
    diagnostics.push(diagnostic(
      "STARTER_IDENTITY_PLACEHOLDER",
      "review",
      "id",
      "The package still uses the generic starter identity.",
      "Replace the starter name and package ID with an identity derived from the confirmed product direction."
    ));
  }
  return diagnostics;
}

/**
 * A declared capability is a promise to whoever composes this package. A
 * promise with no way to observe it is hope: the composing agent inherits the
 * claim and no means of checking it survived the mapping.
 *
 * Source-bound — this only fires on capabilities the author actually declared,
 * and it never asks for criteria about anything the package does not claim.
 */
async function capabilityAcceptanceDiagnostics(record) {
  const declared = record.manifest.provides.capabilities;
  if (declared.length === 0) return [];

  // Deliberately only the mechanical fact: capabilities promised, nothing to
  // check them against. Matching capability names against criteria text was
  // tried and systematically misfired -- `family-coordination` is fully covered
  // by criteria about households, events, and tasks that never use the word
  // "coordination". A capability name is an abstraction; criteria are concrete.
  // Inferring a gap from vocabulary would be exactly the checklist behavior the
  // source-bound rule exists to prevent.
  if (record.manifest.components?.acceptance) return [];
  return [diagnostic(
    "CAPABILITY_WITHOUT_ACCEPTANCE_COVERAGE",
    "recommendation",
    "provides.capabilities",
    `This package declares ${declared.length} capability contract(s) and no success material an adopter could check them against.`,
    "Add observable criteria for the behavior each declared capability promises. Whoever composes this package inherits the promise; without criteria they inherit no way to verify it survived."
  )];
}

export async function lintPackage(inputPath) {
  const record = await validatePackage(inputPath);
  const diagnostics = [
    ...starterMaterialDiagnostics(record),
    ...await successMaterialDiagnostics(record),
    ...await capabilityAcceptanceDiagnostics(record),
    ...implementationDetailDiagnostics(record.manifest.kind, record.definition),
    ...implementationProfileDiagnostics(record.manifest)
  ];
  const counts = diagnostics.reduce(
    (result, item) => ({ ...result, [item.level]: result[item.level] + 1 }),
    { review: 0, recommendation: 0, information: 0 }
  );
  return {
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      name: record.manifest.name,
      kind: record.manifest.kind,
      digest: record.digest
    },
    protocol_valid: true,
    review_basis: "source-bound",
    diagnostics,
    counts
  };
}

export function formatPackageLint(result) {
  const lines = [
    `Source-bound authoring review: ${result.package.name}`,
    `Kind hint: ${result.package.kind}`,
    `Review basis: ${result.review_basis}`,
    `Protocol valid: yes`,
    `Diagnostics: ${result.counts.review} review, ${result.counts.recommendation} recommendation, ${result.counts.information} information`
  ];
  if (result.diagnostics.length === 0) {
    lines.push("No source-triggered authoring diagnostic was produced. This is not a completeness or quality certification.");
  } else {
    for (const item of result.diagnostics) {
      lines.push(
        "",
        `[${item.level.toUpperCase()}] ${item.code} (${item.scope})`,
        item.message,
        `Suggestion: ${item.suggestion}`
      );
    }
  }
  return lines.join("\n");
}
