# ADR 0009: Kind hints and implementation profiles

> **Non-normative rationale.** This record explains an accepted design decision;
> the protocol specification, schemas, and conformance suite define conformance.

- Status: accepted for the 0.1 design alpha
- Date: 2026-07-20

## Context

The first protocol model used `application` and `feature` both to describe a
package and to determine its position in composition. Practical examples showed
that these are independent questions. An automation may be a complete root
outcome or an addition to a larger application. A feature package can also be
resolved alone for evaluation or realization.

The same examples need to preserve several materially different ways to realize
one core intent. Product decisions are the wrong abstraction: “which business
behavior should the solution have?” is different from “which viable
implementation direction should the agent prefer?” Technical preferences are
also too unstructured to carry author-supplied alternatives, conditions,
tradeoffs, and guidance.

## Decision

Manifest `kind` is an author-supplied hint. Protocol 0.1 recognizes:

- `solution`
- `application`
- `feature`
- `workflow`
- `automation`
- `configuration`
- `integration`

Publishers may use namespaced custom hints. Generic tooling preserves unknown
hints and falls back to general solution guidance.

Kinds guide authoring flows, discovery, quality suggestions, and agent handoff.
They do not impose kind-specific required fields or determine whether a package
can be a composition root or addition. Resolution position establishes those
roles.

The protocol separates three implementation concepts:

1. **Core intent** is the portable definition, configuration, capabilities, and
   success criteria.
2. An **implementation profile** is an author-declared candidate direction for
   realizing that intent. It may carry guidance, prerequisites, blockers,
   tradeoffs, and references to implementation resources.
3. **Implementation profile state** is the single project-level resolved record
   of all candidate profiles and any preferred profiles.

Prerequisites and blockers are declarative conditions with a verification
method and evidence expectation, not scripts or fixed interview wording. This
lets an agent inspect the actual environment where possible and ask the user
when confirmation is necessary. Verification does not itself authorize access
or execution.

The CLI accepts `-i <profile-id>` or `--implementation <profile-id>` for the
root package and `<package-id>/<profile-id>` for additions. A preference may be
recorded by an author, distributor, internal platform team, consultant, end
user, or another authorized caller. It is strong planning context, not proof of
viability, authorization for effects, or an immutable execution command.

If a selected package has multiple profiles and no preference, the project
needs input. The implementing agent must explain the alternatives and ask which
direction to prefer. If a preferred profile is blocked or contradicts the core
intent or actual environment, the agent must show the conflict and request
direction rather than switching silently.

A resolved project has exactly one implementation profile state, even when it
contains several packages and candidates. Each selected package may have at
most one preferred profile. Candidates being evaluated remain together in that
state; complete what-if realizations use separate resolution runs rather than
competing states in one implementation handoff.

User- or organization-level implementation preferences are distinct from
authored profiles. Tooling may use preferences to rank or explain candidates,
but it must not invisibly convert a ranking into a preferred profile.

## Language classification

The manifest and structured package files form a small declarative domain-
specific language. The SeedSpec Protocol remains more than that package DSL: it
also defines identity, packaging, composition, integrity, resolution, handoff,
and verification behavior across independent tools and agents. The broader
SeedSpec project additionally includes authoring, runtime, distribution, and
implementation layers whose claims remain outside protocol conformance.

“Agentically composable” is an appropriate design property: agents can compare,
select, adapt, and compose packages, profiles, artifacts, capabilities, and
implementation resources. The term does not mean that agents act without user
direction or that composition is deterministic.

## Consequences

- Existing `application` and `feature` packages remain valid.
- Resolved state uses `root` and `additions` rather than treating manifest kind
  as composition position.
- `--feature` remains an alpha CLI compatibility alias for `--add`.
- Tooling can offer different authoring depth and questions by kind without
  rejecting sparse but honest packages.
- Reference tooling provides kind-aware authoring diagnostics independently of
  protocol validation, preserving intentional exceptions.
- Implementation profiles remain subordinate to core intent and end-user
  direction.

[ADR 0010](0010-primary-and-applied-intent-with-scoped-evidence.md) further
requires end-user applied intent to be resolved before profile evaluation. A
profile must therefore fit both the reusable package intent and the affirmed
project-local application of that intent.
- Registries may index kinds and profiles as discovery hints but must not imply
  compatibility, selection, or authorization.
