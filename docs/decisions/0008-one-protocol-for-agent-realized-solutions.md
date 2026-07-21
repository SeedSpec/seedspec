# ADR 0008: One protocol for agent-realized solutions

> **Non-normative rationale.** This record explains an accepted design decision;
> the protocol specification, schemas, and conformance suite define conformance.

- Status: accepted for the 0.1 design alpha; the kind decision is superseded by ADR 0009
- Date: 2026-07-19

## Context

SeedSpec began with applications and features because they provide a concrete,
high-value test of portable product intent. The same package model is also
useful when the intended result is not primarily new source code. An agent may
need to configure a dashboard in an existing SaaS product, add fields and
workflows to a CRM, establish a scheduled cross-system automation, generate a
recurring communication, or combine those changes with a new application.

These cases share the protocol's essential concerns: durable intent,
configuration, relevant context, optional implementation resources, user
choices, observable success, versioning, and a handoff to an agent. Splitting
them into separate protocols would create artificial boundaries around
solutions that routinely combine code, configured system state, and automated
work.

The discussion also exposed two independent axes that the current
`application` and `feature` package kinds do not fully name:

1. a package's role in composition, such as the root of a resolution or a
   reusable addition; and
2. the form of its realization, such as an application, configured system,
   automation, communication, or composite outcome.

Adding realization labels beside `application` and `feature` would conflate
those axes. An automation can be either the root outcome or one feature of a
larger solution.

## Decision

SeedSpec remains one protocol for packaging intent that an agent can realize.
The intended result may be software, configured system state, an automation, a
generated operational artifact, or a composite of those forms.

SeedSpec does not promise deterministic agent execution or identical outputs.
It gives authors progressively stronger ways to communicate intent, preserve
context, offer resources and alternative approaches, record constraints, and
define observable success. Specificity of intent is not prescription of
execution.

The end user directs the implementing agent. The agent may compare authored
approaches, identify conflicts with the actual environment, and recommend that
the user reconsider a choice. It must not silently replace an explicit user
choice merely because another authored approach appears preferable.

Protocol 0.1 originally deferred new package kinds while non-application
examples were developed. The HubSpot workflow exercise demonstrated that kind
hints and composition roles can be separated. ADR 0009 supersedes this portion
of the decision: `kind` is now descriptive, root/addition role comes from
resolution position, and implementation profiles carry candidate realization
context.

Authoring tools may branch their questions and quality checks for applications,
configured systems, automations, and composite solutions without making those
flows separate protocols or making a sparse but honest package invalid.

## Alternative realizations

One package may preserve several suggested ways to realize the same intent.
These alternatives are decision context, not automatically active execution
instructions. A resolved handoff should make the user's selected direction
prominent while retaining concise information about declined, deferred, or
unselected alternatives when it helps the agent avoid accidental drift or
surface a material conflict.

Alternative realizations do not replace configuration or features:

- configuration changes variable behavior of the intended solution;
- features add or modify portable capabilities; and
- realizations describe materially different ways to accomplish the intent.

Protocol 0.1 can experiment with realizations through definitions, decisions,
artifacts, relationships, technical preferences, and implementation resources.
A future core model requires concrete interoperability evidence rather than a
premature enum.

## Portability

Portability does not require every package to be provider-neutral. A
HubSpot-authored package may depend deeply on HubSpot and still be portable
between capable agents. A user may ask an agent to adapt it to Salesforce, but
the package need not claim that the adaptation is tested or lossless.

Authors and tools should distinguish at least:

- **agent portability**: another capable agent can interpret the package;
- **environment portability**: the intent can be adapted to another customer's
  systems and constraints;
- **platform portability**: a named provider can be replaced; and
- **implementation portability**: architecture and technology choices can
  change.

A useful package may be strong on some dimensions and intentionally narrow on
others.

## Registries

Registries, marketplaces, and catalogs remain outside the neutral protocol.
They may index related packages, features, realizations, implementation
resources, tested environments, evidence, and known limitations. Registry
discovery or ranking does not activate content, prove compatibility, or
override user choice.

This separation allows the protocol to provide stable identity, relationships,
configuration, integrity, and handoff semantics while independent services
build a compounding graph of ways to solve related problems.

## Consequences

- Core language and verification guidance must not assume every result is a new
  repository or standalone application.
- Security guidance must cover agents changing authenticated external systems,
  not only writing files or code.
- Completion evidence may reference durable external state, created resource
  identifiers, delivered messages, screenshots, queries, or other observations.
- The initial market story may continue to emphasize applications and features
  even though the protocol's design scope is broader.
- Non-application examples are required before adding realization-specific
  schema or runtime behavior.
