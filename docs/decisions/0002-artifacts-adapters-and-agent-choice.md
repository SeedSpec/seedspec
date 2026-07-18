# ADR 0002: Artifacts, adapters, and agent choice

Status: accepted for the private alpha

## Context

SeedSpec packages may contain product documents, designs, plans, evaluations, reference implementations, deployment material, and third-party formats such as ProductSpec. Some formats publish parsers, validators, agent skills, or managed workflows.

Treating every format as opaque would limit useful tooling. Automatically adopting a discovered format's instructions would let package content silently change agent behavior and would couple SeedSpec core to external standards.

## Decision

- Add a generic artifact declaration with namespaced type and concern identifiers, local or remote location, optional format metadata, and descriptive relationships.
- Keep artifact format semantics out of SeedSpec core.
- Do not add artifact `authority`, `governing`, or `advisory` fields. Precedence is contextual and ultimately chosen by the end user; lineage such as derived-from or superseded-by may be expressed as a descriptive relationship instead.
- Treat declaration and adapter recognition as discovery only.
- Require explicit invocation before an adapter parses, validates, transforms, or otherwise acts on an artifact.
- Report SeedSpec package conformance separately from artifact-specific conformance.
- Do not infer agent authority or workflow policy from an artifact's presence, concern, type, or relationship.
- Materialize local declared artifacts into resolved project state so downstream tools can discover them without executing them.
- Recognize ProductSpec through a separately versioned official adapter that uses the official ProductSpec parser when explicitly invoked.

## Consequences

SeedSpec can officially support rigorous external formats without requiring them. Implementation agents receive enough context to explain available artifacts to end users, while end users retain control over whether an artifact-specific workflow is used.

The protocol remains responsible for identity, safe location, relationships, integrity, and handoff. Adapters remain responsible for format-specific interpretation. Continuous synchronization between source artifacts and generated software remains outside core protocol conformance.
