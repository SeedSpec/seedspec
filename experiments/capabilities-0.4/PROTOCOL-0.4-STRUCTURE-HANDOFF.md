# SeedSpec Protocol 0.4 structure handoff

## Status

The structural decisions in this handoff are implemented in the 0.4 schema,
runtime, CLI, documentation, and conformance fixtures. The protocol remains
experimental.

Normative details are in:

- `packages/protocol/schemas/v0.4/seedspec.schema.json`;
- `docs/01-language.md`;
- `docs/protocol.md`;
- `docs/operations.md`; and
- `docs/decisions/0023-protocol-0.4-package-reset.md`.

## Package core

The minimum package is:

```text
SPEC.md
```

Minimum frontmatter is:

```yaml
id: daily-report
name: Daily report
version: "1.0.0"
```

`kind`, `target_protocol`, `description`, and `metadata` are optional. Package IDs can
use lowercase letters, numbers, hyphens, and periods. Namespacing is permitted
but does not establish authority.

Root `seedspec.yaml` is an optional automatically discovered base manifest.
`SPEC.md` frontmatter overrides it. Mappings merge recursively. Arrays and
scalars replace. The resolved manifest validates as one package declaration.

## Structured package surface

Protocol 0.4 supports:

- configuration variables;
- success criteria;
- capabilities;
- ordered tasks;
- context modules;
- bundled packages; and
- namespaced extensions.

Configuration, success, capabilities, and tasks use inline collections or
one-level external YAML sections.

The protocol does not define root compatibility, decisions, conflicts,
integration points, or implementation profiles. The first four remain prose.
Implementation profiles are context modules.

## Capabilities and verification

Capabilities are package-local observable functions. They can identify stable
outcomes and reference local success criteria. They do not use `provides`,
`requires`, or independent versions.

Success criteria are structured acceptance claims. The specification can anchor
supporting prose with:

```text
[success:<criterion-id>]
```

Evaluation context modules can target criteria through
`applies_to.success_criteria`. Verification evidence remains separate from the
authored package.

## Context modules

Each context module declares:

- `id`;
- `type`;
- `description`; and
- a direct Markdown entrypoint `path`.

Optional `format` metadata provides a dispatch identifier, version, bundled
documentation, and external documentation URL. Tools never fetch format URLs
automatically.

Optional applicability dimensions are lifecycle stages, local capabilities,
and local success criteria.

Implementation profiles use:

```yaml
type: implementation-profile
path: context-modules/<profile>/PROFILE.md
```

Profile Markdown has no required frontmatter, headings, or section names.

## Bundled packages

Each bundled child records `id`, `version`, `digest`, and `path`. `optional:
true` makes the child available for selection without including it
automatically in the intended realization.

Every child validates independently and retains its own package provenance.

## Execution principles

- Preserve authored meaning while allowing presentation freedom.
- Use one semantic source of truth for each material concept.
- Preserve meaningful states and operation intent.
- Stop only for consequential ambiguity.
- Require independent evidence for verification claims.
- Do not expand the intended capability surface.
- Use the smallest reversible choice for unspecified details.

## Remaining experiment work

The next experiment should test whether the implemented structure improves:

- capability extraction and author acceptance;
- prose-to-criterion traceability through success anchors;
- implementation coverage of capabilities and criteria;
- context selection during implementation and verification;
- profile selection and progressive reading of `PROFILE.md`; and
- independent evidence collection against criterion IDs.

Do not use the daily-pipeline hidden date-format failures as proof that
self-attestation missed declared requirements. The hidden evaluator required a
literal ISO representation that the capability did not declare. That result is
an evaluator-to-capability mismatch.
