# Kind-aware authoring guidance

Manifest `kind` is a strong hint about the expected shape of a package. It does
not determine whether the package may be a composition root or addition, and it
does not add kind-specific conformance requirements.

That flexibility must not make `kind` decorative. Authoring and inspection
tools SHOULD ask different questions, recommend different levels of detail, and
surface likely scope mistakes based on the hint selected by the author.

## Validation and authoring review are different

Core validation answers whether the package conforms to the protocol. A
kind-aware authoring review answers whether the package appears well shaped for
the outcome the author says it describes.

A sparse but honest package can be protocol-valid while receiving several
recommendations. Likewise, a detailed package can be valid while receiving a
review diagnostic that some content appears to prescribe implementation rather
than describe core intent. Kind-aware diagnostics MUST NOT silently rewrite the
package or become hidden publication gates.

The reference CLI exposes this distinction:

```text
seedspec validate <package-path>
seedspec lint <package-path> [--json]
```

`lint` first validates the package, then emits `review`, `recommendation`, and
`information` diagnostics. A clean result is not a completeness or quality
certification.

`seedspec init <kind>` also uses the hint immediately: each core kind receives
a different starter definition organized around the concerns below. The
generated headings are prompts, not required sections, and authors may replace
them freely.

The reference lint is intentionally best-effort. It currently reports stable
diagnostic codes for likely missing kind concepts, implementation technology in
core intent, application-UI scope in configurations or integrations,
unspecified profile applicability or tradeoffs, question-shaped conditions,
custom verification methods, and evidence-producing methods that decline to
record evidence. Tooling MAY improve detection without changing package
validity; changes to the meaning of a diagnostic code should be treated as a
tooling compatibility change.

## Core kind suggestions

### `solution`

Use for a compound outcome or when no more specific realization shape should
dominate authoring.

Tooling should look for the intended outcome, boundaries, material dependencies,
and observable success. It should suggest a more specific kind only when that
would clearly improve authoring; `solution` is not an error or an immature
placeholder.

### `application`

Use for a user-facing software system or product.

Tooling should help define actors, permissions, domain concepts, workflows,
state, failures, configuration, and observable product behavior. Frameworks,
databases, hosting, repository layout, and class or component architecture are
usually implementation-profile material unless the intended outcome genuinely
depends on them.

### `feature`

Use for behavior intended to extend or change an existing solution.

Tooling should look for the host boundary, behavior added, capabilities used or
provided, integration expectations, configurable variation, failure behavior,
and host-independent acceptance. It should flag assumptions that accidentally
describe or replace the entire host solution.

### `workflow`

Use for a coordinated process across people, agents, or systems.

Tooling should look for participants, stages, handoffs, starting conditions,
decisions, failure and recovery, and evidence that the workflow completed.
Detailed screen architecture, service topology, or orchestration technology is
usually outside core intent.

### `automation`

Use for scheduled or event-driven behavior intended to operate with limited
human involvement.

Tooling should look for triggers or schedules, time boundaries, operational
ownership, idempotency, duplicate prevention, retries, observability, and
failure handling. A list of tool-specific steps without durable behavior and
operational expectations is not a sufficiently portable automation intent.

### `configuration`

Use when the primary outcome is desired state inside an existing system.

Tooling should look for target and existing-state discovery, naming and
ownership, permissions, drift or reconciliation, idempotency, rollback or
recovery, and verification evidence. Application personas, navigation,
component architecture, and unrelated product behavior deserve review unless
they are observable parts of the configured outcome.

### `integration`

Use for a connection or coordinated behavior across systems.

Tooling should look for participating systems, concept and data mappings,
authority boundaries, directionality, synchronization expectations,
idempotency, partial failure, retries, and verification. A complete application
UI or broad product-domain specification is usually outside the integration's
core intent; implementation-specific connectors and service architecture
usually belong in profiles.

## Scope diagnostics

Authoring tools SHOULD identify content that appears inconsistent with the kind
without asserting that the content is always wrong. Useful diagnostics include:

- missing concepts normally material to that kind;
- application-UI detail inside a configuration or integration;
- named frameworks, databases, clouds, or deployment mechanisms in core intent;
- feature definitions that silently assume control of the entire host;
- automations without ownership, retry, or duplicate-prevention behavior; and
- integrations without mappings, authorization, direction, or partial-failure
  behavior.

The suggested correction should preserve legitimate constraints. Provider-
specific intent is valid: a HubSpot configuration may name HubSpot throughout.
The relevant question is whether a detail defines the intended outcome or only
one way to implement it.

## Custom hints

Publishers may use namespaced custom kinds. Generic tooling preserves them and
falls back to `solution` guidance. Specialized tooling may add richer authoring
support, but a custom kind cannot relax core validation or change composition
semantics.

Promoting a custom hint into the core vocabulary requires demonstrated use in
multiple packages, a distinct and reusable authoring lens, documented fallback
behavior, and conformance and lint coverage. A label does not belong in core
merely because it is useful for marketplace categorization.
