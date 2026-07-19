# SeedSpec Protocol decision principles

SeedSpec packages ideas and the artifacts that help people and tools turn those ideas into software. The protocol makes those materials portable, discoverable, composable, and verifiable without claiming control over the implementation process.

These principles guide protocol, runtime, authoring, adapter, and marketplace decisions.

## Package ideas, not one universal specification

A SeedSpec does not require one document format to completely define an application. Product definitions, ProductSpecs, designs, API contracts, implementation plans, reference applications, evaluations, and infrastructure material may coexist as separate artifacts.

SeedSpec standardizes the package and relationships between those artifacts. Each artifact format retains its own semantics and validation rules.

## Keep concerns separate

Product intent, technical design, execution planning, and infrastructure answer different questions:

- **Intent** describes the outcome, behavior, constraints, and reasons for the work.
- **Design** describes a technical approach for realizing that intent.
- **Execution** describes tasks, progress, and implementation evidence.
- **Infrastructure** describes how an implementation is built, operated, and deployed.

A tool may derive one concern from another, but derivation does not make them the same artifact or give the derived artifact authority over its source.

## Discovery is not activation

Declaring an artifact makes it discoverable. It does not:

- execute the artifact;
- load an artifact-provided skill or prompt;
- activate an artifact-specific workflow;
- make the artifact authoritative to an implementation agent;
- authorize changes to the artifact or application.

Runtimes may inspect descriptive metadata needed to explain an artifact and locate compatible tooling. Behavior-changing tooling requires an explicit user action.

## The end user directs the implementation agent

SeedSpec authors describe a product and may record decisions, constraints, relationships, and evidence. They cannot guarantee that a later implementation agent will follow those materials.

An execution engine should surface consequential choices and relevant artifacts to its end user. The end user decides how the agent uses them. SeedSpec supplies context for that decision and does not silently choose on the user's behalf.

## Official integration does not create a dependency

An official adapter means the SeedSpec toolchain recognizes an artifact type, points to its documentation, and can expose compatible inspection or validation tools. It does not make the artifact format part of SeedSpec core or require packages to contain it.

Core package conformance and adapter-specific artifact conformance are separate results. A package can remain a valid SeedSpec when an optional adapter is unavailable or unused.

## Adapters provide depth; the protocol provides breadth

The protocol should know enough to identify, locate, relate, preserve, and safely hand off an artifact. Format-specific parsers, validators, generators, and workflows belong in separately versioned adapters.

Adapters must not redefine core fields, relax core validation, or silently turn descriptive package content into executable agent policy.

## Handoff, not permanent control

SeedSpec is a handoff protocol, not a continuing control plane. Generated software may retain lineage to the packages and artifacts that informed it, but the protocol does not require code and source artifacts to remain synchronized forever.

Maintenance, regeneration, drift reconciliation, and migration are optional workflows provided by tools and chosen by users.

## Progressive elaboration

Authoring may begin from a sentence, a detailed product document, a prototype, an architecture, or a working application. A sparse but honest idea is preferable to invented completeness.

Authoring tools may help a user progressively:

1. capture the source idea;
2. shape actors, outcomes, workflows, and concepts;
3. harden permissions, invariants, failures, and acceptance behavior;
4. analyze feature candidates, capability context, and related artifacts.

Not every author must complete every stage before using or sharing a SeedSpec.

## Declarations are not implementation state

Capability, compatibility, and conflict fields record what package authors
designed, tested, or expect. SeedSpec does not continuously inspect the generated
application and cannot prove that a capability is present, absent, compatible,
or conflicting. Composition preserves those declarations as review context; the
implementation agent evaluates them against actual code and user intent.

Structured spec workflows demonstrate the value of making requirements, design, and implementation tasks separately inspectable; linking transformed outputs back to their sources; and checking requirements before expensive implementation begins. SeedSpec adopts those lessons as authoring and analysis capabilities. It does not require every package to pass through the same stages or make a task plan part of product intent.

## Evidence over architectural enforcement

SeedSpec records observable behavior, source identity, capability expectations, decisions, and verification evidence. It does not require a particular framework, repository layout, task system, agent, cloud, or architecture unless the product outcome genuinely depends on one.

## Extension without capture

New artifact types, adapters, publishers, catalogs, and implementation environments should be able to participate without changing the core protocol. Namespaced identifiers and extensions prevent accidental collisions while keeping ecosystem policy outside the package format.

## Influences, not dependencies

[ProductSpec](https://github.com/gokulrajaram/ProductSpec/blob/d286a8e9a7a83e0be15a0d9c360c549590134440/docs/vision.md) sharpens the distinction between durable product intent and downstream engineering specs, tasks, code, and evidence. Its drift model also shows why divergence should lead to an explicit decision instead of silently treating either document or code as automatically correct. SeedSpec adopts the separation and the value of traceability; it leaves continuous reconciliation to an optional user-chosen workflow.

[Kiro Specs](https://kiro.dev/docs/specs/) demonstrate the practical value of distinct requirements, design, and task artifacts; cross-requirement analysis; traceability into implementation; and workflows that can start requirements-first, design-first, or with a faster one-pass plan. SeedSpec applies these lessons to progressive authoring, artifact relationships, linters, and implementation skills. It does not require the Kiro file set, phase order, approval gates, or execution engine.

## Decision test

When considering a new field or feature, ask:

1. Is this a portable fact needed to identify, configure, compose, or verify a package? It may belong in the protocol.
2. Is this specific to one artifact format? It belongs in an adapter.
3. Does this guide authoring, analysis, discovery, or implementation? It usually belongs in tooling or a skill.
4. Does this execute code, modify an application, or change agent behavior? It requires explicit user direction and does not activate from discovery alone.
5. Is this registry, marketplace, payment, reputation, or publisher policy? It belongs outside the neutral protocol.
