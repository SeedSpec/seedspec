# SeedSpec changelog

This changelog records public protocol-bundle and first-party tooling changes.
The protocol family, schema package, conformance suite, runtime, and CLI retain
distinct identities but use one coordinated first-party release version; see
[versioning](docs/versioning.md).

## 0.2.0

| Surface | Version |
| --- | --- |
| Protocol family | `0.2` |
| Exact protocol release / `@seedspec/protocol` | `0.2.0` |
| Conformance suite | `0.2.0` |
| `@seedspec/runtime` | `0.2.0` |
| `@seedspec/cli` | `0.2.0` |

### Protocol and conformance

- Add one normative language definition for SeedSpec concepts, authority,
  processing, operations, claims, and release boundaries.
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

- Add `seedspec prepare` as the resumable author entry point across baseline
  validation, guided review, author resolution, publish checking, optional
  independent evaluation, and packing.
- Add the `review` author-facing alias, a versioned `publish-check`, a
  digest-bound `eval` workspace for an author's fresh agent, and deterministic
  `pack` archives with inspection and receipt sidecars.
- Bundle version-matched authoring and adoption skills in the CLI and add
  explicit, collision-safe `seedspec skills list|export` commands.
- Add `seedspec upgrade` with dry-run-first migration from protocol `0.1` to
  `0.2` while preserving the author-owned package version.
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

- Coordinate all first-party packages and the conformance suite on numeric
  release `0.2.0`, publish exact schemas under
  `/releases/0.2.0/schemas/`, and reserve the `v0.2` path as a family alias.
- Ship the normative protocol documents inside `@seedspec/protocol`, bind them
  by digest, and add reproducible cross-repository release checks plus a
  maintainer release skill.
- Publish narrowly scoped “skills help” evidence while explicitly treating
  saturated deterministic benchmarks as integrity gates rather than general
  implementation proof.
- Present SeedSpec as a broader authoring-and-distribution system built around
  the SeedSpec Protocol rather than treating the protocol as the entire product.
- Explain the stable semantic roles for product intent, adopter configuration,
  decision provenance, acceptance, implementation guidance, and evidence.
- Add an evidence-scoped evaluation summary and expand internal-enterprise,
  vendor, consultancy, ecosystem, and public-library distribution use cases.
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
