---
name: implement-seedspec
description: Implement a SeedSpec package and complete only after seedspec check passes.
---
# Implement SeedSpec

Read the package `SPEC.md` first. Treat success criteria as the work list. Do
not expand the intended capability surface.

1. Implement the smallest reversible change that could satisfy each criterion.
2. Run `seedspec check <package>` after material changes. If an evaluator and
   workspace are configured, include `--evaluate` and `--workspace`.
3. Repair failed criteria.
4. Do not certify verification from this session's judgment.
5. Stop when `seedspec check` reports `pass` with trusted evidence, or when a
   consequential ambiguity needs the author.

A normal final response is not completion. Implementing-agent evidence cannot
pass the check.
