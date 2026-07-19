# ADR 0006: Completion is separate from readiness

Status: accepted for the private alpha

## Context

Protocol 0.1 permits packages without acceptance components, while rich
packages may contain more acceptance behavior than a buyer selects for one
implementation pass. The original project status described input readiness but
generated an unstructured verification report that could be mistaken for a
completion claim.

## Decision

- Keep package acceptance optional.
- Record completion scope separately from configuration and implementation
  readiness.
- Let scope items select all or a referenced subset of a preserved acceptance
  component, or state project-local criteria for a selected package.
- Preserve included, deferred, and excluded expectations distinctly.
- Report uncovered selected packages as `completion_scope_status: review`
  without blocking an otherwise ready implementation handoff.
- Generate structured verification state bound to a digest of the resolved
  scope and preserve it across resolution reruns.
- Derive completion status from scope coverage, item results, evidence, and
  explicit deferrals through `seedspec completion`.

## Consequences

A project can truthfully be `ready` and `not-started`, and it can be
`verified-with-gaps` against a recorded scope. Minimum packages can acquire
agent-authored observable criteria without making acceptance a required package
file. Arbitrary Markdown reference labels are preserved assertions: core can
validate their package/component relationship but cannot prove that the label
exists in the source prose.

