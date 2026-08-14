# Contributing to SeedSpec

This repository is the SeedSpec protocol, schemas, conformance suite,
first-party runtime and CLI, and documentation. Demonstration packages belong
in `SeedSpec/reference-solutions` unless they are fixtures for a protocol or
check rule.

## Classify the change

- Normative: `docs/01-language.md`, `docs/protocol.md`, `docs/operations.md`,
  versioned schemas, and the conformance suite.
- Informative: architecture, principles, glossary, and topic guides.
- Outside the contract: commercial distribution and product strategy.

Editorial changes clarify the contract. Semantic changes alter what an
implementation accepts, produces, preserves, rejects, or reports. Update
normative prose, schemas, conformance, runtime behavior, tests, and version
metadata together.

## Verify

```bash
npm run check
git diff --check
```

`npm run check` includes conformance. When a public command, schema URL, or
package boundary changes, also test it as an external consumer.

## Maintainer skills

- `$audit-seedspec-surface` — leftover trees, stale commands, and drifted
  README / CONTRIBUTING / RELEASING / docs.
- `$harden-seedspec-protocol` — editorial language and claim boundaries.
- `$prepare-seedspec-release` — exact version alignment, generate, verify,
  publish.
