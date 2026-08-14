# SeedSpec architecture

> Informative. The normative contract is the language, protocol,
> operations, schemas, and conformance suite.

SeedSpec is a portable package format for product intent.
A package is a folder whose entrypoint is `SPEC.md`. Optional YAML
exposes selected semantics to tools. The protocol does not name a
programming language, cloud, or authoring product.

## What the protocol is

A SeedSpec names the destination. It does not name the route.

The package carries outcomes, invariants, authority, configuration, and
how success would be observed. Skills may help an agent navigate.
Neither is the spec.

Validity, quality, and verification are separate claims. A digest
identifies authored bytes. It does not prove the spec is complete or
that anyone built it.

## Layers

1. **Protocol** — folder + `SPEC.md`, optional YAML, and offline
   validate, digest, inspect, and flatten.
2. **Reference tooling** — first-party CLI around that contract (`init`,
   `check`, `project`, `skill`, lock/get). Not a studio. Not an
   implementer that “won’t stop until done.”
3. **Realization** — an implementing agent, under the adopter, inspects
   actual code and environment. Adopter selections live in project
   state. They must not change the package digest.

## Package roles

| Role | Question |
| --- | --- |
| Prose in `SPEC.md` | What is the destination? |
| Configuration | What may this adopter choose? |
| Success criteria | What claims would show the destination was reached? |
| Capabilities | What observable behavior does this package name? |
| Tasks | What ordered reminders did the author want an agent to see? |
| Context modules | What supporting material travels with the package? |
| Bundled children | Which exact other packages are part of this one? |

Authoring notes, adopter selections, and verification results are not
package roles.

See [principles](principles.md), [glossary](glossary.md),
and [use cases](use-cases.md).
