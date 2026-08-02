# Kind hints in source-bound authoring

> **Informative guidance.** Manifest `kind` semantics are normative; this
> document describes how reference authoring tools use the hint.

Manifest `kind` describes the shape the author believes best fits the seed. It
does not determine composition position, add required subject matter, or define
a completeness checklist.

## Source-bound use

The reference authoring workflow uses `kind` to understand authored language,
not to search for missing topics.

For example:

- when an `application` seed names actors or permissions, the agent can help
  clarify those authored relationships;
- when a `workflow` seed names stages or handoffs, the agent can check whether
  the stated sequence contradicts itself;
- when an `automation` seed names retries or duplicate handling, the agent can
  evaluate whether those claims agree;
- when a `configuration` seed names desired state and rollback, the agent can
  compare the two; and
- when an `integration` seed declares mappings or directionality, the agent can
  identify conflicts among those declarations.

An application that never mentions permissions does not have a permission
finding merely because its kind is `application`. An automation that never
mentions retry behavior does not acquire a retry finding. The author may ask to
brainstorm those topics, but that is optional expansion rather than review of
the authored seed.

## Validation and review are different

Core validation answers whether the package conforms to the protocol.
Source-bound review helps the author understand and improve what they supplied.
A sparse but honest package can be valid, useful, and free of review findings.

The reference CLI exposes the distinction:

```text
seedspec validate <package-path>
seedspec lint <package-path> [--json]
```

`lint` first validates the package, then emits only diagnostics triggered by
declared content or by the reference authoring floor of separate success
material. Current examples include:

- a separate success component is absent, empty, or still a scaffold;
- implementation-specific technology appears in primary intent;
- application-UI language appears in a declared configuration or integration;
- a declared profile condition is written as a question;
- a declared custom verification method needs interoperable guidance; or
- a declared evidence-producing method explicitly declines evidence.

A clean result is not a completeness or quality certification.

## Core hints

The core hints remain:

- `solution` — a compound outcome or neutral general seed;
- `application` — a user-facing software system or product;
- `feature` — behavior extending or changing an existing solution;
- `component` — a bounded reusable part of a larger solution;
- `workflow` — a coordinated process across participants;
- `automation` — scheduled or event-driven behavior;
- `configuration` — desired state inside an existing system; and
- `integration` — coordinated behavior across systems.

These descriptions help readers interpret intent already present in the seed.
They do not imply mandatory sections.

## Scope diagnostics

Tools may identify content that appears inconsistent with the selected hint
when the content itself triggers the concern. For example, an integration seed
that explicitly specifies an unrelated application interface or a portable
seed that names one framework may deserve review.

The suggested correction must preserve legitimate provider-specific or
technology-specific intent. A HubSpot configuration may name HubSpot
throughout. The relevant question is whether the authored detail defines the
desired outcome, not whether a generic template would have included it.

## Custom hints

Publishers may use namespaced custom kinds. Generic tooling preserves them
without falling back to a missing-concept checklist. Specialized guidance may
interpret authored concepts in that domain, but it cannot introduce unrelated
requirements or change core validity.
