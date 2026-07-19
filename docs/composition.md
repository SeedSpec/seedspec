# Package composition

The normative algorithm is `declaration-review-v1` in `docs/protocol.md`.
Resolution begins with one application and an unordered user selection of
features.

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
resolved agent handoff
          |
          v
agent inspects actual application and decides integration
```

Resolution fails for structural problems: invalid packages or references, unsafe
content, wrong input kinds, duplicate IDs within a manifest, and selecting the
same package ID twice.

Resolution does not fail merely because:

- no selected package declares a required capability;
- multiple packages declare the same capability;
- a package author declares a conflict;
- declared requirements form a cycle;
- a provider revision differs from `tested_against`; or
- compatibility scope does not name the application.

Those conditions become review context. The implementation agent may discover
that the real application already implements an equivalent capability under
different terminology, that a feature should supply missing behavior, that two
declarations can be mapped together, or that an author concern genuinely blocks
the user's desired outcome. SeedSpec cannot know which answer is correct without
the actual implementation.

Application, feature, decision, artifact, and technical configuration stay in
separate namespaces. Every explicit application or feature configuration is
complete; resolution never fills a custom selection from an example. Missing
configuration selection or required decision answers produce a valid project
with `status: needs-input`; they do not disappear into implementation
assumptions.

The dependency lock records exact package digests, deterministic feature order,
all capability declarations, all provider candidates, revision comparisons, and
matched conflict or cycle records. It reproduces declaration analysis. It does
not download dependencies, select an installed provider, prove compatibility,
or dictate implementation order.
