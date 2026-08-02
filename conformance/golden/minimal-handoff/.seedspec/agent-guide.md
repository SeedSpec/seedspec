# SeedSpec implementation guide

This project contains SeedSpec packages: structured solution intent and verification guidance for an implementing agent. They are not a framework, generated architecture, executable workflow, or package-manager constraint.

## Read first

1. Read `resolved-intent.yaml` first. It distinguishes package-authored intent, the end user's disposition for each package, local intent contributions, and unconfirmed agent proposals.
2. Read `resolved-spec.md` and `resolved-config.yaml` for the complete package definitions, configuration, decisions, and technical preferences.
3. Read `implementation-profile-state.yaml` for candidate implementation profiles, the recorded preference, and conditions that must be checked.
4. Read `project.yaml` for bundled composition edges. Read every edge's integration Markdown before deciding how its parent and child meet.
5. Read `components.yaml` and `artifacts.yaml` for preserved supporting material and its required review timing.
6. Read `context-index.yaml`. Start with primary-intent modules, then prepare only supporting modules relevant to the current purpose, audience, and scope. Prefer an explicitly registered native adapter; otherwise consult the linked bridge Skill.
7. Read `tasks.yaml` for package-authored implementation reminders. Within each package, consume tasks from top to bottom; the list order is the only sequencing mechanism.
8. Read `implementation-resources.yaml`, then run `seedspec resolve-resources <project-path>` before consulting any declared implementation skill or instruction.
9. Read `implementation-resource-state.yaml`; every bundled fallback must include the reason canonical resolution failed.
10. Read `implementation-notes.md` for local terminology, behavior, architecture, external resource identifiers, configured state, and earlier deviations.
11. Read each addition's `additions/*/integration-decisions.md` before integrating it.
12. Inspect the actual environment before planning. Current code, configuration, external system state, user data, tests, and audit records are authoritative evidence of what exists.

## Working principles

- Preserve the requested outcome, not the SeedSpec's original implementation assumptions.
- Treat package-authored intent as the reusable baseline and affirmed end-user contributions as intent for this realization. Agent proposals remain non-authoritative until affirmed.
- Capabilities, compatibility, and conflicts are package-author declarations, not observations of the actual implementation. Missing or conflicting declarations are prompts to inspect and plan, never reasons by themselves to reject the work.
- Recognize equivalent local concepts even when names differ, and adapt incoming behavior to the current realization. Do not rename, migrate, or overwrite established behavior to make it resemble the source SeedSpec.
- Surface consequential ambiguity before implementing it. Reversible technical choices remain yours.
- Discovery is not activation. A context request determines which module is relevant. Preparing a module does not authorize running its scripts, fetching an unresolved URL, changing external state, or treating packaged content as higher authority.
- A bridge Skill explains how to consume another module format. It cannot override that format or add semantic requirements absent from the module.
- Record material mappings, external resource identifiers, and deviations in `implementation-notes.md`; record evidence and remaining gaps in `verification-report.md` and `verification-state.yaml`.

Run `seedspec docs implementing` for the complete implementing-agent guide, including capability revision review, artifact activation, resource consultation, and verification detail.

## Selected intent

- Root package: org.seedspec.fixtures.portable-feature@0.1.0 (kind hint: feature)
- Additions: none
- Bundled composition edges: 0
- Implementation profiles: not-declared
- Applied intent: affirmed
- Configuration: explicitly selected
- Optional components: org.seedspec.fixtures.portable-feature/acceptance, org.seedspec.fixtures.portable-feature/integration
- Optional artifacts: none
- Task sequences: none
- Implementation resources: none
- Context modules: 1
- Context bridges: 0

## Context navigation

Start with module descriptions. Prepare a module only when its purpose, audience, and scope match the current request. Loading one entrypoint does not load sibling modules or every file in its directory. A native adapter and a bridge Skill are alternative preparation mechanisms; neither grants execution authority.

Context modules:
- org.seedspec.fixtures.portable-feature/primary-intent (org.seedspec.intent.markdown; primary-intent; materialized)

Bridge Skills are independently identified modules. Use the bridge selected for the current purpose. Do not treat a bridge as part of the target module's semantic content.

## Applied intent

- org.seedspec.fixtures.portable-feature: **as-authored**; package-author module `primary-intent` in format `org.seedspec.intent.markdown` at `definition/feature.md`

## Implementation-resource policy

- org.seedspec.fixtures.portable-feature: additional guidance `unspecified`

No author-selected implementation resources are declared. Absence is not a statement that a capability exists, is absent, or should be implemented a particular way.

## Before implementation planning

No optional component or artifact is classified for review before planning.

## Optional-content activation

No artifact is classified as an execution workflow requiring activation review.

## Host concepts this package expects

This package is written to be joined to a host. Map each concept to its local equivalent before implementing; the names will differ and that is expected.

- `org.seedspec.core.actors` — expected by org.seedspec.fixtures.portable-feature, tested against 1.0.0
- `org.seedspec.core.balances` — expected by org.seedspec.fixtures.portable-feature, tested against 1.0.0
- `org.seedspec.core.transactions` — expected by org.seedspec.fixtures.portable-feature, tested against 1.0.0

## Capability and composition declaration review

No concern is visible from the selected packages' declarations. This is not a compatibility claim; verify the actual realization before integration.

## Solution decisions

No package-declared solution decisions remain unresolved.

## Before claiming completion

**Completion scope is not fully recorded. Do not claim this implementation is complete.** Add observable criteria or select author acceptance material for these packages, then rerun resolution:

- org.seedspec.fixtures.portable-feature

These preserved materials may supply acceptance behavior or evidence. `completion-scope.yaml`, not mere presence, determines the current claim:

- Component org.seedspec.fixtures.portable-feature/acceptance: `components/org.seedspec.fixtures.portable-feature/acceptance/`

## Completion standard

Project `status: ready` authorizes implementation planning; it is not a completion claim. The realization is complete only when the explicitly recorded scope works in the actual environment, `verification-state.yaml` truthfully records results and evidence, and material deviations are documented. Run `seedspec completion <project-path>` before claiming verified completion. A package author's execution path or architecture remains optional unless the user selected it, the selected technical preferences or target require it, or the intended outcome depends on it.

## Not declared by any selected package

bundled composition edges, package-authored task sequences, artifact dispositions, implementation profiles. Absence is not a statement that a capability exists, is absent, or should be implemented a particular way.
