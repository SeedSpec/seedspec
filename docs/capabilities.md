# Capabilities

> Informative. Normative fields are in `protocol.md`.

A capability is a name for observable behavior in *this* package. Its
provenance is the package id, version, and digest. It is not an
independently versioned contract, and it is not a dependency.

## Write behavior, not a stack

Say the product concepts, ownership, invariants, failure, and what
remains a host choice. Do not say endpoints, tables, or screens unless
those *are* the destination.

A consumer should be able to need “attributed balances” without needing
the host to call them that.

## What a capability is not

- Proof the current code has the behavior
- A `provides` / `requires` gate
- A reason to reject composition
- A skill, profile, or eval

If two packages use the same word, that is vocabulary for an agent to
reconcile in real code. It is not package-manager truth.
