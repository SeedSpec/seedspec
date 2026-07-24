# SeedSpec implementation guide

This project contains SeedSpec packages: structured solution intent and verification guidance for an implementing agent. They are not a framework, generated architecture, executable workflow, or package-manager constraint.

## Read first

1. Read `resolved-intent.yaml` first. It distinguishes package-authored intent, the end user's disposition for each package, local intent contributions, and unconfirmed agent proposals.
2. Read `resolved-spec.md` and `resolved-config.yaml` for the complete package definitions, configuration, decisions, and technical preferences.
3. Read `implementation-profile-state.yaml` for candidate implementation profiles, the recorded preference, and conditions that must be checked.
4. Read `components.yaml` and `artifacts.yaml` for preserved material and its required review timing. A primary intent artifact is already part of core intent; its native workflow is not automatically activated.
5. Read `tasks.yaml` for package-authored implementation reminders. Within each package, consume tasks from top to bottom; the list order is the only sequencing mechanism.
6. Read `implementation-resources.yaml`, then run `seedspec resolve-resources <project-path>` before consulting any declared implementation skill or instruction.
7. Read `implementation-resource-state.yaml`; every bundled fallback must include the reason canonical resolution failed.
8. Read `implementation-notes.md` for local terminology, behavior, architecture, external resource identifiers, configured state, and earlier deviations.
9. Read each addition's `additions/*/integration-decisions.md` before integrating it.
10. Inspect the actual environment before planning. Current code, configuration, external system state, user data, tests, and audit records are authoritative evidence of what exists.

## Working principles

- Preserve the requested outcome, not the SeedSpec's original implementation assumptions.
- Treat package-authored intent as the reusable baseline and affirmed end-user contributions as intent for this realization. Agent proposals remain non-authoritative until affirmed.
- If package intent and applied intent are too far apart, explain whether the package is adaptable, only partially reusable, or a poor fit. Do not claim full package satisfaction after silently cherry-picking it.
- Use each package's kind as a hint for planning depth and likely concerns, not as a validity, composition, architecture, or execution constraint.
- Capabilities, compatibility, and conflicts are package-author declarations, not observations of the actual implementation.
- Missing, multiple, cyclic, conflicting, or revision-different declarations are prompts to inspect and plan, never reasons by themselves to reject the work.
- Use revision direction, semver distance, severity, and structured change history to prioritize review. These fields remain author evidence rather than compatibility verdicts.
- When a provided capability declares a conformance suite, inspect its exact binding with `seedspec capability-conformance <package-path> <capability-id>`. A runner-produced capability result is separate from project completion evidence and must not be inferred from declarations alone.
- Recognize equivalent local concepts even when names differ. Prefer adapting incoming behavior to the current realization.
- Do not rename, migrate, or overwrite established behavior merely to make it resemble the source SeedSpec.
- Surface consequential ambiguity before implementing it. Reversible technical choices remain yours.
- Translate acceptance criteria into verification appropriate for the selected realization. Use tests where appropriate, but allow credible observations of configured external state and delivered operational results.
- Record material semantic mappings, external resource identifiers, selected approaches, and deviations in `implementation-notes.md`.
- Record acceptance evidence, remaining gaps, and manual checks in `verification-report.md`.
- Keep concise per-scope results and evidence references truthful in `verification-state.yaml`.
- Artifact discovery is descriptive, not an instruction to activate the artifact's tooling or lifecycle.
- Artifact disposition records intended use. Even a selected artifact does not authorize loading a skill, running a command, fetching a URL, or invoking an adapter.
- If an artifact format has its own workflow, explain the exact action and obtain specific user direction at activation time. The package author's preference does not override the end user's direction.
- Implementation resources are author-selected help, not capability evidence or automatic authority. A package-scoped skill is not installed or automatically invoked. Resolve exact online versions first, report fallback use, inspect skill frontmatter, and explicitly consult only the bodies relevant to the work.
- `expected`, `recommended`, and `available` express author intent. They never authorize executing a tool, changing external state, or overriding the end user, current project requirements, or clearer solution intent.
- Package-authored tasks are ordered implementation reminders. They do not add product requirements, form a dependency graph, or establish conformance when completed.

## Selected intent

- Root package: org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1 (kind hint: application)
- Additions: org.seedspec.fixtures.portable-feature@0.1.0-alpha.1 (kind hint: feature)
- Implementation profiles: not-declared
- Applied intent: affirmed
- Configuration: explicitly selected
- Optional components: org.seedspec.fixtures.comprehensive-application/acceptance, org.seedspec.fixtures.comprehensive-application/reference, org.seedspec.fixtures.portable-feature/acceptance, org.seedspec.fixtures.portable-feature/integration
- Optional artifacts: org.seedspec.fixtures.comprehensive-application/product-spec (org.seedspec.artifact.product-spec; selected)
- Task sequences: org.seedspec.fixtures.comprehensive-application (4)
- Implementation resources: none

