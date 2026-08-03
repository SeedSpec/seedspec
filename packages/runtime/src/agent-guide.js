import { formatContextInventory } from "./context.js";

export function requirementSummary(requirement) {
  const providers = requirement.providers.length === 0
    ? "no selected package declares a provider"
    : requirement.providers.map((candidate) => {
      if (candidate.revision_status === "tested-revision") {
        return `${candidate.provider.id}@${candidate.provided_version} (tested revision)`;
      }
      const changes = candidate.declared_changes.flatMap((transition) => (
        transition.changes.map((change) => `${change.type} ${change.id}: ${change.summary}`)
      ));
      const changeSummary = changes.length > 0
        ? `; declared changes: ${changes.join(" | ")}`
        : "";
      return `${candidate.provider.id}@${candidate.provided_version} (${candidate.revision_direction} ${candidate.revision_difference}; ${candidate.review_severity} severity; change evidence ${candidate.change_evidence}${changeSummary})`;
    }).join(", ");
  const issues = requirement.issues.length ? requirement.issues.join(", ") : "none";
  return `${requirement.consumer} expects ${requirement.capability}@${requirement.tested_against}; declared candidates: ${providers}; issues: ${issues}`;
}

export function reviewRevisionSummary(review) {
  if (!review.revision) return "";
  return `; revision: ${review.revision.tested_against} -> ${review.revision.provided_version} (${review.revision.direction} ${review.revision.difference}; change evidence ${review.revision.change_evidence})`;
}

export function reviewKey(review) {
  return `${review.code}\0${review.capability ?? ""}\0${review.packages.join(",")}`;
}

export function requirementKey(requirement) {
  return `${requirement.consumer}\0${requirement.capability}`;
}

/**
 * Separates "this package is waiting to be joined to a host" from "a host was
 * chosen and something is wrong".
 *
 * A feature declares the host concepts it needs precisely so an agent can map
 * them to whatever the host calls those things. When no host has been selected,
 * every such declaration is unsatisfied by design; surfacing them as review
 * findings made a correct package look broken.
 */
export function hostConceptExpectations(reviews, requirements) {
  const expectations = reviews.filter(
    (review) => review.code === "no-declared-provider" && review.severity === "low"
  );
  const capabilities = new Set(expectations.map((review) => review.capability));
  const items = requirements
    .filter((requirement) => (
      capabilities.has(requirement.capability) && requirement.providers.length === 0
    ))
    .map((requirement) => ({
      capability: requirement.capability,
      consumer: requirement.consumer,
      tested_against: requirement.tested_against
    }));
  return {
    items,
    codes: new Set(expectations.map(reviewKey)),
    requirements: new Set(items.map((item) => `${item.consumer}\0${item.capability}`))
  };
}

export function conditionVerificationSummary(condition) {
  return `${condition.verification.method}; evidence ${condition.verification.evidence}`;
}

export function intentContributionLines(contribution) {
  const lines = [
    `- **${contribution.category}** \`${contribution.id}\` [${contribution.status}; ${contribution.source}]: ${contribution.statement}`
  ];
  if (contribution.verification) {
    lines.push(
      `  - Verification plan: establish **${contribution.verification.subject}** by ${contribution.verification.method} at ${contribution.verification.timing}; evidence ${contribution.verification.evidence}.`
    );
    if (contribution.verification.guidance) {
      lines.push(`  - Verification guidance: ${contribution.verification.guidance}`);
    }
  }
  for (const evidence of contribution.evidence ?? []) {
    lines.push(
      `  - Baseline evidence [${evidence.source}]: ${evidence.reference}${evidence.observed_at ? ` (observed ${evidence.observed_at})` : ""}`
    );
    if (evidence.description) lines.push(`    - ${evidence.description}`);
  }
  return lines;
}

