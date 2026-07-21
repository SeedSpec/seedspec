# SeedSpec changelog

This changelog records public protocol-bundle and first-party tooling changes.
The protocol family, schema package, conformance suite, runtime, and CLI are
versioned independently; see [versioning](docs/versioning.md).

## Pending design-alpha publication

| Surface | Version |
| --- | --- |
| Protocol family | `0.1` |
| `@seedspec/protocol` | `0.1.0-alpha.2` |
| Conformance suite | `1.9.0` |
| `@seedspec/runtime` | `0.1.0-alpha.3` |
| `@seedspec/cli` | `0.1.0-alpha.4` |

### Protocol and conformance

- Define the normative release bundle as the protocol specification, versioned
  JSON Schemas, and self-contained conformance contract.
- Clarify the package, core-intent, implementation-profile,
  implementation-resource, and package-scoped-skill boundaries.
- Require conformance fixture paths to remain inside the suite directory.
- Add a conformance fixture for unmet capability declarations without relying
  on reference-runtime test data.

### Reference tooling

- Add `seedspec version [--json]` with protocol, schema-package,
  conformance-suite, runtime, and CLI version output.
- Report the conformance-suite version in human-readable results.
- Rename the package-to-agent prompt formatter to
  `formatPackageAgentPrompt`.
- Record package-scoped skill use as `consulted` or `skipped`, including
  migration from the earlier `loaded` state value.

### Publication

- Label normative, informative, and rationale documents explicitly.
- Add a public glossary and contributor review contract.
- Standardize public npm examples on the `next` tag for design-alpha releases.
- Publish canonical schema URLs through `seedspec.dev`.
