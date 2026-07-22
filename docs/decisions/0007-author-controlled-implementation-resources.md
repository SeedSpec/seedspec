# ADR 0007: Author-controlled implementation resources

> **Non-normative rationale.** This record explains an accepted design decision;
> the protocol specification, schemas, and conformance suite define conformance.

- Status: accepted for the 0.1 alpha
- Date: 2026-07-19

## Context

Independent cold-start implementations of the same Smoker Timer package reached
the same product behavior but differed materially in source organization,
testing, persistence validation, dialog testability, visual density, and
maintenance quality. Generic implementation help could improve recurring
engineering decisions, but automatically injecting SeedSpec opinions would
override author choice, waste context when advice is generic, and risk steering
an agent away from the actual project.

Capabilities already have a narrower meaning: they are author-declared product
contracts and review context, not observations of generated software. Skills,
instructions, tools, verification modules, and target profiles must not become
capability evidence or dependency gates.

Resources also need to evolve independently from the protocol and CLI. Online
resolution is useful, while offline operation and unavailable versions require
a transparent package-local failsafe.

## Decision

Protocol 0.1 adds optional `implementation_resources` declarations.

Authors explicitly choose resources, usage as `expected`, `recommended`, or
`available`, and whether additional catalog discovery is `none` or
`agent-delegated`. Omission remains `unspecified` rather than an inferred
choice.

Resources are independently versioned and may declare capability and target
applicability as discovery context. Applicability does not assert actual
implementation state. Implementation targets may reference declared resources.

Canonical resources use an HTTPS resource manifest with exact file and
aggregate digests. The reference resolver attempts the requested online policy
first. A package may contain a digest-verified bundled fallback. Fallback use is
always recorded with the canonical failure reason; unavailable `expected`
resources fail after state is preserved. This protects the author's declared
guidance baseline without claiming that an agent can be forced to follow it.

Resolving instruction bytes is not tool activation. Resource usage never
authorizes execution or external effects and does not override end-user or
actual-project direction.

Package-scoped skills remain distinct from environment-installed skills.
SeedSpec validates their `SKILL.md`, resolves verified bytes, and presents the
exact project-local entrypoint, but does not register them with a native skill
loader or infer automatic invocation from frontmatter. The implementing agent
can explicitly consult the skill as subordinate guidance and records whether it
was `consulted` or `skipped`; consultation does not promote its instructions
into solution intent.

Resolved handoffs preserve an index and digest-bound state. Agents may record
`consulted` or `skipped` with a reason as local project memory and potential eval
telemetry. Core does not transmit that state.

## Consequences

- SeedSpec can publish tested guidance without forcing it into every package.
- Authors and target providers can reuse versioned skills and profiles.
- Agents retain the ability to reject irrelevant or conflicting advice.
- Fallback and version behavior becomes auditable rather than silent.
- The runtime gains a narrowly scoped network resolver and must enforce path,
  size, HTTPS, and digest boundaries.
- Guidance catalog search, ranking, publication, signing, and telemetry export
  remain outside the alpha.

## Revisit when

- capability-guidance evals show whether `expected`, `recommended`, and
  `available` produce materially different agent behavior;
- a public SeedSpec guidance catalog exists;
- signed publisher identity becomes necessary;
- resource update channels need compatibility rules beyond major-version
  matching; or
- tool activation receives a separate action-time authorization lifecycle.
