# Decision 0011: Add machine-operable capability evidence without replacing prose

- Status: accepted for Protocol 0.1 design alpha
- Date: 2026-07-22

## Context

Capability contracts describe provider-neutral product behavior such as
authorization, invariants, state transitions, idempotency, and failure
semantics. Markdown preserves that meaning across implementations, but exact
revision equality alone produces an undifferentiated review signal. At scale,
review signals without direction or severity invite alarm fatigue. Package
evals, verification resources, and project completion evidence provide useful
adjacent machinery but are not bound to one capability revision.

OpenAPI, protobuf, and JSON Schema solve narrower technical-interface problems.
They should not replace the behavioral contract, but SeedSpec should preserve
machine-checkable fragments when a capability has them.

## Decision

1. Keep the Markdown capability contract primary and provider-neutral.
2. Let revised capabilities carry contiguous, semver-consistent structured
   history with breaking, additive, and clarifying change entries.
3. Classify revision differences by provider direction, semver distance, and
   review severity while keeping every difference as review context rather
   than a composition gate.
4. Let a capability revision optionally ship a conformance suite containing
   JSON Schemas, structured acceptance scenarios, or adapter-run eval bundles,
   with explicit partial or full coverage.
5. Record capability-conformance results separately from project completion.
   Bind them to exact contract and suite bytes, one realization, evaluator,
   complete check coverage, derived status, and evidence.
6. Validate suite and result structure without automatically executing
   package-supplied runners or tools.

## Consequences

- Review queues can prioritize major and older-provider risks above newer patch
  differences and can display steward-declared semantic changes.
- Authors can make stable parts of a behavioral contract executable without
  forcing every provider to expose the same endpoint, schema, or architecture.
- A passing partial suite proves only its declared checks. Full coverage is an
  author claim and finite tests do not prove that prose has no untested meaning.
- A capability result may support a project completion item, but it cannot
  replace the project's explicit scope or be inferred from package declarations.
- Protocol schemas, the reference runtime, and the conformance suite become
  incompatibly stricter during the design alpha.
