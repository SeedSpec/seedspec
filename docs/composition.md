# Composition

> Informative. Normative bundled-child rules are in `protocol.md`.

0.4 composition is exact bundled packages, not a capability solver.

A parent records a child `id`, `version`, `digest`, and `path`. Optional
children add `optional: true`. Enabling an optional child is project
state. It does not change the parent digest.

How the child participates is prose. There is no `provides` / `requires`
graph. Kind does not decide root versus addition.

## What the package cannot know

Whether the host already has equivalent behavior, whether names match, or
whether two packages conflict in real code. Those are review for the
agent inspecting the actual system.

Structural errors stay hard: unsafe paths, duplicate IDs, digest
mismatch, missing files.

Semantic composition questions stay review. Do not fail resolution
because a vocabulary word is missing from another package's YAML.

## Feature into a host

The child names required host concepts. The host keeps its names. The
agent maps them. Rejecting the child because the host package did not
declare a matching capability is the failure mode 0.4 is meant to avoid.
