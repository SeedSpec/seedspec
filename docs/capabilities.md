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

Revision review is direction- and severity-aware:

| Relationship | Review severity |
| --- | --- |
| Exact revision | none |
| Provider newer by patch | low |
| Provider newer by minor | medium |
| Provider newer by major | high |
| Provider older by patch | medium |
| Provider older by minor or major | high |

An older provider deserves more scrutiny because a newer consumer may rely on
behavior added after the provider revision. Severity prioritizes review; it
does not establish compatibility or turn a revision difference into an
installation gate.

## Structured revision history

When a published capability revision replaces an earlier revision, declare a
contiguous `change_history` ending at the provided version. Each transition has
one or more stable change IDs tagged as:

- `breaking` for a major revision;
- `additive` for a minor revision; or
- `clarifying` for a patch revision.

The runtime validates that the tags agree with the version transition. During
composition it attaches any complete, relevant provider history to the
revision-difference record. These remain steward declarations: tooling can
prioritize and explain a change without pretending that it derived semantics
from Markdown.

```yaml
provides:
  capabilities:
    - id: org.example.product.transactions
      version: "1.2.0"
      contract: capabilities/transactions.md
      change_history:
        - from: "1.1.0"
          to: "1.2.0"
          changes:
            - id: idempotent-reversal
              type: additive
              summary: Consumers may request an idempotent transaction reversal.
```

## Checkable contract material

Markdown remains the primary contract because authorization, invariants,
failure behavior, and product semantics rarely reduce to one technical API.
A capability may additionally ship a version-bound conformance suite:

```yaml
      conformance:
        suite: capabilities/conformance/transactions.suite.yaml
```

A suite declares whether its checks provide `partial` or `full` coverage and
may include:

- `json-schema` checks for observable data shapes;
- `acceptance-scenarios` containing structured given/input/expected examples
  interpreted by a named runner; and
- `eval-suite` bundles interpreted by a named runner.

```yaml
protocol_version: "0.2"
capability:
  id: org.example.product.transactions
  version: "1.2.0"
coverage: partial
checks:
  - id: transaction-shape
    kind: json-schema
    subject: data-shape
    description: Transactions expose stable identity, amount, and state.
    path: capabilities/conformance/transaction.schema.json
  - id: idempotent-reversal
    kind: acceptance-scenarios
    subject: behavior
    description: Retrying one reversal does not reverse twice.
    path: capabilities/conformance/reversal.scenarios.yaml
    runner: org.example.runner.transaction-scenarios
```

SeedSpec validates suite identity, check references, JSON Schemas, and standard
scenario documents. It does not automatically execute package content. A
runner records a separate capability-conformance result containing the exact
capability revision, contract digest, suite digest, realization identity,
evaluator, per-check results, and evidence.

Run:

```bash
seedspec capability-conformance package/ org.example.product.transactions
seedspec capability-conformance package/ org.example.product.transactions \
  --result transaction-conformance.yaml
```

`passed` means every declared suite check passed against that realization. For
a partial suite it proves only that checkable subset. Even a full-coverage label
is an author coverage claim, not mathematical proof that the prose contains no
unexercised meaning.

Capability conformance and project completion are deliberately separate. A
capability result can become evidence for a project's completion scope, but it
does not replace `verification-state.yaml`, and project completion does not
certify a reusable provider against every consumer.

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
- Does structured change history form a complete chain to the current revision?
- Does each `tested_against` revision represent real design or testing evidence?
- Does every conformance suite identify the exact capability revision and state
  honest partial or full coverage?
- Would an agent understand how to find contract history and record a local semantic mapping?
- Does the package avoid claiming that a declaration proves the actual host has
  or lacks the capability?
- Are optional implementation resources clearly separated from the behavioral
  contract, versioned independently, and narrow enough to justify their context
  cost?
