# Artifact adapters

> **Informative guidance.** This document explains optional adapter behavior;
> it does not add requirements to the SeedSpec Protocol.

SeedSpec can officially integrate with an external artifact format without making that format part of the protocol. The package manifest identifies and locates the artifact; a separately versioned adapter provides format-specific inspection, validation, or transformation.

This split is intentional:

- core validation answers whether the SeedSpec package is structurally valid and its local references are present;
- adapter validation answers whether one declared artifact conforms to its native format;
- an implementation workflow remains a choice made with the end user.

Use `seedspec artifacts <package>` to discover artifacts and `seedspec adapters` to inspect registered integrations. Running `seedspec validate-artifact <package> <artifact-id>` is an explicit adapter invocation.

## ProductSpec

The official adapter recognizes:

```yaml
definition:
  entrypoint: intent/product.product-spec.md
  artifact: product-spec

artifacts:
  - id: product-spec
    type: org.seedspec.artifact.product-spec
    path: intent/product.product-spec.md
    media_type: text/markdown
    format_version: "0.1"
    conforms_to: https://github.com/gokulrajaram/ProductSpec/blob/97b90b6288bbcd159bbec0f75fac9bf8212d2dc8/SPEC.md
    concerns:
      - org.seedspec.concern.intent
```

`org.seedspec.adapter.product-spec` uses the official `@productspec/parser`
package to validate the Markdown and compare its `spec_format_version` with the
manifest metadata. ProductSpec remains optional: native SeedSpec intent remains
valid without it.

The same ProductSpec may occupy either of two roles:

- When its artifact ID is named by `definition.artifact` and its path matches
  `definition.entrypoint`, it is the package author's primary intent source.
  Resolution reads and preserves its content as core intent and labels its
  artifact `intent_role: primary`.
- When it is declared only under `artifacts`, it is supporting intent material
  whose use remains subject to an explicit artifact disposition.

Format does not establish provenance. A ProductSpec in a published package is
package-author intent because of its package role. A future project-local
ProductSpec derived and affirmed by an end user would be applied intent. Agent-
generated ProductSpec content remains a proposal until affirmed.

ProductSpec's product summary, scope, acceptance criteria, AI evals, success
metrics, evidence links, Agent Run receipts, and Decision Traces provide a
deeper product-intent lifecycle than SeedSpec's minimal native vocabulary. A
primary ProductSpec supplies that depth without making ProductSpec a dependency
of the SeedSpec Protocol.

Reading a primary ProductSpec as intent does not automatically begin a
ProductSpec session, load its skills or MCP server, create an Agent Run, enforce
drift policy, or revise the document. A discovered ProductSpec is neither the
complete current state of the application nor a command to revert later code
changes. The implementing agent should explain any native ProductSpec workflow
it proposes and obtain end-user direction before activation.

Deployment mechanics such as building and running on Vercel normally belong to a separate infrastructure or deployment artifact, technical preferences, or implementation plan. They are not implied by a ProductSpec intent document or by this adapter. A ProductSpec may mention a hosting constraint when that constraint materially affects the product, but the adapter does not turn it into a deployment system.

The adapter currently exposes inspection and validation only. Future tooling
may help an end user derive a project-local ProductSpec from the author's source
or convert one into native applied intent. Any conversion must preserve the
source, revision, provenance, and a report of lost or changed semantics; it must
not mutate the published package.

## Adding adapters

An adapter should:

1. claim one namespaced artifact type and one namespaced adapter ID;
2. point to the native format documentation and pin compatible versions;
3. expose its capabilities without running them during discovery;
4. use the format's official parser or clearly document any divergence;
5. report native conformance separately from SeedSpec package conformance;
6. require explicit invocation for parsing, validation, transformation, generation, or workflow activation;
7. avoid redefining core manifest fields or implying authority over an implementing agent.
