# Capability authoring and evolution

> **Informative guidance.** Normative capability fields and resolution behavior
> are defined by the protocol specification and schemas.

Capabilities let independently published packages describe expected observable
product contracts without agreeing on source code or infrastructure. They are
integration context for an agent, not proof of what the actual realization
implements.

Capability contracts and implementation resources are deliberately separate.
A contract says what behavior a package expects or describes. A skill,
instruction set, verification module, or tool may help implement that behavior,
but its presence does not establish that the implementation has the capability.
An author may associate a resource through `applies_to.capabilities`; the agent
still evaluates it against actual code and user intent. See
`implementation-resources.md`.

## Choosing an identifier

Use a reverse-DNS namespace controlled by the capability steward. Prefer a domain concept over an implementation artifact:

```text
org.seedspec.core.transactions
org.seedspec.finance.savings-goals
```

Avoid names such as `transaction-api`, `postgres-ledger`, `balance-screen`, or `react-goals` unless the capability genuinely promises that technical surface.

The owner of an ID is responsible for publishing its contract, evolving it consistently, and preventing two unrelated meanings from sharing one version line.

## Writing a contract

A useful contract states:

- the product concepts available to consumers;
- identity and ownership boundaries;
- authorization expectations;
- observable operations and state transitions;
- invariants and atomicity;
- idempotency and concurrency behavior;
- failure behavior;
- historical or deletion behavior;
- what remains a host integration choice.

It need not define endpoints, method signatures, tables, or UI. A consumer should be able to say what behavior it needs without knowing how the provider realizes it.

## Versioning

Use:

- patch for clarifications and compatible corrections;
- minor for additive optional behavior that does not invalidate existing consumers;
- major when a consumer may need different product behavior or integration.

A provider publishes one exact current contract revision. A consumer records the exact revision it has actually been designed or evaluated against through `tested_against`.

Revision equality is useful testing evidence. A difference does not prohibit
integration: it creates a review signal for the implementing agent. The agent
should read available contract history and inspect the current code,
configuration, and external state; plan around semantic differences; preserve
local terminology; and verify the composed use case.

## Provider candidates

`declaration-review-v1` records every selected package that declares a
capability. Zero candidates and multiple candidates both create review signals;
neither rejects the handoff. A declaration is not an installed dependency, and
the implementing agent may map equivalent existing behavior, adapt one or
more candidates, implement missing behavior, or surface a genuine conflict to
the user.

Exact revision equality produces `declared-aligned` only when exactly one other
package declares the capability. That label describes package evidence, not
runtime compatibility.

## Capability review checklist

- Is the ID namespaced and owned?
- Is the capability a durable product contract rather than an implementation module?
- Does the contract name its ID and version?
- Are authorization, retries, concurrency, and failure behavior clear where consequential?
- Does the version change match the semantic change?
- Does each `tested_against` revision represent real design or testing evidence?
- Would an agent understand how to find contract history and record a local semantic mapping?
- Does the package avoid claiming that a declaration proves the actual host has
  or lacks the capability?
- Are optional implementation resources clearly separated from the behavioral
  contract, versioned independently, and narrow enough to justify their context
  cost?
