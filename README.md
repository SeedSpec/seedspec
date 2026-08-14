# SeedSpec

SeedSpec is an experimental package format for portable, agent-readable
product specifications and supporting materials that help guide
implementations.

Every package starts with `SPEC.md`. Its Markdown body carries authored intent.
Optional YAML frontmatter exposes selected semantics to tools. An optional root
`seedspec.yaml` can supply a base manifest; frontmatter has final authority.

Context modules are supporting Markdown that travels with the package: skills,
evaluations, policies, implementation profiles, and other readable context.

A package may nest other SeedSpec packages. Each child keeps its own identity,
version, and digest.

Context modules are not a second spec. Nested packages may be optional in the
parent; selecting them is project state and does not change the parent digest.

Validation establishes structure and content identity. It does not prove that
the specification is complete or that an implementation satisfies it.

## Documentation

Normative:

- [Language](docs/01-language.md)
- [Protocol](docs/protocol.md)
- [Operations](docs/operations.md)
- [Conformance suite](packages/protocol/conformance/cases.yaml)
- [`seedspec.schema.json`](packages/protocol/schemas/v0.4/seedspec.schema.json)

Informative. These explain what may enter a package. They add no
requirements beyond the protocol.

- [Architecture](docs/architecture.md)
- [Principles](docs/principles.md)
- [Glossary](docs/glossary.md)
- [Why structure](docs/semantic-structure.md)
- [Use cases](docs/use-cases.md)
- [Evaluations](docs/evaluations.md)
- [Security](docs/security.md)
- [Versioning](docs/versioning.md)
- [Composition](docs/composition.md)
- [Capabilities](docs/capabilities.md)
- [Implementation profiles](docs/implementation-profiles.md)
- [Context modules](docs/context-modules.md)

## Commands

```bash
npx seedspec init ./package
npx seedspec validate ./package
npx seedspec digest ./package
npx seedspec inspect ./package --json
npx seedspec flatten ./package --output ./flattened/SPEC.md
npx seedspec check ./package
npx seedspec preview ./package
npx seedspec project ./package
npx seedspec lock ./package
npx seedspec skill
npx seedspec conformance
```

`validate`, `digest`, `inspect`, and `flatten` are protocol operations. The
rest is first-party tooling around that contract. Repository checks are in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Protocol families

A family is an independent contract. SeedSpec does not assume backwards
compatibility with a previous family. There is no compatibility parser or
automatic migration. Reauthor a package against the family you are using.

Optional `target_protocol` names the intended family. The installed runtime
supplies the exact schema. While the protocol is experimental, a patch
release can change accepted structure. Revalidate after every runtime update.