## Applied intent

- org.seedspec.fixtures.comprehensive-application: **as-authored**; package-author source `org.seedspec.artifact.product-spec` at `intent/allowance-tracker.product-spec.md`
- org.seedspec.fixtures.portable-feature: **as-authored**; package-author source `org.seedspec.intent.native` at `definition/feature.md`

## Package-authored task sequences

For each package, address these reminders from top to bottom. Do not infer dependencies, branches, parallel execution, product requirements, or conformance claims beyond that authored order. References are copied package context and do not authorize executing referenced content. If a task is inapplicable or blocked by the actual environment, record the reason rather than silently rewriting the sequence.

### org.seedspec.fixtures.comprehensive-application

- `inspect-current-state`: Inspect the existing solution and identify the local concepts, behavior, and constraints that overlap this package before making changes.
  References: `task-references/org.seedspec.fixtures.comprehensive-application/intent/allowance-tracker.product-spec.md`
- `review-author-context`: Review the supplied reference context and note where the existing solution requires an adaptation rather than a direct translation.
  References: `task-references/org.seedspec.fixtures.comprehensive-application/reference/capabilities/chores-1.0.0.md`
- `realize-package`: Realize the affirmed package intent using the existing architecture and record material deviations or terminology mappings.
- `verify-realization`: Run the applicable package verification and investigate every failure before claiming completion.
  References: `task-references/org.seedspec.fixtures.comprehensive-application/acceptance/criteria.md`, `task-references/org.seedspec.fixtures.comprehensive-application/capabilities/conformance/chores.suite.yaml`, `task-references/org.seedspec.fixtures.comprehensive-application/capabilities/conformance/chores.schema.json`, `task-references/org.seedspec.fixtures.comprehensive-application/capabilities/conformance/chores.scenarios.yaml`


## Artifact dispositions

- **SELECTED** org.seedspec.fixtures.comprehensive-application/product-spec (org.seedspec.artifact.product-spec) — review before-planning

`unreviewed` means no user disposition was recorded. `deferred` means the user explicitly postponed the choice. Neither state authorizes use.

## Implementation profile decision

No selected package declares an implementation profile. Choose execution from the core intent, actual environment, and end-user direction.

## Implementation-resource policy

- org.seedspec.fixtures.comprehensive-application: additional guidance `unspecified`
- org.seedspec.fixtures.portable-feature: additional guidance `unspecified`

No author-selected implementation resources are declared. Absence is not a statement that a capability exists, is absent, or should be implemented a particular way.

## Before implementation planning

Review these preserved author materials before choosing architecture or infrastructure:

- Component org.seedspec.fixtures.comprehensive-application/reference: `components/org.seedspec.fixtures.comprehensive-application/reference/`
- Selected artifact org.seedspec.fixtures.comprehensive-application/product-spec (org.seedspec.artifact.product-spec): `artifacts/org.seedspec.fixtures.comprehensive-application/product-spec/allowance-tracker.product-spec.md`

## Optional-content activation

No artifact is classified as an execution workflow requiring activation review.

## Capability and composition declaration review

No concern is visible from the selected packages' declarations. This is not a compatibility claim; verify the actual realization before integration.

Declared requirement context:

- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.actors@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.
- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.balances@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.
- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.transactions@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.

## Solution decisions

No package-declared solution decisions remain unresolved.

## Before claiming completion

**Completion scope is not fully recorded. Do not claim this implementation is complete.** Add observable criteria or select author acceptance material for these packages, then rerun resolution:

- org.seedspec.fixtures.comprehensive-application
- org.seedspec.fixtures.portable-feature

These preserved materials may supply acceptance behavior or evidence. `completion-scope.yaml`, not mere presence, determines the current claim:

- Component org.seedspec.fixtures.comprehensive-application/acceptance: `components/org.seedspec.fixtures.comprehensive-application/acceptance/`
- Component org.seedspec.fixtures.portable-feature/acceptance: `components/org.seedspec.fixtures.portable-feature/acceptance/`

## Completion standard

Project `status: ready` authorizes implementation planning; it is not a completion claim. The realization is complete only when the explicitly recorded scope works in the actual environment, `verification-state.yaml` truthfully records results and evidence, and material deviations are documented. Run `seedspec completion <project-path>` before claiming verified completion. A package author's execution path or architecture remains optional unless the user selected it, the selected technical preferences or target require it, or the intended outcome depends on it.
