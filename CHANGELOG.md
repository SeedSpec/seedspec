# SeedSpec changelog

This changelog records public protocol-bundle and first-party tooling changes.
The protocol family, schema package, conformance suite, runtime, and CLI are
versioned independently; see [versioning](docs/versioning.md).

## Unreleased design-alpha work

| Surface | Version |
| --- | --- |
| Protocol family | `0.1` |
| Exact protocol release / `@seedspec/protocol` | `0.1.0-alpha.6` |
| Conformance suite | `2.2.0` |
| `@seedspec/runtime` | `0.1.0-alpha.7` |
| `@seedspec/cli` | `0.1.0-alpha.9` |

### Protocol and conformance

- Add one normative language definition for SeedSpec concepts, authority,
  processing, operations, claims, and alpha boundaries.
- Bind normative schemas, documents, the complete conformance corpus,
  first-party implementation versions, and predecessor compatibility in
  `protocol-release.json`.
- Define five small protocol operations: validate, digest, resolve,
  resolve-resources, and capability-conformance.
- Add schema-valid release-bound conformance reports and two complete golden
  resolved handoffs.
- Define exact-release compatibility and the dry-run-first contract that the
  first real source migration must follow.
- Distinguish the package-author primary intent source from end-user applied
  intent and agent proposals.
- Allow a declared external intent format, including ProductSpec, to serve as
  the primary definition without activating its native workflow.
- Add explicit package-fit dispositions, project-local intent contributions,
  and an intent readiness gate before implementation-profile choice.
- Distinguish package evidence, verification plans, baseline evidence,
  realization evidence, and outcome evidence and prevent subject substitution.
- Require verification plans for included completion-scope items and typed
  evidence references for recorded verification results.
- Add conformance cases for rich applied intent, unexplained adaptation,
  primary-intent artifact integrity, and omitted applied intent.
- Add structured capability revision history with semver-consistent breaking,
  additive, and clarifying change tags.
- Classify provider revision differences by direction, semver distance, review
  severity, and available structured change evidence.
- Add optional version-bound capability conformance suites for JSON Schema,
  structured acceptance scenarios, and adapter-run eval bundles.
- Add separate capability-conformance result records bound to exact contract,
  suite, realization, evaluator, check coverage, and evidence.
- Add optional ordered implementation task runbooks with stable task IDs,
  instructions, and validated package-local references.

### Reference tooling

- Make resolution atomic and emit one content-addressed,
  privacy-preserving `resolution-receipt.json`.
- Add `seedspec doctor`, including offline smoke verification and a `--full`
  mode backed by the conformance corpus bundled in `@seedspec/protocol`.
- Add `seedspec docs implementing` with three version-bound end-to-end examples.
- Add JSON and file output for `seedspec conformance`.
- Allow `seedspec begin` and the root package input to `seedspec resolve` to
  acquire a public GitHub repository or `/tree/<ref>/<package-path>` URL without
  running package scripts, submodules, or package-provided tooling.
- Add `--applied-intent` resolution input and `resolved-intent.yaml` handoff
  state with provenance, fit, contributions, and unresolved proposals.
- Make primary intent artifacts selected core input while keeping adapter and
  artifact workflows separately activated.
- Teach authoring audits and bundled skills to separate target intent,
  decision latitude, verification plans, and evidence subjects.
- Add `seedspec capability-conformance` to inspect suite bindings and validate
  runner-produced results without executing untrusted package content.
- Preserve each package's task order and referenced context in resolved
  `tasks.yaml` handoffs without inferring a workflow graph or completion claim.

### Documentation and package presentation

- Present SeedSpec as a broader authoring-and-distribution system built around
  the SeedSpec Protocol rather than treating the protocol as the entire product.
- Explain the stable semantic roles for product intent, adopter configuration,
  decision provenance, acceptance, implementation guidance, and evidence.
- Add an evidence-scoped evaluation summary and expand internal-enterprise,
  vendor, consultancy, ecosystem, and marketplace distribution use cases.
- Update npm package descriptions and READMEs to give authoring, adoption, and
  package distribution first-class status without changing conformance claims.

## Previous design-alpha publication

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
