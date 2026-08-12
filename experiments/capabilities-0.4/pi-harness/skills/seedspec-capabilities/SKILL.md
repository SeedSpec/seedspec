---
name: seedspec-capabilities
description: Implement an accepted SeedSpec capability bundle while preserving source binding and recording stage evidence.
---

# SeedSpec capability implementation

Read `.seedspec/capability-harness.json`. Read the accepted bundle it names.

Treat accepted capabilities as an implementation and verification rubric. Do
not replace package intent with the rubric. Resolve conflicts in favor of the
authoritative package and report stale bundle diagnostics.

For each outcome:

1. Find the implementation locations that realize it.
2. Record one implementation evidence entry.
3. Run or perform each declared acceptance check.
4. Record exact verification evidence.
5. Run `seedspec_capability_check`.
6. Repair failed or missing evidence.
7. Call `seedspec_capability_complete` as the final action.

Do not claim that an agent review is deterministic. Do not treat the presence
of a script as proof that it passed.
