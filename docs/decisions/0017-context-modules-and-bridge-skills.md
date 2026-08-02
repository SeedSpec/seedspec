# Decision 0017: Prepare semantic context through modules and bridge Skills

- Status: superseded by Decision 0018 for Protocol 0.3
- Date: 2026-07-31

## Context

SeedSpec preserves product intent, implementation guidance, capability
contracts, integration seams, target information, evaluation material, and
evidence. These objects have different semantic roles, but they share a common
agent-consumption problem: tools need to discover them cheaply, validate their
native format, disclose only relevant content, and preserve how they were used.

Agent Skills and Agent Behavior independently use a useful portable shape: one
semantically named Markdown entrypoint with YAML frontmatter, plus optional
references, scripts, assets, or other supporting files. Skill-aware harnesses
already understand progressive disclosure for `SKILL.md`. Other formats can use
the same directory pattern without being reclassified as Skills.

The existing protocol separates related artifacts from implementation
resources. That preserves important authority and activation boundaries, but it
does not provide one purpose- and audience-aware preparation contract across
their content.

## Decision

1. Add context modules as package-declared semantic inputs. A context module
   identifies one native format, one entrypoint, one source, descriptive
   metadata, and optional applicability hints.
2. Treat the module directory as a context bundle. One semantic entrypoint plus
   the supporting files reached from it forms the prepared module view.
3. Reference modules by package-local declaration ID. Resolution qualifies the
   ID with the package ID. Filesystem paths remain source and materialization
   locations, not relationship identity.
4. Permit a module source to be a package-local directory, a declared artifact,
   or a declared implementation resource. Existing acquisition and artifact
   boundaries remain available during migration.
5. Represent bridge Skills as independently declared context modules whose
   entrypoint is `SKILL.md`.
6. Connect a target module to a bridge Skill through a logical bridge binding
   that declares applicable purposes and optional audiences.
7. Use **task Skill** for a Skill that performs domain work and **bridge Skill**
   for a Skill that explains how to consume another module. These are usage
   roles, not separate Skill formats.
8. Let format packages supply default bridge Skills. Authoring tools may
   recommend them, but the published package records the exact bridges the
   author accepted, replaced, added, or removed.
9. Prefer a supported native adapter during context preparation. Use a selected
   bridge Skill as the portable fallback for a Skill-aware harness. Preserve a
   plain Markdown fallback for manual use.
10. Keep semantic formats independent. Initial examples include intent, Skill,
    Behavior, capability, integration, target, runbook, eval, policy, and
    evidence modules. New formats do not require a closed core enum.
11. Treat specialized intent documents as external formats. They can supply
    intent through native adapters and ship bridge Skills without becoming core
    SeedSpec module kinds.
12. Preserve progressive disclosure. Module descriptions are inventory
    metadata; entrypoint bodies load when relevant; supporting files load only
    when needed.
13. Loading one entrypoint does not implicitly load sibling entrypoints, hidden
    eval material, or every file in the module directory.
14. A bridge explains how to consume a module. It cannot override the module
    format, add semantic requirements absent from the module, grant authority,
    or authorize execution.
15. Ship compact navigation boundaries in the initial agent guidance, complete
    version-matched rules in the resolved guide, and format-specific procedure
    in bridge Skills. Enforce mechanical boundaries in tooling rather than
    relying only on prompts.
16. Add context preparation and preparation receipts as a subsequent protocol
    layer over the declaration and resolved-index substrate. Do not claim that
    declaration or materialization proves context was prepared, delivered,
    read, followed, or satisfied.

## Current protocol accommodation

The initial accommodation adds:

- `context_modules` package declarations;
- `context_bridges` logical bindings;
- validation of module sources, entrypoints, bridge references, and bridge
  `SKILL.md` frontmatter when local bytes are available;
- `context-modules.yaml` in resolved handoffs that contain modules;
- preservation of qualified identity, native format, applicability, source,
  materialization status, and bridge bindings; and
- compact context-navigation rules in the package beginning and resolved agent
  guide.

This slice does not yet define a normative `prepare-context` operation,
context-bundle schema, preparation receipt, or use receipt. Materialization is
not context preparation.

## Consequences

- SeedSpec gains one semantic context inventory without making every module a
  Skill.
- Skill-aware harnesses can consume unfamiliar formats through bridge Skills.
- Native harnesses can bypass bridges without changing authored module bytes.
- Default bridges remain authoring convenience rather than silent runtime
  policy.
- Module, adapter, bridge, and protocol versions remain independently visible.
- Existing artifacts and implementation resources remain usable during
  migration and as escape hatches for content that is not a context module.
- Tools must preserve audience isolation and must not treat prose instructions
  as a security boundary.
