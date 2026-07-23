# Decision 0012: Preserve package-authored tasks as ordered agent reminders

- Status: accepted for Protocol 0.1 design alpha
- Date: 2026-07-22

## Context

A package author may know a useful sequence for realizing a package: inspect
the existing environment, consult particular context, adapt the reference
approach, implement, and verify. Preserving that sequence can keep an agent
from skipping important reasoning steps or losing the author's implementation
experience.

Modeling these items as features, acceptance criteria, or independently
schedulable units would blur concern boundaries. Adding dependencies,
conditions, checkpoints, branches, or jumps would also turn a small handoff
primitive into a workflow engine. The target repository may invalidate the
author's assumed route, and completion of a task list cannot prove that the
realization satisfies package intent.

## Decision

1. A package may reference one task-runbook file containing a non-empty ordered
   array.
2. Each task contains only a stable local `id`, a non-empty `instruction`, and
   optional package-relative file `references`.
3. Array order is the only sequencing mechanism. Core defines no dependency
   graph, branching, condition, checkpoint, jump, or parallel-execution
   semantics.
4. Tasks are implementation reminders, not product intent, additional
   acceptance requirements, executable content, or conformance evidence.
5. Mutable task progress and run notes remain outside the published package.
6. Resolution preserves every package's authored order, copies referenced
   files into the handoff, and derives no cross-package task order.

## Consequences

- Authors can preserve procedural experience without restating a package as a
  feature backlog.
- Agents receive a clear top-to-bottom sequence with durable local context.
- Task IDs support reporting and resumption without becoming control-flow
  labels.
- A blocked or inapplicable task must be recorded and explained against the
  actual environment rather than silently hidden.
- Completing all tasks remains implementation progress; acceptance and
  capability conformance require their own scoped results and evidence.
- The task model can remain intentionally small until real package experience
  demonstrates a need for another property.
