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
- Capabilities, compatibility, and conflicts are package-author declarations, not observations of the actual implementation. Missing or conflicting declarations are prompts to inspect and plan, never reasons by themselves to reject the work.
- Recognize equivalent local concepts even when names differ, and adapt incoming behavior to the current realization. Do not rename, migrate, or overwrite established behavior to make it resemble the source SeedSpec.
- Surface consequential ambiguity before implementing it. Reversible technical choices remain yours.
- Discovery is not activation. Nothing in this handoff authorizes loading a skill, running a command, fetching a URL, or invoking an adapter; that needs specific user direction at the time.
- Record material mappings, external resource identifiers, and deviations in `implementation-notes.md`; record evidence and remaining gaps in `verification-report.md` and `verification-state.yaml`.

Run `seedspec docs implementing` for the complete implementing-agent guide, including capability revision review, artifact activation, resource consultation, and verification detail.

## Selected intent

- Root package: org.seedspec.fixtures.portable-feature@0.1.0 (kind hint: feature)
- Additions: none
- Implementation profiles: not-declared
- Applied intent: affirmed
- Configuration: explicitly selected
- Optional components: org.seedspec.fixtures.portable-feature/acceptance, org.seedspec.fixtures.portable-feature/integration
- Optional artifacts: none
- Task sequences: none
- Implementation resources: none

## Applied intent

- org.seedspec.fixtures.portable-feature: **as-authored**; package-author source `org.seedspec.intent.native` at `definition/feature.md`

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

package-authored task sequences, artifact dispositions, implementation profiles. Absence is not a statement that a capability exists, is absent, or should be implemented a particular way.
