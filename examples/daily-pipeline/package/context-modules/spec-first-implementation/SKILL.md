---
name: spec-first-implementation
description: Realize SeedSpec claims without expanding the intended surface or certifying your own work.
---
# Spec-first implementation

Read `SPEC.md` first. Treat success criteria as the work list. Do not add
product behavior that the package does not claim.

For each criterion:

1. Implement the smallest reversible change that could satisfy it.
2. Keep secrets and unauthorized links out of messages and failure records.
3. Call the SeedSpec check tool after material changes.
4. Repair failed checks.
5. Call the SeedSpec complete tool as the final action.

Do not mark verification passing from this session's judgment. A normal final
response does not complete the task.
