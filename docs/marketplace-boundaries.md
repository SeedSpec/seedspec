# Marketplace Boundaries

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
