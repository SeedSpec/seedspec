# Decision 0016: Bundle nested SeedSpecs with prose integration seams

- Status: accepted
- Date: 2026-07-28

## Context

A composed package previously depended on a user selecting one root and
separate additions. Resolution preserved the packages but did not preserve an
author-declared relationship between them. The implementing agent had to infer
how a feature or reusable component belonged in its parent.

Remote references would keep package bytes independent, but they would prevent
an adopter or implementing agent from inspecting the exact complete package the
author reviewed. Flattening child intent into the parent would remove the
child's identity and make recursive composition ambiguous.

Component packages also need a way to carry behavioral constraints without
requiring one implementation. An implementation profile can remain a shortcut
to known code while the component SeedSpec preserves the larger behavioral
contract.

## Decision

1. Add `component` as a core kind hint. It remains guidance, not a type system.
2. Add `composition.includes` for complete child SeedSpec packages bundled
   below a parent package root.
3. Every edge records a local relationship ID, child path, exact child package
   ID, version, digest, and one Markdown integration file.
4. The integration file must belong to the parent's declared
   `components.integration` material.
5. Integration Markdown has a semantic role but no required headings,
   vocabulary, or structured compatibility language.
6. Validation recursively verifies every child package and exact identity.
7. Resolution selects recursively bundled children as additions, deduplicates
   an identical package identity, and preserves every parent-to-child edge.
8. Conflicting versions or digests for one selected package ID are structural
   errors. Semantic compatibility remains an agent judgment.
9. The resolved project and implementing-agent guide identify every copied
   integration seam.
10. Reference authoring can suggest seam topics grounded in the declared
    parent-child relationship. Those topics remain optional prose prompts.
11. Component discovery and catalog policy belong to a separate SeedSpec
    Library product. The protocol carries packages already selected by an
    author or adopter.
12. Reference-only or partially materialized package delivery is deferred.

## Consequences

- A packed parent contains every child package byte the author intended.
- Composition can nest to arbitrary depth without flattening child intent.
- The parent digest covers the bundled tree. Each edge separately verifies its
  child identity.
- Updating a child requires updating its parent edge digest and republishing
  the affected parent version.
- Agents can choose a different realization from an implementation profile,
  but should not silently narrow the behavioral contract.
- Authors remain responsible for maintaining useful integration prose.
  SeedSpec does not invent compatibility levels or certify that the packages
  fit an actual environment.
