---
name: create-feature-package
description: Turn a feature idea into a validated SeedSpec feature package, either for an existing resolved SeedSpec project or as a standalone reusable capability. Use when defining a feature before implementation, adding durable product intent to a project, declaring required and provided capabilities, documenting integration behavior, or generalizing an application-specific feature for reuse.
---

# Create SeedSpec feature package

Define the feature's portable behavior before changing application code. Keep the origin application, portable package, and project-specific integration decisions distinct.

Accept starting material ranging from a one-sentence feature idea to an existing requirements document, prototype, implementation, or structured specification. Capture sparse material honestly before attempting to shape, harden, or generalize it. Do not invent host capabilities or integration guarantees merely to make the feature appear reusable.

## 1. Select the context

For an existing project, read these files when present:

- `.seedspec/project.yaml`;
- `.seedspec/resolved-spec.md`;
- `.seedspec/resolved-config.yaml`;
- `.seedspec/dependencies.lock.yaml`;
- existing feature integration records;
- the host application's SeedSpec package.

Reuse known actors, product terminology, permissions, configuration decisions, units, and capabilities. Do not ask questions already answered by project state.

For a standalone feature, identify the smallest host capabilities and authority concepts needed to express the feature without an originating application's private language.

## 2. Discover behavior

Define:

- intended outcome and affected actors;
- required host capabilities;
- new concepts and provided capabilities;
- workflows, permissions, state transitions, and invariants;
- configurable variations;
- integration points and atomicity expectations;
- failure, retry, concurrency, deletion, and historical behavior;
- observable acceptance criteria.

Ask only unresolved questions that materially affect behavior, authorization, data treatment, or portability. Put reversible representative values in example configuration, but do not describe the example as a buyer-selected default.

## 3. Set the portability boundary

Use `compatibility.scope` deliberately:

- `generic` when only abstract capabilities and authority concepts are required;
- `domain` when behavior depends on a stable domain;
- `application` when the feature cannot faithfully exist outside named applications.

Do not claim generic compatibility merely because names can be changed. Remove unnecessary screen, route, framework, publisher, and host-specific assumptions.

Compatibility scope records where the author intended or tested the feature. It
does not prove compatibility or incompatibility with a future implementation.

## 4. Declare capabilities and configuration

Require only capabilities whose behavior the feature uses. Provide only durable product behavior the feature adds. Use reverse-DNS capability IDs, an exact `tested_against` revision for each required capability, and one contract file per provided capability. Missing, multiple, cyclic, self-provided, or revision-different declarations are integration-review signals, not installation gates or observations of the actual host.

Turn variable product behavior into JSON Schema-backed configuration. Keep implementation preferences outside feature configuration. When a configured behavior needs a host operation not guaranteed by declared capabilities, document it as an explicit integration requirement or unresolved decision; never silently approximate it.

## 5. Create and validate the package

Run `seedspec init feature --output <package-path>` when available, then write:

- `seedspec.yaml` with feature kind, tested-against requirements, versioned provisions, compatibility, known conflicts, durable decisions, and components;
- a capability contract for every provided capability;
- `definition/feature.md` with portable product behavior;
- configuration schema and example;
- `integration/requirements.md` with host mappings, authorization, atomicity, and unresolved-decision rules;
- `acceptance/criteria.md` with observable host-independent behavior.

Preserve useful source specifications, designs, execution plans, infrastructure descriptions, and evidence as separately declared artifacts. Label their concerns and relationships without claiming they govern the future implementation agent. Do not require ProductSpec or any other native format simply to make a SeedSpec feature package appear rigorous.

At packaging time, optionally select independently versioned skills,
instructions, verification material, tools, or target profiles that materially
help implement this feature. Let the author choose usage and additional-guidance
policy. Associate resources with capabilities or targets only as discovery
context, not implementation-state evidence, and include a digest-verified
bundled failsafe when offline or version-unavailable operation matters.
Treat bundled skills as package-scoped guidance that agents explicitly consult;
do not assume frontmatter installs or automatically invokes them, and do not put
feature behavior or success criteria only in the skill.

Validate and inspect:

```bash
seedspec validate <package-path>
seedspec inspect <package-path>
seedspec artifacts <package-path>
seedspec resources <package-path>
```

When a host application is available, resolve them together in a temporary project:

```bash
seedspec resolve <root-package-path> --add <feature-path> --output <temporary-path>
```

Repair structural errors. Inspect declaration review records and confirm the
resolved specification preserves both packages' intent without presenting those
records as compatibility verdicts.

## 6. Generalize for reuse

When asked to generalize an existing feature:

1. Remove private project details and replace narrow actor names with roles.
2. Separate invariants from origin-specific choices.
3. Convert legitimate variations into configuration.
4. Minimize and document required capabilities.
5. Replace host screen and storage assumptions with integration outcomes.
6. Add acceptance criteria that can run against a clean host context.
7. Reassess compatibility scope honestly.
8. Validate and resolve again without relying on undocumented origin context.

Finish only when the package validates, its requirements are sufficient but minimal, and a future integrator can identify every host-specific decision that remains.
