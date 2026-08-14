# Principles

> Informative. These guide what may enter the package and what package
> bytes may claim. They are not extra conformance tests.

A SeedSpec names the destination. It does not name the route.

## Destination, not route

The package carries outcomes, invariants, authority, configuration, and
how success would be observed. Skills may help an agent navigate.
Connectors may bound what it can touch. Neither is the spec.

A feature spec names required host concepts. It does not import the host's
ontology, screens, or stack.

## Minimum sufficient intent

The smallest portable meaning that preserves what is consequential and
leaves legitimate implementation choices open. More text is not more
authority. Restating what a capable model already knows makes the spec
worse.

Absence is not a gap. Silence is not a reviewed delegation.

## Three claims that do not imply each other

Validity, quality, and verification answer different questions. A digest
identifies bytes. It does not prove the spec is good or that anyone built
it. A receipt records that this digest was checked. It is not a reference
implementation.

## Honesty

- Content is passive. Presence is not execution.
- Authority is explicit. The package does not grant credentials, network,
  spending, or mutation rights.
- Declarations are not observations. The package does not know current
  code.
- An example is not a selection.
- Ready is not complete, and complete is not verified.
- Model inference is not accepted intent.

## Author and adopter

Author meaning is package bytes. Adopter choices — configuration, optional
children, profile — are project state. They must not change the digest.

## One protocol, varied realizations

The same package format can describe a new application, a feature in an
existing product, configured state in another system, or an automation.
Do not split the protocol by realization form.

## Handoff, not control

The protocol is a handoff. It does not keep the realized system
synchronized with the package forever.

## What may enter the protocol

Ask:

1. Is this portable meaning independent implementations must share?
2. Or is it one artifact format, one authoring UI, one harness, or one
   catalog?

If (2), it does not belong in the package. A product adapter is the
default. A new field requires a demonstrated interoperability failure.
