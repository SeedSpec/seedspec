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
artifacts:
  - id: product-spec
    type: org.seedspec.artifact.product-spec
    path: intent/product.product-spec.md
    media_type: text/markdown
    format_version: "0.1"
    conforms_to: https://github.com/gokulrajaram/ProductSpec/blob/d286a8e9a7a83e0be15a0d9c360c549590134440/SPEC.md
    concerns:
      - org.seedspec.concern.intent
```

`org.seedspec.adapter.product-spec` uses the official `@productspec/parser` package to validate the Markdown and compare its `spec_format_version` with the manifest metadata. ProductSpec remains optional: packages without it and users who decline its workflow lose no SeedSpec capability.

ProductSpec's intent/reality/drift model is useful when a team chooses to maintain a rigorous product specification alongside an evolving application. SeedSpec does not infer that choice from presence. A discovered ProductSpec is neither automatically the complete current state of the application nor a command to revert later code changes. An implementing agent should explain the available workflow and ask its end user whether to use it.

Deployment mechanics such as building and running on Vercel normally belong to a separate infrastructure or deployment artifact, technical preferences, or implementation plan. They are not implied by a ProductSpec intent document or by this adapter. A ProductSpec may mention a hosting constraint when that constraint materially affects the product, but the adapter does not turn it into a deployment system.

The adapter currently exposes inspection and validation only. It does not automatically begin a ProductSpec session, enforce drift policy, update the ProductSpec after implementation, or load ProductSpec-provided agent tooling.

## Adding adapters

An adapter should:

1. claim one namespaced artifact type and one namespaced adapter ID;
2. point to the native format documentation and pin compatible versions;
3. expose its capabilities without running them during discovery;
4. use the format's official parser or clearly document any divergence;
5. report native conformance separately from SeedSpec package conformance;
6. require explicit invocation for parsing, validation, transformation, generation, or workflow activation;
7. avoid redefining core manifest fields or implying authority over an implementing agent.
