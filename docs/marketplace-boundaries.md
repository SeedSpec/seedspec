# Marketplace Boundaries

> **Informative guidance.** This document separates portable protocol behavior
> from registry and marketplace policy; it does not define a marketplace API.

The SeedSpec Protocol defines portable packages and artifact discovery
metadata. It does not define remote registry search, related-solution ranking,
package acquisition, payments, licensing, reviews, certification, or publisher
policy.

Publishers may bundle protocol packages into commercial products, catalogs, or collections. Their labels and packaging must not become protocol package kinds or schema requirements.

Likewise, Codex, Claude Code, Spec Kit, and other tools are execution or planning engines. They may consume the resolved specification through adapters, but none owns the canonical package format.

The reference CLI can search local catalog directories for SeedSpec feature
candidates and declaration-level review context. It does not certify
compatibility. A marketplace, registry, MCP server, or other catalog may expose
remote packages and recommendations, but it must return ordinary packages that
are independently validated. Catalog ranking and selection do not become
protocol semantics.

A registry may relate packages that share intent while differing by provider,
architecture, platform, workflow, or realization form. It may also index
features, implementation resources, tested environments, verification
evidence, known limitations, and derivation lineage. These relationships can
help an agent compare and compose accumulated solution knowledge, but registry
discovery remains context rather than activation, compatibility proof, or
authority to override an end user's selected direction.

A private enterprise library may designate one exact package version and digest
as approved for a recurring solution. That designation is organization policy,
not protocol conformance. The protocol makes the approved object identifiable
and independently validatable; the library supplies the authority, access
control, review criteria, and update policy. See [use cases](use-cases.md) for
internal, vendor, consultancy, ecosystem, and marketplace patterns.
