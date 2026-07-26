# SeedSpec documentation

## Writing a SeedSpec

Start here if you have product or domain knowledge you want to package.

- [Quickstart](quickstart-authoring.md) — nothing to a valid package in about
  fifteen minutes.
- [Worked example](worked-example.md) — a weak seed becoming a strong one, and
  the questions that did the work.
- [Authoring guide](authoring.md) — the full workflow, review threads, coaching
  depths, and workspace layout.
- [Kind-aware authoring](kind-guidance.md) — choosing between application,
  feature, workflow, and the rest.
- [Authoring errors](authoring-errors.md) — every code, its cause, and how to
  clear it.
- [Preparing and publishing](publishing.md) — readiness checks and the
  distributable archive.

## Using a SeedSpec

For adopters and implementing agents.

- [Runtime behavior](runtime.md) — the complete resolution and handoff
  lifecycle.
- [Use cases](use-cases.md) — realization and distribution patterns.
- [Composition](composition.md) — combining packages.
- [Implementation profiles](implementation-profiles.md) and
  [implementation resources](implementation-resources.md).
- [Capabilities](capabilities.md) — declarations, versions, and conformance
  material.

## The protocol

Normative behavior is defined only by the specification, the schemas, and the
conformance contract.

- [Language definition](01-language.md) — concepts, authority model, lifecycle,
  and claim boundaries. Read this first.
- [Protocol 0.2 specification](protocol.md) — field-level rules.
- [Operations](operations.md) — operation contracts.
- [Conformance](conformance.md) — what a conformance result establishes.
- [Versioning](versioning.md) and [migrations](migrations.md).
- [Adapters](adapters.md) — optional depth without protocol dependencies.
- [Security](security.md) — the trust boundary.

## Why it is built this way

- [Why semantic structure matters](semantic-structure.md) — what stable
  semantic roles buy that a single document does not.
- [Principles](principles.md) — design boundaries and decision tests.
- [Glossary](glossary.md) — terms and what they do not mean.
- [Evaluation findings](evaluations.md) — what the evidence supports, and what
  it does not.
- [Decisions](decisions/) — architecture decision records.

## Three separate claims

SeedSpec keeps these apart deliberately, and no document here collapses them:

| Claim | Established by |
| --- | --- |
| An independent tool can interpret this package. | Protocol validation and conformance. |
| The seed communicates the important intent well. | Authoring review and human judgment. |
| This implementation satisfied the selected intent. | Scoped completion evidence from the realization. |

A valid package is not automatically a strong one, and a strong specification
does not guarantee a correct implementation.
