# Decision 0021: Fix context modules during ordinary authoring

- Status: accepted for the reference authoring product
- Date: 2026-08-04

## Context

Decision 0020 made declared supporting material preserve-by-default. It still
allowed an explicitly requested context-module edit to enter the ordinary
authoring proposal loop.

That boundary is too permissive. A context module can carry behavior, a Skill,
an evaluation contract, or another independently maintained context format.
The module's package digest changes with any package edit, but that fact does
not give the authoring agent authority to change the module. The important
boundary is mutation ownership, not whether the overall package digest changes.

## Decision

1. Every existing non-primary context-module body is a fixed input to an
   authoring cycle.
2. The operating brief can expose and selectively read the module. Visibility
   does not permit an authoring proposal for its package-local bytes.
3. The document proposal operation rejects a target inside a package-local
   non-primary context module.
4. The document apply operation checks the same boundary again. A queued or
   historical proposal cannot enter a path that is now a declared context
   module.
5. The boundary covers package sources, package-local artifact sources, and
   bundled implementation-resource sources used by context modules.
6. The primary intent module remains editable because it is the authoring
   surface selected by `definition.module`.
7. Authoring can change core documents or module declarations around a fixed
   module through the existing proposal and author-approval gate.
8. If the context-module bytes must change, the author or a specialized tool
   maintains them through the module's native workflow. Authoring resumes after
   the changed package establishes a new baseline.
9. This decision supersedes Decision 0020 only where it allowed explicit
   authoring edits to an existing non-primary context-module body. Other
   supporting material remains preserve-by-default and can enter explicitly
   scoped maintenance.

## Consequences

- Core authoring changes cannot leak into skills, behaviors, evaluations, or
  other declared context modules.
- A package digest change remains an expected result of editing the spec. It is
  not used as the context-module ownership boundary.
- Module maintenance is separate from ordinary SeedSpec authoring, even when
  the same person or agent performs both workflows.
- Changing module declarations can make existing proposals newly protected, so
  application must recheck the current manifest.
