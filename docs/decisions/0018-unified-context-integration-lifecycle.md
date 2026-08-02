# Decision 0018: Unify intent and semantic formats through context modules

- Status: accepted for Protocol 0.3
- Date: 2026-08-01
- Supersedes: the package and handoff accommodation in Decisions 0010 and 0017

## Context

Protocol 0.2 represented primary intent, related artifacts, implementation
resources, and context modules through overlapping paths. Context modules and
bridge Skills established the right semantic direction, but primary intent
still used separate definition and artifact rules. The protocol also stopped
at materialization. Adapter registration, integration discovery, request-
specific preparation, and receipts remained implied.

Skills and Agent Behavior show a reusable shape: one semantic Markdown
entrypoint with YAML frontmatter and optional references, scripts, assets, or
other supporting files. Intent, capability, integration, target, runbook,
evaluation, policy, and evidence formats can use the same packaging pattern
without becoming one general type system.

SeedSpec is not yet used by external adopters. Compatibility with the 0.2
manifest shape would preserve overlapping concepts and make later tooling more
complex.

## Decision

1. Make a clean Protocol 0.3 cut. Do not automatically migrate retired package
   shapes.
2. Require `context.modules` in every package. Make `definition.module` point
   to the primary intent module.
3. Remove `definition.entrypoint`, `definition.artifact`, top-level
   `context_modules`, and top-level `context_bridges` from the 0.3 contract.
4. Keep artifacts passive. An artifact participates in context preparation
   only when a module names it through `{kind: artifact, id: ...}`.
5. Use explicit module-source discriminators: `package`, `artifact`, or
   `resource`.
6. Nest bridge bindings on the target module. Bridge Skills remain independent
   modules and use qualified module identity after resolution.
7. Write `context-index.yaml` for every resolved project. Record exact module
   content digests and whether each digest covers the entrypoint or module root.
8. Define request, prepared-bundle, preparation-receipt, and reported-use
   schemas. Treat context preparation as a protocol lifecycle step distinct
   from resolution and implementation.
9. Use deterministic applicability: missing dimensions are unrestricted, OR
   within a dimension, and AND across dimensions. Primary intent is always
   selected. Explicit exclusion wins for supporting modules. Explicit
   inclusion overrides ordinary applicability.
10. Select one mechanism per target module: one eligible native adapter, all
    applicable bridge Skills, or plain Markdown.
11. Make adapter registries instance-scoped. Reject duplicate IDs and ambiguous
    matches. Require an explicit adapter selection to resolve ambiguity.
12. Describe external integrations with `seedspec-integration.json`. Bind
    adapter files and bridge directories by digest.
13. Keep discovery inert. A host must explicitly load trusted adapter code
    after verifying its digest, identity, API version, capabilities, and format
    coverage.
14. Let integration packages publish default bridges. Authoring discovery is
    dry-run first. It preserves author-selected bridges and mutates a package
    only through an explicit apply action.
15. Treat an integration repository as authoring input. A published SeedSpec
    package contains selected bridge bytes and bindings, so ordinary resolution
    does not depend on the integration repository.
16. Keep authority boundaries unchanged. Discovery, validation, resolution,
    preparation, and use receipts do not authorize scripts, tools, credentials,
    network access, or external effects.

## Consequences

- Primary intent uses the same identity, validation, resolution, preparation,
  and receipt lifecycle as every other semantic format.
- Harnesses can consume native formats directly or use bridge Skills without a
  package rewrite.
- Format-specific schema strength lives in independently versioned adapters.
  New formats do not require a core kind enum or schema inheritance.
- Protocol releases version the module envelope and lifecycle. Integration and
  native format versions evolve independently.
- Context preparation becomes observable and digest-bound. Reported use remains
  telemetry rather than proof.
- Protocol 0.2 packages must be re-authored for 0.3. The runtime returns a
  clean-cut migration diagnostic instead of rewriting ambiguous fields.
- The first-party release can ship no external-format adapter. Conformance uses
  a generic fixture integration to test the seam.
