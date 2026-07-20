# ADR 0004: Capability declarations are review context

Status: accepted for the design alpha; package-kind gating and feature-order terminology are superseded by ADR 0009

## Context

The first composition algorithm treated package declarations like package-
manager state. It rejected a selected feature when no package declared a
required capability, multiple packages declared the same capability, an author
declared a conflict, or declared requirements formed a cycle.

SeedSpec does not implement or continuously inspect the resulting application.
It cannot know whether equivalent behavior already exists under different
terminology, whether a feature should add missing behavior, whether declarations
can be mapped together, or whether an author concern applies to current code.

In a Cook Notes exercise, the Smoker Timer application package declared no cook-
session capability. The actual implementation already had exactly the stable,
persisted session object the feature needed. Rejecting the feature would have
been factually wrong.

## Decision

- Replace `capability-graph-v1` with `declaration-review-v1`.
- Keep invalid structure, unsafe references, within-manifest duplicate IDs,
  and duplicate selected package IDs as hard errors. Package kind no longer
  gates composition position under ADR 0009.
- Sort selected additions by package ID for deterministic recording, explicitly
  not implementation order.
- Preserve every capability declaration; do not select or require a single
  installed provider.
- Record every requirement with zero or more declared provider candidates,
  exact revision comparisons, and issue codes.
- Convert missing providers, multiple providers, self-provision, revision
  differences, matched author conflicts, and declared requirement cycles into
  review records.
- Replace project `integration_status` with `declaration_status` whose
  `no-declared-concerns` value is not a compatibility claim.
- Restrict feature discovery verdicts to `candidate` and `review`; never label a
  package compatible or incompatible with an implementation the runtime has not
  inspected.
- Recompute the same declaration analysis during lock verification.

## Consequences

An implementation agent receives more complete and honest context. It must
inspect actual code, tests, data, permissions, and local concepts, then map,
adapt, implement, or decline behavior with the end user.

The dependency lock proves exact package bytes and deterministic declaration
analysis. It does not prove a capability exists in code, install a provider,
certify compatibility, or impose dependency order.

Package authors should still make capability contracts and conflict reasons
precise. Their value is evidence and explanation, not enforcement.
