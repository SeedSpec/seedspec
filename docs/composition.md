# Package composition

> **Informative guidance.** The normative composition algorithm and resolved
> state requirements are defined in `docs/protocol.md` and the conformance suite.

The normative algorithm is `declaration-review-v1` in `docs/protocol.md`.
Resolution begins with one root package and an unordered user selection of
additions. Manifest kind hints do not constrain either position.

```text
validated package bytes
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
resolved agent handoff
          |
          v
agent inspects actual realization and decides integration
```

Resolution fails for structural problems: invalid packages or references, unsafe
content, duplicate IDs within a manifest, and selecting the
same package ID twice.

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

Root, addition, applied-intent, decision, implementation-profile, artifact, and
technical-configuration state stay in separate namespaces. Every explicit
package configuration is complete; resolution never fills a custom selection
from an example. Missing applied-intent affirmation, configuration selection,
required decision answers, or an ambiguous implementation-profile preference
produce a valid project
with `status: needs-input`; they do not disappear into implementation
assumptions.

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

The dependency lock records exact package digests, deterministic addition order,
all capability declarations, all provider candidates, revision comparisons, and
matched conflict or cycle records. It reproduces declaration analysis. It does
not download dependencies, select an installed provider, prove compatibility,
or dictate implementation order.
