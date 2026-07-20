import { validatePackage } from "./validate.js";

const kindGuidance = Object.freeze({
  solution: [
    ["outcome", ["outcome", "purpose", "accomplish", "result"]],
    ["boundaries", ["boundary", "scope", "out of scope", "depends"]],
    ["success", ["success", "acceptance", "conformance", "evidence", "verify"]]
  ],
  application: [
    ["actors", ["actor", "user", "role", "guardian", "customer", "operator"]],
    ["permissions", ["permission", "authorize", "access", "may ", "cannot"]],
    ["workflows or state", ["workflow", "state", "transition", "lifecycle"]],
    ["failure behavior", ["failure", "fails", "error", "retry", "conflict"]],
    ["observable success", ["acceptance", "conformance", "evidence", "verify"]]
  ],
  feature: [
    ["host boundary", ["host", "existing", "application", "solution"]],
    ["capability or integration expectations", ["capability", "integration", "requires", "provides"]],
    ["configurable behavior", ["configuration", "configurable", "variation"]],
    ["failure behavior", ["failure", "fails", "error", "retry", "conflict"]],
    ["observable success", ["acceptance", "conformance", "evidence", "verify"]]
  ],
  workflow: [
    ["participants", ["participant", "actor", "user", "agent", "system", "owner"]],
    ["stages or handoffs", ["step", "stage", "handoff", "workflow", "then"]],
    ["trigger or starting condition", ["trigger", "starts", "begin", "schedule", "event"]],
    ["failure and recovery", ["failure", "fails", "retry", "recover", "duplicate"]],
    ["completion evidence", ["complete", "success", "evidence", "verify", "delivery"]]
  ],
  automation: [
    ["trigger or schedule", ["trigger", "schedule", "event", "cadence", "timezone"]],
    ["operational ownership", ["owner", "operator", "responsible", "on-call"]],
    ["idempotency or duplicate prevention", ["idempotent", "duplicate", "exactly once"]],
    ["failure and retry behavior", ["failure", "fails", "retry", "backoff", "dead letter"]],
    ["observability", ["monitor", "alert", "audit", "evidence", "log"]]
  ],
  configuration: [
    ["desired state", ["desired state", "target state", "configured", "property", "setting"]],
    ["existing-state discovery", ["existing", "current state", "inspect", "discover"]],
    ["drift or idempotency", ["drift", "idempotent", "reconcile", "duplicate"]],
    ["rollback or recovery", ["rollback", "restore", "recover", "revert"]],
    ["verification evidence", ["verify", "evidence", "audit", "identifier", "screenshot"]]
  ],
  integration: [
    ["participating systems", ["system", "platform", "service", "source", "target"]],
    ["data or concept mapping", ["mapping", "map ", "transform", "field", "object"]],
    ["authorization boundary", ["authorization", "permission", "credential", "access", "scope"]],
    ["direction and synchronization", ["direction", "synchronize", "sync", "source", "target", "inbound", "outbound"]],
    ["partial failure and retry behavior", ["partial", "failure", "fails", "retry", "idempotent", "duplicate"]]
  ]
});

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

function missingKindConcepts(kind, definition) {
  const guidance = kindGuidance[kind] ?? kindGuidance.solution;
  const normalized = definition.toLowerCase();
  return guidance
    .filter(([, signals]) => !signals.some((signal) => normalized.includes(signal)))
    .map(([concept]) => diagnostic(
      "KIND_RECOMMENDED_CONCEPT_MISSING",
      "recommendation",
      "definition",
      `The ${kind} definition does not clearly address ${concept}.`,
      `Add ${concept} when it is known and material, or leave the package sparse rather than inventing detail.`
    ));
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
    if (profiles.length > 1 && conditions.length === 0) {
      diagnostics.push(diagnostic(
        "PROFILE_APPLICABILITY_UNSPECIFIED",
        "recommendation",
        scope,
        "This candidate profile declares no prerequisite or blocker condition.",
        "Describe what makes this profile viable or unsuitable so an agent can compare it with the other candidates."
      ));
    }
    if ((profile.tradeoffs ?? []).length === 0) {
      diagnostics.push(diagnostic(
        "PROFILE_TRADEOFFS_UNSPECIFIED",
        "recommendation",
        scope,
        "This implementation profile declares no tradeoff.",
        "Record only material consequences that help a user and agent compare implementation directions."
      ));
    }
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

export async function lintPackage(inputPath) {
  const record = await validatePackage(inputPath);
  const knownKind = Object.hasOwn(kindGuidance, record.manifest.kind);
  const diagnostics = [
    ...(!knownKind ? [diagnostic(
      "CUSTOM_KIND_USES_SOLUTION_GUIDANCE",
      "information",
      "manifest.kind",
      `The namespaced kind hint ${record.manifest.kind} has no core authoring profile.`,
      "Generic tooling will preserve it and apply solution-oriented guidance."
    )] : []),
    ...missingKindConcepts(knownKind ? record.manifest.kind : "solution", record.definition),
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
    kind_guidance: knownKind ? record.manifest.kind : "solution",
    diagnostics,
    counts
  };
}

export function formatPackageLint(result) {
  const lines = [
    `Kind-aware authoring review: ${result.package.name}`,
    `Kind hint: ${result.package.kind}`,
    `Protocol valid: yes`,
    `Diagnostics: ${result.counts.review} review, ${result.counts.recommendation} recommendation, ${result.counts.information} information`
  ];
  if (result.diagnostics.length === 0) {
    lines.push("No kind-aware authoring diagnostic was produced. This is not a completeness or quality certification.");
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
