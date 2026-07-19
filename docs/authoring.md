# SeedSpec Authoring

Authoring is a guided product-discovery workflow, not a requirement to hand-edit manifests. The repository includes two reusable Codex skills under `skills/`.

## Starting altitude

SeedSpec authoring may begin from a sentence, an existing product document, a structured specification, a prototype, an architecture, or a working application.

Preserve the supplied source and add only the structure justified by what is known. A sparse idea is not invalid merely because actors, capabilities, configuration, or acceptance criteria have not yet been fully developed. Do not manufacture details to make a package appear mature.

Authoring can proceed progressively:

1. **Capture** preserves the source idea in a minimal conforming package.
2. **Shape** identifies actors, outcomes, workflows, domain concepts, and meaningful variations.
3. **Harden** adds permissions, invariants, failure behavior, edge cases, and observable acceptance criteria.
4. **Compose** identifies capability context, SeedSpec feature candidates, and related artifacts.

The user may stop at any stage. Authoring depth is a workflow choice, not a different protocol format or a package-quality claim.

## Related artifacts

Authors may include existing product documents, structured specifications, designs, execution plans, infrastructure descriptions, or evidence as optional `artifacts`. Preserve each artifact's native format and label the concern it addresses; do not merge separate concerns merely to make the SeedSpec look more complete.

Declaring an artifact does not select its workflow for a future user or implementation agent. An author may explain why the artifact is useful, but should not encode `governing`, `advisory`, or automatic activation policy. Artifact-specific validation and transformation belong to adapters that a user invokes explicitly.

## Application workflow

Start at the level of detail the user supplies. For shaping or hardening, identify the intended outcome, actors, roles, domain concepts, fundamental workflows, permissions, business rules, state transitions, failure behavior, meaningful configuration candidates, and acceptance criteria. Ask only questions whose answers materially change behavior; use reversible values in the package example for the rest without implying that every buyer selected them.

For capture-only work, preserve the original idea, use an empty configuration object when no behavioral choices are known, allow an empty capability list, and record important unknowns without forcing the user through full product discovery.

Give each provided capability a namespaced ID, exact revision, and product-behavior contract. For each required capability, record the exact revision the consumer was designed or tested against. Create the package, then run:

```bash
seedspec validate <package-path>
seedspec inspect <package-path>
```

## Feature workflow

When a resolved project exists, inspect `.seedspec/project.yaml`, `resolved-spec.md`, `agent-guide.md`, `implementation-notes.md`, and `dependencies.lock.yaml` before asking questions. Reuse known actors, terminology, configuration decisions, and capabilities. Declare only the capabilities the feature truly uses and the capabilities it adds.

Keep origin context, the portable feature, and project integration decisions distinct. Before sharing a feature broadly, remove application-private assumptions, replace narrow terminology, convert variable behavior into configuration, declare known conflicts and unresolved decisions, and select an explicit compatibility scope.

Capability, compatibility, and conflict declarations describe author intent and
testing evidence. Do not claim they prove that a future application implements a
capability or that a feature is compatible. The implementing agent makes that
determination from the actual project.
