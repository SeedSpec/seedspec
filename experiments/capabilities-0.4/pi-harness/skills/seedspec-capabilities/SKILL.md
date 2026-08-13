---
name: seedspec-check
description: Implement a SeedSpec package and complete only after the independent check passes.
---
# SeedSpec check

Read `.seedspec/check-harness.json`. Read the package `SPEC.md` it names.

Treat success criteria as the implementation rubric. Do not expand the intended
capability surface. Do not certify verification yourself.

1. Implement against the declared criteria.
2. Run `seedspec_check` after material changes.
3. Repair failed criteria.
4. Call `seedspec_complete` as the final action.

A normal final response does not complete this task.
