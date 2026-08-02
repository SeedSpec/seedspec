# Package composition

> **Informative guidance.** The normative composition algorithm and resolved
> state requirements are defined in `docs/protocol.md` and the conformance suite.

The normative algorithm is `declaration-review-v1` in `docs/protocol.md`.
Resolution begins with one root package, an unordered user selection of
explicit additions, and every recursively bundled child declared by those
packages. Manifest kind hints do not constrain either position.

```text
validated package bytes
          |
          v
recursive bundled children + authored integration seams
          |
          v
deterministic package-ID order
          |
          v
capability + compatibility + conflict declarations
          |
          v
provider candidates + review records
          |
          v
package-author intent + end-user applied intent
          |
          v
implementation-profile evaluation
          |
          v
per-package ordered task preservation
          |
          v
resolved agent handoff
          |
          v
agent inspects actual realization and decides integration
```

Resolution fails for structural problems: invalid packages or references, unsafe
content, duplicate IDs within a manifest, mismatched bundled identity,
conflicting versions or digests for one selected package ID, and selecting the
same explicit package ID twice.

Resolution does not fail merely because:

- no selected package declares a required capability;
- multiple packages declare the same capability;
- a package author declares a conflict;
- declared requirements form a cycle;
- a provider revision differs from `tested_against`; or
- compatibility scope does not name the root package.

Those conditions become review context. The implementing agent may discover
that the real solution already implements an equivalent capability under
different terminology, that an addition should supply missing behavior, that two
declarations can be mapped together, or that an author concern genuinely blocks
the user's desired outcome. SeedSpec cannot know which answer is correct without
the actual implementation.

Review context is prioritized rather than flattened. Revision differences
record provider-newer or provider-older direction, major/minor/patch distance,
and low/medium/high severity. Relevant structured provider changes are copied
when the declared history covers the compared revisions. Severity and author
change tags explain what deserves attention; neither is a compatibility
verdict.

Root, addition, applied-intent, decision, implementation-profile, artifact, and
technical-configuration state stay in separate namespaces. Every explicit
package configuration is complete; resolution never fills a custom selection
from an example. Missing applied-intent affirmation, configuration selection,
required decision answers, or an ambiguous implementation-profile preference
produce a valid project
with `status: needs-input`; they do not disappear into implementation
assumptions.

## Bundled package edges

A parent can carry complete child SeedSpecs under its own package root:

```yaml
components:
  integration: integrations/

composition:
  includes:
    - id: shared-agenda-widget
      path: bundled/widget
      package: org.example.components.widget
      version: 1.2.0
      digest: sha256:<child-package-digest>
      integration: integrations/shared-agenda-widget.md
```

The edge identifies the exact child and one Markdown seam. The integration file
is ordinary prose with a declared semantic role. The protocol does not require
headings or fields inside it.

Authoring tools can offer a structure when it helps. Useful topics include:

- responsibility split;
- parent and child concept mapping;
- state ownership;
- actions and events crossing the seam;
- configuration mapping;
- loading, empty, and failure states;
- excluded responsibilities; and
- observable integration checks.

These are prompts, not a completeness checklist. Only topics made material by
the authored parent-child relationship belong in the seam.

Children can declare their own children. Resolution walks the full tree,
selects each exact child identity once, and preserves every edge. The resolved
`project.yaml` points each edge at the copied integration Markdown so an agent
can inspect the package as the author intended.

Bundling and an integration seam do not prove compatibility. The implementing
agent still maps both authored intents to the actual environment. It may adapt
the realization, but it should not silently narrow either package's behavioral
contract.

The protocol does not search a component catalog or decide what to bundle.
SeedSpec Library and Authoring products can make those discovery and
recommendation decisions before they produce this portable package structure.

Resolution compares package-author and end-user applied intent before profile
evaluation. A package may apply as authored, require adaptation, be only
partially useful, or be a poor fit. Agent-proposed intent remains visible and
review-required until the end user affirms it.

Completion scope and verification remain independent from that readiness state.
A ready project can still have `completion_scope_status: review` or structured
verification status `not-started`. Package acceptance material becomes part of
a completion claim only through an explicit scope record with a verification
plan. Evidence later attached to the item must identify the same realization or
outcome subject.

Optional task runbooks remain separately namespaced implementation guidance.
Resolution preserves the array order authored by each package and copies its
referenced context, but it does not merge those lists into a dependency graph
or derive an implementation order between packages. Task completion does not
change readiness or completion status.

The dependency lock records exact package digests, deterministic addition order,
all capability declarations, all provider candidates, revision comparisons, and
matched conflict or cycle records. It reproduces declaration analysis. It does
not download dependencies, select an installed provider, prove compatibility,
or dictate implementation order.
