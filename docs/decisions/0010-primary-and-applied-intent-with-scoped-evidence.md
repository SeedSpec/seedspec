# Decision 0010: Separate primary intent, applied intent, and evidence subjects

- Status: accepted for Protocol 0.1 design alpha
- Date: 2026-07-21

## Context

A published package contains an author's reusable statement of a solution. The
end user may accept that intent, adapt it to an actual environment, or reuse
only part of it. Treating the package as the user's complete request makes
implementation-profile selection happen before the agent understands the local
objective. Treating all evidence alike also permits a tested package, a
verification plan, current-state observations, and a successful realization to
be confused with one another.

SeedSpec also needs to support richer intent formats without requiring every
author to translate them into a weaker native document. ProductSpec is an
important example: its scope, acceptance criteria, evals, success metrics, and
evidence relationships can serve directly as package-author intent.

## Decision

1. Every package has one primary intent source at `definition.entrypoint`.
   Native SeedSpec Markdown and recognized external Markdown formats are both
   allowed.
2. `definition.artifact` may identify the entrypoint's declared artifact and
   native format. That artifact content becomes core intent, while its external
   workflow remains inactive until separately authorized.
3. Resolution accepts project-local applied intent. The end user records each
   selected package as `as-authored`, `adapted`, or `partial` and may add local
   objectives, outcomes, invariants, constraints, forbidden states, non-goals,
   preferences, decision rights, or baseline observations.
4. Agent-authored local intent remains `proposed` until the end user affirms it.
   Evidence-backed baseline observations may be recorded as `observed`;
   inference without observation remains a proposal. Missing or proposed
   applied intent prevents implementation readiness.
5. Completion scope records a verification plan before implementation.
   Verification state records actual results afterward.
6. Evidence identifies its subject. SeedSpec distinguishes package evidence,
   baseline evidence, realization evidence, and outcome evidence and does not
   permit one category to be presented as proof of another.

## Consequences

- Implementation profiles are evaluated after package and applied intent are
  compared.
- Partial reuse remains legitimate, but a result cannot silently claim complete
  package satisfaction.
- ProductSpec can be the primary definition of a SeedSpec package without
  becoming a core dependency or automatically activating ProductSpec tooling.
- Native authoring can stay physically compact while using explicit semantic
  areas for purpose, obligations and boundaries, success and evidence, and
  decision latitude.
- Protocol schemas and runtime handoff state become incompatibly stricter during
  the design alpha. Evaluation must test this model before stabilization.
