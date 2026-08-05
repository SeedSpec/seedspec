# Context modules and format bridges

> **Protocol guidance.** Normative requirements are in
> `docs/protocol.md`, `docs/operations.md`, and the versioned schemas.

## Purpose

A context module gives one semantic input a stable identity, native format,
entrypoint, source, and applicability. The same lifecycle supports primary
intent, Skills, Agent Behaviors, capabilities, integrations, targets, runbooks,
evaluations, policies, evidence, and future formats.

The entrypoint name is semantic. It helps people and harnesses recognize the
module without making the name a core protocol enum.

| Entrypoint | Typical meaning |
| --- | --- |
| `INTENT.md` | Desired outcome and rationale |
| `SKILL.md` | Instructions for performing a task |
| `BEHAVIOR.md` | Recurring agent conduct and evidence |
| `CAPABILITY.md` | Consumer-visible guarantees |
| `INTEGRATION.md` | How independently defined things meet |
| `TARGET.md` | Relevant environment context |
| `RUNBOOK.md` | Bounded operational procedure |
| `EVAL.md` | Assessment method |
| `POLICY.md` | Permitted, required, or forbidden behavior |
| `EVIDENCE.md` | Observations for a scoped claim |

Formats remain namespaced. SeedSpec does not define inheritance or composition
between them. A format integration can supply deeper validation and preparation.

## Directory shape

Markdown-oriented formats commonly use this shape:

```text
refund-safety/
├── BEHAVIOR.md
├── references/
├── scripts/
├── assets/
└── ...
```

The directory is the module root. The entrypoint is first-order context.
Supporting files are disclosed only when the entrypoint, adapter, bridge, or
request makes them relevant.

## Package declaration

Every package declares `context.modules`. `definition.module` identifies one
module as primary intent.

```yaml
definition:
  module: primary-intent

context:
  modules:
    - id: primary-intent
      format: org.seedspec.intent.markdown
      description: The outcome this package asks an agent to realize.
      entrypoint: INTENT.md
      source:
        kind: package
        path: intent/INTENT.md

    - id: refund-safety
      format: dev.agentbehavior.behavior
      format_version: 1.0.0
      description: Expected refund-agent conduct during review.
      entrypoint: BEHAVIOR.md
      source:
        kind: package
        path: context/refund-safety/
      applies_to:
        purposes: [review, evaluate]
        audiences: [reviewer, evaluator]
```

Sources are explicit:

```yaml
source: {kind: package, path: context/refund-safety/}
source: {kind: artifact, id: trace-evidence}
source: {kind: resource, id: org.example.guidance.refund-review}
```

The local module ID is relationship identity. Resolution qualifies it as
`package-id/module-id`. A file-system path only locates source or materialized
bytes.

## Bridge Skills

A bridge Skill teaches a Skill-aware harness how to consume another module.
It is a separate module with a `SKILL.md` entrypoint. The target module owns the
binding.

```yaml
context:
  modules:
    - id: refund-safety
      format: dev.agentbehavior.behavior
      description: Expected refund-agent conduct during review.
      entrypoint: BEHAVIOR.md
      source: {kind: package, path: context/refund-safety/}
      bridges:
        - skill: review-behavior
          applies_to:
            purposes: [review, evaluate]
            audiences: [reviewer, evaluator]
          description: Use when no native Agent Behavior adapter is available.

    - id: review-behavior
      format: io.agentskills.skill
      description: Instructions for reviewing an Agent Behavior module.
      entrypoint: SKILL.md
      source: {kind: package, path: context/review-behavior/}
```

A task Skill performs domain work. A bridge Skill explains another module.
One Skill can serve both roles, but separate modules usually narrow discovery.

A bridge cannot redefine the target format. It cannot add requirements, grant
authority, or authorize scripts and tools.

## Import task Skills

A standalone task Skill can publish optional CLI import configuration in its
root `seedspec.yaml`:

```yaml
skill:
  entrypoint: SKILL.md
  include:
    - LICENSE
    - SKILL.md
    - agents/
    - references/
  defaults:
    applies_to:
      purposes: [implement]
      audiences: [implementing-agent]
```

Run a dry import plan:

```text
seedspec context add <package> --skill <path-or-github-url>
```

Add `--write` to copy the declared files and write the context-module
declaration. Repeated `--purpose` and `--audience` options override the matching
repository defaults. If the source has no configuration, the CLI infers
`SKILL.md` and existing standard Skill directories. It leaves applicability
unrestricted.

The consuming package records the resolved declaration. Later context
preparation does not consult the Skill repository.

## Applicability

Modules and bindings can constrain four dimensions:

- purpose;
- audience;
- capability; and
- target.

A missing dimension is unrestricted. Values use OR within one dimension.
Dimensions use AND with each other.

The context request can explicitly include or exclude supporting modules.
Explicit exclusion wins. Explicit inclusion overrides ordinary applicability.
Primary intent is always included.

## Format integrations

A separately versioned integration can publish:

- exact native format claims;
- an optional adapter;
- zero or more bridge Skills; and
- authoring defaults.

Its `seedspec-integration.json` binds adapter and bridge bytes by digest.
Discovery reads this metadata and verifies assets. It does not import adapter
code.

The authoring workflow proposes compatible default bridges. A dry run shows the
new Skill modules, package paths, and bindings. The author can retain an
existing bridge, accept a default, or select a different Skill ID. Applying the
plan copies verified bytes and updates the manifest atomically.

Integration packages can live in separate repositories. The authoring stage is
the integration point. Published SeedSpec packages contain the selected bridge
bytes and bindings, so resolution does not need the integration repository.

## Context preparation

Resolution writes `context-index.yaml` and materializes available bytes under
`.seedspec/context/`. It does not prepare request-specific context.

Preparation reads a `context-request.schema.json` document. It performs these
steps:

1. Verify the resolution receipt, protocol-owned handoff, source index, and
   module digests.
2. Select applicable modules.
3. Apply explicit includes, exclusions, and adapter selections.
4. Prefer one eligible native adapter.
5. Otherwise use all applicable bound bridge Skills.
6. Otherwise preserve plain Markdown.
7. Copy only selected source files and bridge assets.
8. Write the separate context bundle and preparation receipt atomically.

The bundle records every selected and excluded module. It also records exact
files, digests, validation status, and mechanism choice.

The use operation rechecks every prepared output, selected source file, and
bridge directory. Its receipt covers every prepared module and reports `consulted`,
`partially-consulted`, or `skipped`. This is consumer telemetry, not proof of
obedience, conformance, or outcome success.

## Harness navigation

A harness can recognize `SKILL.md` directly. The packaged bridge can teach it
how to use `BEHAVIOR.md`, `POLICY.md`, or another format. A future harness can
ingest those native formats directly and use the same module declarations.

SeedSpec also supplies initial handoff instructions. They explain the core
boundaries: primary intent first, request-specific context preparation,
progressive disclosure, explicit adapter loading, and no authority from
discovery alone.

## Assurance boundaries

- Validation establishes package structure and references.
- Resolution establishes materialized bytes and identities.
- Native validation establishes format-specific conformance.
- Preparation establishes request-specific selection and transformation.
- A use receipt states what a consumer reports consulting.
- Evidence and verification establish only their bound claims.

No layer proves another.