export function buildAgentGuide({
  application,
  features,
  composition,
  resolvedIntent,
  implementationProfileState,
  configurationStatus,
  completionScope,
  requirements,
  reviews,
  unresolvedDecisions,
  components,
  artifacts,
  taskIndex,
  implementationResources,
  contextModules,
  technicalPreferences
}) {
  const planningComponents = components.filter((component) => component.review === "before-planning");
  const planningArtifacts = artifacts.filter((artifact) => artifact.review === "before-planning");
  const activationArtifacts = artifacts.filter((artifact) => artifact.review === "before-activation");
  const completionComponents = components.filter(
    (component) => component.review === "before-completion-claim"
  );
  const completionArtifacts = artifacts.filter(
    (artifact) => artifact.review === "before-completion-claim"
      && artifact.disposition !== "declined"
  );
  const selectedCompletionArtifacts = completionArtifacts.filter(
    (artifact) => artifact.disposition === "selected"
  );
  const deferredCompletionArtifacts = completionArtifacts.filter(
    (artifact) => artifact.disposition === "deferred"
  );
  const unreviewedCompletionArtifacts = completionArtifacts.filter(
    (artifact) => artifact.disposition === "unreviewed"
  );
  const hasTechnicalPreferences = Object.keys(technicalPreferences).length > 0;
  const implementationTargets = technicalPreferences.implementation_targets ?? [];
  const resourcePolicies = implementationResources.policies;
  const declaredResources = implementationResources.resources;
  const selectedPlanningArtifacts = planningArtifacts.filter(
    (artifact) => artifact.disposition === "selected"
  );
  const unreviewedPlanningArtifacts = planningArtifacts.filter(
    (artifact) => artifact.disposition === "unreviewed"
  );
  const deferredPlanningArtifacts = planningArtifacts.filter(
    (artifact) => artifact.disposition === "deferred"
  );
  const materialLocation = (reference) => {
    if (reference.artifact) {
      const artifact = artifacts.find((candidate) => (
        candidate.package === reference.package && candidate.id === reference.artifact
      ));
      return `artifact ${reference.package}/${reference.artifact} at \`${artifact.path ?? artifact.url}\``;
    }
    if (reference.resource) {
      const resource = declaredResources.find((candidate) => (
        candidate.package === reference.package && candidate.id === reference.resource
      ));
      return `implementation resource ${reference.package}/${reference.resource} (resolve \`${resource.entrypoint}\` through the resource index)`;
    }
    const component = components.find((candidate) => (
      candidate.package === reference.package && candidate.name === reference.component
    ));
    return `component ${reference.package}/${reference.component} at \`${component.path}\``;
  };
  // Sections with nothing to say are named once at the end rather than each
  // emitting a heading and a sentence saying so. Absence stays evidenced; it
  // just stops outweighing the intent it surrounds.
  const absent = [];
  const lines = [
    "# SeedSpec implementation guide",
    "",
    "This project contains SeedSpec packages: structured solution intent and verification guidance for an implementing agent. They are not a framework, generated architecture, executable workflow, or package-manager constraint.",
    "",
    "## Read first",
    "",
    "1. Read `resolved-intent.yaml` first. It distinguishes package-authored intent, the end user's disposition for each package, local intent contributions, and unconfirmed agent proposals.",
    "2. Read `resolved-spec.md` and `resolved-config.yaml` for the complete package definitions, configuration, decisions, and technical preferences.",
    "3. Read `implementation-profile-state.yaml` for candidate implementation profiles, the recorded preference, and conditions that must be checked.",
    "4. Read `project.yaml` for bundled composition edges. Read every edge's integration Markdown before deciding how its parent and child meet.",
    "5. Read `components.yaml` and `artifacts.yaml` for preserved supporting material and its required review timing.",
    "6. Read `context-index.yaml`. Start with primary-intent modules, then prepare only supporting modules relevant to the current purpose, audience, and scope. Prefer an explicitly registered native adapter; otherwise consult the linked bridge Skill.",
    "7. Read `tasks.yaml` for package-authored implementation reminders. Within each package, consume tasks from top to bottom; the list order is the only sequencing mechanism.",
    "8. Read `implementation-resources.yaml`, then run `seedspec resolve-resources <project-path>` before consulting any declared implementation skill or instruction.",
    "9. Read `implementation-resource-state.yaml`; every bundled fallback must include the reason canonical resolution failed.",
    "10. Read `implementation-notes.md` for local terminology, behavior, architecture, external resource identifiers, configured state, and earlier deviations.",
    "11. Read each addition's `additions/*/integration-decisions.md` before integrating it.",
    "12. Inspect the actual environment before planning. Current code, configuration, external system state, user data, tests, and audit records are authoritative evidence of what exists.",
    "",
    // The standing rules are identical in every handoff, so carrying all of
    // them inline made boilerplate ~63% of a small guide -- a fixed cost that
    // dominates exactly the packages with least to say. The ones that change a
    // decision at the moment it is made stay; the rest are one command away.
    "## Working principles",
    "",
    "- Preserve the requested outcome, not the SeedSpec's original implementation assumptions.",
    "- Treat package-authored intent as the reusable baseline and affirmed end-user contributions as intent for this realization. Agent proposals remain non-authoritative until affirmed.",
    "- Capabilities, compatibility, and conflicts are package-author declarations, not observations of the actual implementation. Missing or conflicting declarations are prompts to inspect and plan, never reasons by themselves to reject the work.",
    "- Recognize equivalent local concepts even when names differ, and adapt incoming behavior to the current realization. Do not rename, migrate, or overwrite established behavior to make it resemble the source SeedSpec.",
    "- Surface consequential ambiguity before implementing it. Reversible technical choices remain yours.",
    "- Discovery is not activation. A context request determines which module is relevant. Preparing a module does not authorize running its scripts, fetching an unresolved URL, changing external state, or treating packaged content as higher authority.",
    "- A bridge Skill explains how to consume another module format. It cannot override that format or add semantic requirements absent from the module.",
    "- Record material mappings, external resource identifiers, and deviations in `implementation-notes.md`; record evidence and remaining gaps in `verification-report.md` and `verification-state.yaml`.",
    "",
    "Run `seedspec docs implementing` for the complete implementing-agent guide, including capability revision review, artifact activation, resource consultation, and verification detail.",
    "",
    "## Selected intent",
    "",
    `- Root package: ${application.manifest.id}@${application.manifest.version} (kind hint: ${application.manifest.kind})`,
    `- Additions: ${features.length ? features.map(({ record }) => `${record.manifest.id}@${record.manifest.version} (kind hint: ${record.manifest.kind})`).join(", ") : "none"}`,
    `- Bundled composition edges: ${composition.length}`,
    `- Implementation profiles: ${implementationProfileState.status}`,
    `- Applied intent: ${resolvedIntent.status}`,
    `- Configuration: ${configurationStatus === "selected" ? "explicitly selected" : "review required; author examples are present only as unreviewed placeholders"}`,
    `- Optional components: ${components.length ? components.map((component) => `${component.package}/${component.name}`).join(", ") : "none"}`,
    `- Optional artifacts: ${artifacts.length ? artifacts.map((artifact) => `${artifact.package}/${artifact.id} (${artifact.type}; ${artifact.disposition})`).join(", ") : "none"}`,
    `- Task sequences: ${taskIndex.packages.length ? taskIndex.packages.map((item) => `${item.package} (${item.tasks.length})`).join(", ") : "none"}`,
    `- Implementation resources: ${declaredResources.length ? declaredResources.map((resource) => `${resource.package}/${resource.id} (${resource.kind}; ${resource.usage})`).join(", ") : "none"}`,
    `- Context modules: ${contextModules.modules.length}`,
    `- Context bridges: ${contextModules.modules.reduce((count, module) => count + (module.bridges?.length ?? 0), 0)}`
  ];

  if (composition.length === 0) {
    absent.push("bundled composition edges");
  } else {
    lines.push(
      "",
      "## Bundled composition seams",
      "",
      "Each file is author-provided prose describing how one bundled child is intended to participate in its parent. Use it with both packages' intent and the actual environment. If a different seam is necessary, preserve the behavioral contract and record the material deviation.",
      "",
      ...composition.map((edge) => (
        `- \`${edge.parent.id}/${edge.id}\` → ${edge.child.id}: \`${edge.integration.resolved_path}\``
      ))
    );
  }

  if (contextModules.modules.length === 0) {
    absent.push("context modules");
  } else {
    lines.push(
      "",
      "## Context navigation",
      "",
      "Start with module descriptions. Prepare a module only when its purpose, audience, and scope match the current request. Loading one entrypoint does not load sibling modules or every file in its directory. A native adapter and a bridge Skill are alternative preparation mechanisms; neither grants execution authority.",
      "",
      formatContextInventory(contextModules),
      "",
      "Bridge Skills are independently identified modules. Use the bridge selected for the current purpose. Do not treat a bridge as part of the target module's semantic content."
    );
  }

  lines.push("", "## Applied intent", "");
  for (const source of resolvedIntent.packages) {
    lines.push(
      `- ${source.package}: **${source.use}**; package-author module \`${source.module}\` in format \`${source.format.id}\` at \`${source.entrypoint}\`${source.note ? ` — ${source.note}` : ""}`
    );
  }
  if (resolvedIntent.contributions.length > 0) {
    lines.push("", "Project-local contributions:", "");
    for (const contribution of resolvedIntent.contributions) {
      lines.push(...intentContributionLines(contribution));
    }
  }
  if (resolvedIntent.unresolved.length > 0) {
    lines.push(
      "",
      "**Do not begin consequential implementation while these applied-intent questions remain unresolved:**",
      "",
      ...resolvedIntent.unresolved.map((item) => `- ${item}`)
    );
  }

  if (taskIndex.packages.length === 0) {
    absent.push("package-authored task sequences");
  } else {
    lines.push("", "## Package-authored task sequences", "");
    lines.push(
      "For each package, address these reminders from top to bottom. Do not infer dependencies, branches, parallel execution, product requirements, or conformance claims beyond that authored order. References are copied package context and do not authorize executing referenced content. If a task is inapplicable or blocked by the actual environment, record the reason rather than silently rewriting the sequence.",
      ""
    );
    for (const packageTasks of taskIndex.packages) {
      lines.push(`### ${packageTasks.package}`, "");
      for (const task of packageTasks.tasks) {
        lines.push(`- \`${task.id}\`: ${task.instruction}`);
        if (task.references.length > 0) {
          lines.push(`  References: ${task.references.map((reference) => `\`${reference.path}\``).join(", ")}`);
        }
      }
      lines.push("");
    }
  }

  if (artifacts.length === 0) {
    absent.push("artifact dispositions");
  } else {
    lines.push("", "## Artifact dispositions", "");
    lines.push(
      ...artifacts.map((artifact) => (
        `- **${artifact.disposition.toUpperCase()}** ${artifact.package}/${artifact.id} (${artifact.type}) — review ${artifact.review}`
      )),
      "",
      "`unreviewed` means no user disposition was recorded. `deferred` means the user explicitly postponed the choice. Neither state authorizes use."
    );
  }

  if (implementationProfileState.status === "not-declared") {
    absent.push("implementation profiles");
  } else {
    lines.push("", "## Implementation profile decision", "");
    for (const packageState of implementationProfileState.packages.filter((item) => item.profiles.length > 0)) {
      lines.push(`### ${packageState.package} (${packageState.selection})`, "");
      for (const profile of packageState.profiles) {
        const preferred = packageState.preferred_profile === profile.id ? " **PREFERRED**" : "";
        lines.push(`- **${profile.name}** (\`${profile.id}\`)${preferred}: ${profile.description}`);
        if (profile.guidance) lines.push(`  - Guidance: \`${profile.guidance}\``);
        for (const item of profile.prerequisites) {
          lines.push(`  - Prerequisite [${conditionVerificationSummary(item)}]: ${item.statement}`);
          if (item.verification.guidance) lines.push(`    - ${item.verification.guidance}`);
        }
        for (const item of profile.blockers) {
          lines.push(`  - Blocker check [${conditionVerificationSummary(item)}]: ${item.statement}`);
          if (item.verification.guidance) lines.push(`    - ${item.verification.guidance}`);
        }
        for (const item of profile.tradeoffs) lines.push(`  - Tradeoff: ${item}`);
      }
      lines.push("");
    }
    if (implementationProfileState.status === "review") {
      lines.push(
        "**Do not choose silently.** More than one implementation profile is available without a recorded preference. Explain the materially different approaches, inspect the declared prerequisites and blockers, ask the end user which direction to prefer, and rerun resolution with `-i <profile-id>` or `--implementation <profile-id>` before consequential implementation."
      );
    } else if (implementationProfileState.packages.some((item) => item.selection === "preferred")) {
      lines.push(
        "A preferred profile is strong implementation guidance, not an irreversible command or a claim that its prerequisites hold. Verify its prerequisites and blocker conditions. Follow it when viable; if it conflicts with the actual environment or core intent, present the evidence and ask the end user before changing direction."
      );
    } else {
      lines.push(
        "A sole available profile is author-provided context, not an explicit preference. Inspect it and the actual environment before recommending whether to use it."
      );
    }
  }

  lines.push("", "## Implementation-resource policy", "");
  for (const policy of resourcePolicies) {
    lines.push(`- ${policy.package}: additional guidance \`${policy.additional_guidance}\``);
    if (policy.catalogs.length > 0) {
      lines.push(...policy.catalogs.map((catalog) => (
        `  - catalog ${catalog.id}@${catalog.version}: ${catalog.url}`
      )));
    }
  }
  if (declaredResources.length === 0) {
    lines.push("", "No author-selected implementation resources are declared. Absence is not a statement that a capability exists, is absent, or should be implemented a particular way.");
  } else {
    lines.push("", "Resolve these resources before considering their contents:", "");
    for (const resource of declaredResources) {
      const applies = [
        ...(resource.applies_to?.capabilities ?? []).map((id) => `capability ${id}`),
        ...(resource.applies_to?.targets ?? []).map((id) => `target ${id}`)
      ];
      lines.push(
        `- **${resource.usage.toUpperCase()}** ${resource.package}/${resource.id}@${resource.version} (${resource.kind}; ${resource.update_policy})${applies.length ? ` — ${applies.join(", ")}` : ""}`,
        `  - ${resource.description}`,
        `  - Entrypoint after resolution: \`${resource.entrypoint}\``
      );
    }
    lines.push(
      "",
      "After resolution, use `implementation-resource-state.yaml` to locate each verified resource root and entrypoint. The author expects consultation of expected resources; consult recommended resources when relevant unless they conflict with stronger direction, and decide whether available resources add enough value to justify their context cost. Resolve supporting-file references from the resource root. Record consulted or skipped status and the reason. Consultation does not install or automatically invoke a skill, execute a tool, or promote guidance into solution intent."
    );
  }

  lines.push(
    "",
    "## Before implementation planning",
    ""
  );

  if (configurationStatus === "review") {
    lines.push(
      "**Do not treat the recorded example values as selected product behavior.** No configuration selection was supplied. Review every package configuration with the user, create a complete configuration-selections document, and rerun resolution before consequential implementation.",
      ""
    );
  }

  if (hasTechnicalPreferences) {
    lines.push(
      "The user supplied technical preferences. Treat selected platform, architecture, infrastructure, or hosting targets as implementation constraints unless they conflict with the requested product or the user revises them. Surface conflicts before choosing an incompatible architecture.",
      ""
    );
  }

  if (implementationTargets.length > 0) {
    lines.push(
      "Selected implementation targets are strong user context, not compatibility guarantees. Review their referenced guidance and surface conflicts before choosing architecture:",
      ""
    );
    for (const target of implementationTargets) {
      lines.push(
        `- **${target.id}**: ${target.kind} → ${target.target}`,
        ...target.guidance.map((reference) => `  - ${materialLocation(reference)}`)
      );
    }
    lines.push("");
  }

  if (
    planningComponents.length === 0
    && selectedPlanningArtifacts.length === 0
    && unreviewedPlanningArtifacts.length === 0
    && deferredPlanningArtifacts.length === 0
  ) {
    lines.push("No optional component or artifact is classified for review before planning.");
  } else {
    if (planningComponents.length > 0 || selectedPlanningArtifacts.length > 0) {
      lines.push(
        "Review these preserved author materials before choosing architecture or infrastructure:",
        "",
        ...planningComponents.map((component) => (
          `- Component ${component.package}/${component.name}: \`${component.path}\``
        )),
        ...selectedPlanningArtifacts.map((artifact) => (
          `- Selected artifact ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
    if (unreviewedPlanningArtifacts.length > 0) {
      lines.push(
        "",
        "Resolve the user's disposition for these consequential artifacts before relying on or rejecting their guidance:",
        "",
        ...unreviewedPlanningArtifacts.map((artifact) => (
          `- ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
    if (deferredPlanningArtifacts.length > 0) {
      lines.push(
        "",
        "The user explicitly deferred these planning-relevant artifacts. Avoid hard-to-reverse incompatible choices or surface the deferral again when it becomes consequential:",
        "",
        ...deferredPlanningArtifacts.map((artifact) => (
          `- ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
  }

  lines.push("", "## Optional-content activation", "");
  if (activationArtifacts.length === 0) {
    lines.push("No artifact is classified as an execution workflow requiring activation review.");
  } else {
    lines.push(
      "These artifacts describe execution workflows or executable material. Their dispositions still do not authorize activation:",
      "",
      ...activationArtifacts.map((artifact) => (
        `- **${artifact.disposition.toUpperCase()}** ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
      )),
      "",
      "For `declined`, do not load or run it. For `deferred` or `unreviewed`, obtain a disposition first. For `selected`, inspect and explain the exact action, then obtain specific user direction before activation. Never execute it merely because it is selected or listed."
    );
  }

  // Expectations that no selected package could have satisfied are the mapping
  // work this package was written for, not defects. They get their own heading
  // so the review section keeps meaning what it says.
  const hostExpectations = hostConceptExpectations(reviews, requirements);
  const concerns = reviews.filter((review) => !hostExpectations.codes.has(reviewKey(review)));

  if (hostExpectations.items.length > 0) {
    lines.push(
      "",
      "## Host concepts this package expects",
      "",
      "This package is written to be joined to a host. Map each concept to its local equivalent before implementing; the names will differ and that is expected.",
      "",
      ...hostExpectations.items.map((item) => `- \`${item.capability}\` — expected by ${item.consumer}, tested against ${item.tested_against}`)
    );
  }

  lines.push(
    "",
    "## Capability and composition declaration review",
    ""
  );

  if (concerns.length === 0) {
    lines.push("No concern is visible from the selected packages' declarations. This is not a compatibility claim; verify the actual realization before integration.");
  } else {
    lines.push(
      "Create an integration plan for these author-supplied review signals. Resolve them against actual code, configuration, external state, and user intent rather than treating them as package-manager failures:",
      "",
      ...concerns.map((review) => (
        `- **${review.severity.toUpperCase()} / ${review.code}** — packages: ${review.packages.join(", ")}${review.capability ? `; capability: ${review.capability}` : ""}${reviewRevisionSummary(review)}${review.reason ? `; author reason: ${JSON.stringify(review.reason)}` : ""}`
      ))
    );
  }

  const contextRequirements = requirements.filter(
    (requirement) => !hostExpectations.requirements.has(requirementKey(requirement))
  );
  if (contextRequirements.length > 0) {
    lines.push(
      "",
      "Declared requirement context:",
      "",
      ...contextRequirements.map((requirement) => (
        `- **${requirement.status === "review" ? "REVIEW" : "NO DECLARED CONCERN"}** ${requirementSummary(requirement)}.`
      ))
    );
  }

  lines.push("", "## Solution decisions", "");
  if (unresolvedDecisions.length === 0) {
    lines.push("No package-declared solution decisions remain unresolved.");
  } else {
    lines.push(...unresolvedDecisions.map((decision) => (
      `- ${decision.required ? "REQUIRED" : "OPTIONAL"} ${decision.package}/${decision.id}: ${decision.question}`
    )));
  }

  lines.push("", "## Before claiming completion", "");
  if (completionScope.status === "review") {
    lines.push(
      "**Completion scope is not fully recorded. Do not claim this implementation is complete.** Add observable criteria or select author acceptance material for these packages, then rerun resolution:",
      "",
      ...completionScope.uncovered_packages.map((packageId) => `- ${packageId}`),
      ""
    );
  } else {
    lines.push("The current completion claim is limited to these recorded scope items:", "");
    for (const item of completionScope.items) {
      if (item.kind === "criterion") {
        lines.push(`- **${item.disposition.toUpperCase()} ${item.id}** (${item.package}): ${item.statement}`);
      } else if (item.selection === "all") {
        lines.push(`- **${item.id}**: all acceptance material from ${item.package}/${item.component}`);
      } else {
        lines.push(
          `- **${item.id}**: selected references from ${item.package}/${item.component}: ${(item.included_references ?? []).join(", ")}`
        );
        if (item.deferred_references?.length) {
          lines.push(`  - Deferred gaps: ${item.deferred_references.join(", ")}`);
        }
        if (item.excluded_references?.length) {
          lines.push(`  - Explicitly outside this scope: ${item.excluded_references.join(", ")}`);
        }
      }
      if (item.verification) {
        lines.push(
          `  - Verification plan: prove **${item.verification.subject}** by ${item.verification.method} at ${item.verification.timing}; evidence ${item.verification.evidence}.`
        );
        if (item.verification.guidance) lines.push(`  - Evidence guidance: ${item.verification.guidance}`);
      }
    }
    lines.push("");
  }

  if (completionComponents.length === 0 && completionArtifacts.length === 0) {
    lines.push("No author acceptance, evaluation, or evidence material is preserved. Use the explicit project criteria in `completion-scope.yaml` and attach credible evidence to `verification-state.yaml`.");
  } else {
    if (completionComponents.length > 0 || selectedCompletionArtifacts.length > 0) {
      lines.push(
        "These preserved materials may supply acceptance behavior or evidence. `completion-scope.yaml`, not mere presence, determines the current claim:",
        "",
        ...completionComponents.map((component) => (
          `- Component ${component.package}/${component.name}: \`${component.path}\``
        )),
        ...selectedCompletionArtifacts.map((artifact) => (
          `- Selected artifact ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
    if (deferredCompletionArtifacts.length > 0) {
      lines.push(
        "",
        "Completion-relevant artifacts explicitly deferred by the user remain recorded gaps, not addressed evidence:",
        "",
        ...deferredCompletionArtifacts.map((artifact) => (
          `- ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
    if (unreviewedCompletionArtifacts.length > 0) {
      lines.push(
        "",
        "No user disposition is recorded for these completion-relevant artifacts. Decide whether they belong to the completion scope before relying on them:",
        "",
        ...unreviewedCompletionArtifacts.map((artifact) => (
          `- ${artifact.package}/${artifact.id} (${artifact.type}): \`${artifact.path ?? artifact.url}\``
        ))
      );
    }
  }

  lines.push(
    "",
    "## Completion standard",
    "",
    "Project `status: ready` authorizes implementation planning; it is not a completion claim. The realization is complete only when the explicitly recorded scope works in the actual environment, `verification-state.yaml` truthfully records results and evidence, and material deviations are documented. Run `seedspec completion <project-path>` before claiming verified completion. A package author's execution path or architecture remains optional unless the user selected it, the selected technical preferences or target require it, or the intended outcome depends on it.",
    ""
  );

  if (absent.length > 0) {
    lines.push(
      "## Not declared by any selected package",
      "",
      `${absent.join(", ")}. Absence is not a statement that a capability exists, is absent, or should be implemented a particular way.`,
      ""
    );
  }

  return lines.join("\n");
}
