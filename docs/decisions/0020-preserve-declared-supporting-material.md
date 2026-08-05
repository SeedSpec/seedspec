# Decision 0020: Preserve declared supporting material by default

- Status: accepted for the reference authoring product
- Date: 2026-08-04

## Context

A SeedSpec package can carry substantially more than a short seed. Context
modules, capability contracts, implementation profiles, skills, instructions,
verification resources, tools, tasks, artifacts, design material, reference
code, and evidence can make one package much deeper than a general co-authoring
conversation can produce.

The protocol already gives several of these materials separate authority and
integrity boundaries. Package-scoped skills are subordinate guidance rather
than product intent. Bundled implementation resources carry independent
versions and digests. Context modules can declare native formats, versions,
conformance references, and bridge Skills. Artifacts remain passive. Resolution
does not install skills or execute tools.

The authoring operating brief instructed agents to inventory this material but
did not enumerate it in active context or state clearly that visibility is not
mutation authority. A capable agent could therefore inspect a bundled skill,
eval, behavior module, or reference implementation and begin "improving" it
without understanding its separate maintenance and verification contract.

## Decision

1. The operating brief enumerates declared context modules, implementation
   resources, profiles, tasks, and artifacts with their semantic roles and
   relevant declaration metadata.
2. Existing non-primary context modules and supporting material are visible
   authored package material and are preserved byte-for-byte by default.
3. Visibility is not authority to optimize, normalize, migrate, rewrite,
   remove, install, invoke, execute, or fetch declared material.
4. Default authoring review examines declared purpose, usage, applicability,
   authority, delivery, and relationship to core intent. It does not perform a
   general quality audit of supporting bodies.
5. The agent does not open every supporting body by default. It reads one only
   when its declaration makes it relevant, a core authored claim depends on it,
   a declared reference is broken, or the author asks about it.
6. Except for context modules fixed by Decision 0021, a supporting body can
   enter authoring scope only when the author explicitly asks to edit that
   named material or accepts addressing a source-grounded conflict that
   requires an edit.
7. Before proposing such an edit, the agent identifies affected manifest
   declarations, digests, versions, conformance claims, bridges, relationships,
   and verification steps. Related updates remain author-approved changes.
8. Bundled implementation-resource bytes and their declared digest and version
   form one maintenance unit. An agent must not edit the body without a matching
   declaration update and subsequent validation.
9. Context modules and artifacts do not all carry independent digests. Their
   native format, version, conformance, bridge, or relationship metadata still
   requires review when their bytes change. Every package-local edit changes the
   overall package digest and can stale proposals, locks, receipts, or evidence.
10. Package-scoped skills remain subordinate guidance. Verification resources
   and evals remain supporting material. Neither becomes product intent or
   execution authority merely because it is declared.
11. Consequential product behavior must remain independently recoverable from
    core package meaning. A skill or eval cannot be its only definition.
12. An undeclared file receives no inferred skill, eval, context, or authority
    semantics merely because its path or filename resembles a known format.

## Consequences

- Deep packages remain visible to the authoring agent without inviting
  opportunistic rewrites.
- Existing domain expertise can travel with a package while retaining its own
  version, integrity, trust, and lifecycle boundary.
- Authors can still request focused maintenance of other supporting material
  through the ordinary exact-proposal and acceptance loop.
- A specialized skill or eval audit remains opt-in rather than another default
  authoring checklist.
- The operating brief becomes longer for packages with substantial declared
  material, but it exposes summaries and locations rather than loading every
  supporting body automatically.
