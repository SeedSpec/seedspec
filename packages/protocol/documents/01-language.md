# SeedSpec language 0.4

SeedSpec packages combine authored specification prose with optional structured
declarations. The prose preserves intent for any capable reader. The structure
supports deterministic validation, composition, preparation, and inspection.

## Authority

`SPEC.md` is the package entrypoint and primary authored specification. Its
Markdown body is authoritative prose. Its YAML frontmatter has final manifest
authority.

Root `seedspec.yaml` is an optional base manifest. It does not compete with
`SPEC.md`. Frontmatter values override it through the merge rules in the
protocol specification.

README files, format documentation, context modules, generated views, and
receipts do not become manifest authority.

## Provenance

Package meaning is interpreted with:

- package ID;
- package version;
- package digest; and
- source location.

The digest protects authored bytes. A normalized manifest does not replace the
sources that produced it.

Bundled packages keep independent identity and provenance. A parent records a
child coordinate. It does not absorb the child's declarations.

## Structured roles

- Configuration declares selectable inputs.
- Success criteria declare acceptance claims.
- Success anchors connect claims to supporting specification prose.
- Capabilities identify observable package functionality.
- Tasks provide ordered implementation guidance.
- Context modules provide addressable supporting material.
- Implementation profiles are selectable context modules.
- Formats describe optional deeper interpretation of context.
- Extensions isolate experimental data from protocol-owned fields.

Structured declarations improve tooling. Their absence does not remove the
meaning of ordinary specification prose.

## Processing

A conforming tool:

1. Locates root `SPEC.md`.
2. Reads optional root `seedspec.yaml`.
3. Parses `SPEC.md` frontmatter.
4. Merges frontmatter over the base manifest.
5. Validates the authored manifest.
6. Expands declared sections in order.
7. Validates the normalized manifest and its references.
8. Validates bundled children independently.
9. Computes package digests from authored bytes.
10. Reports resolved values and provenance.

Tools must not fetch format URLs or execute package content during this
process.

## Claim boundaries

Validation proves structural conformance to one exact runtime release. It does
not prove:

- that the prose is complete;
- that the author controls a namespace;
- that a capability is useful;
- that an implementation satisfies the package;
- that evidence is trustworthy; or
- that remote documentation is safe.

Verification requires evidence independent of the claim being verified.

## Grounding

Ground material behavior in accepted package meaning, selected configuration,
an author decision, or documented implementation necessity. Do not expand the
intended capability surface. Use the smallest reversible choice for unspecified
details. Escalate consequential ambiguity.

## Release model

Protocol 0.4 is an experimental lineage. Optional `target_protocol: "0.4"`
identifies the intended family. The installed 0.4.x runtime supplies the exact
schema when the field is absent.

Patch releases can change accepted structure during the alpha. Revalidate on
every runtime update. Protocol 0.4 does not parse Protocol 0.3 packages.
