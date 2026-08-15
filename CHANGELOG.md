# SeedSpec changelog

This changelog records public protocol-bundle and first-party tooling changes.
The protocol family, schema package, conformance suite, runtime, and CLI retain
distinct identities but use one coordinated first-party release version; see
[versioning](docs/versioning.md).

## 0.4.2 — 2026-08-15

| Surface | Version |
| --- | --- |
| Protocol family | `0.4` |
| Exact protocol release / `@seedspec/protocol` | `0.4.2` |
| Conformance suite | `0.4.2` |
| `@seedspec/runtime` | `0.4.2` |
| `@seedspec/cli` | `0.4.2` |

Experimental. Same family as the Protocol 0.4 package contract. Pin this exact
release for applications.

### Package digest

- Define path ordering, byte framing, per-file hashing, and aggregate hashing
  for interoperable package digests.
- Add a fixed digest vector to the conformance suite.

### Operation conformance

- Add an `inspect` case that compares resolved declarations and authored
  provenance.
- Require flatten cases to preserve the resolved manifest, original Markdown
  body, and source-digest comment.

## 0.4.1 — 2026-08-14

| Surface | Version |
| --- | --- |
| Protocol family | `0.4` |
| Exact protocol release / `@seedspec/protocol` | `0.4.1` |
| Conformance suite | `0.4.1` |
| `@seedspec/runtime` | `0.4.1` |
| `@seedspec/cli` | `0.4.1` |

Experimental. Same family as the Protocol 0.4 package contract. Pin this exact
release for applications. Revalidate packages authored against an earlier 0.4
runtime.

### Package surface

- Keep the repository to protocol, schemas, conformance, runtime, CLI, and
  documentation. Authoring evals, examples, and harness residue are not part of
  this release.
- Ship language, protocol, and operations as the normative document set.
- Add flatten-then-validate conformance cases. Flattened output must remain a
  valid standalone package. The suite does not lock flattened bytes.
- Record the exact release as installed-runtime identity. Validation establishes
  structural validity. It does not prove conformance of a realization.

### Exact-release relationship

- Status remains `experimental`. `0.4.x` patches can change accepted structure.
- Exact schemas are identified under
  `https://seedspec.dev/releases/0.4.1/schemas/`. The family alias is
  `https://seedspec.dev/schemas/v0.4/`.

## 0.4.0 — 2026-08-13

| Surface | Version |
| --- | --- |
| Protocol family | `0.4` |
| Exact protocol release / `@seedspec/protocol` | `0.4.0` |
| Conformance suite | `0.4.0` |
| `@seedspec/runtime` | `0.4.0` |
| `@seedspec/cli` | `0.4.0` |

Experimental. Protocol 0.4 resets the package contract around `SPEC.md`. The
0.4 runtime does not parse Protocol 0.3 packages. Reauthor older packages;
there is no compatibility parser or automatic migration.

### Package contract

- Require `SPEC.md` with `id`, `name`, and `version`. `kind` is an optional
  presentation hint and does not impose kind-specific schemas.
- Accept optional root `seedspec.yaml` as a base manifest. Frontmatter has
  final authority. Maps merge recursively; arrays and scalars replace.
- Keep configuration, success criteria, tasks, capabilities, context modules,
  bundled packages, and namespaced `extensions`.
- Connect specification prose to criteria with `[success:<criterion-id>]`.
  Unknown anchors are invalid. Unanchored criteria warn.
- Treat implementation profiles as context modules with `PROFILE.md`.
- Pin bundled children by `id`, `version`, digest, and path. Optional children
  are selectable project state and do not change the parent digest.

### Runtime tooling

These commands use the 0.4 package structure. They are not protocol
conformance operations.

- Add `seedspec check` for claim coverage and independent evidence. Trusted
  runners are `tool`, `independent-agent`, and `human`. Implementing-agent
  evidence cannot certify verification. Package files are never executed.
- Add `seedspec lock`, `verify-lock`, and `get` for digest-pinned copies.
- Add `seedspec preview` for a local authoring view of the same report.
- Add `seedspec init` for a minimum `SPEC.md`.
- Add `seedspec skill` for the thin consumer implementation skill.
- Add `seedspec project` for an implementation receipt at
  `.seedspec/project.yaml` in the workspace: package path and digest,
  configuration, profile, and optional bundled children. The file is refused
  inside the package root.

### Removed from the 0.4 core

Protocol 0.4 does not define root fields for compatibility, decisions,
conflicts, integration points, capability `provides`/`requires`, or
verification state on the package. Guided authoring, context import, search,
doctor, and the previous bundled authoring skills are not 0.4 operations.

### Exact-release relationship

- Status remains `experimental`. Alpha `0.4.x` patches can change accepted
  structure. Revalidate packages after a runtime update.
- Exact schemas are identified under
  `https://seedspec.dev/releases/0.4.0/schemas/`. The family alias is
  `https://seedspec.dev/schemas/v0.4/`.

## 0.3.1 — 2026-08-04

| Surface | Version |
| --- | --- |
| Protocol family | `0.3` |
| Exact protocol release / `@seedspec/protocol` | `0.3.1` |
| Conformance suite | `0.3.1` |
| `@seedspec/runtime` | `0.3.1` |
| `@seedspec/cli` | `0.3.1` |

SeedSpec 0.3.1 keeps the Protocol 0.3 package vocabulary and establishes the
basic agent-guided authoring baseline before local web authoring begins.

### Agent-guided authoring

- Add default, deep, and minimal shaping modes. Default shaping starts with a
  kind-aware lens and asks whether the author wants recommended defaults or
  deeper discovery.
- Add version-matched requirements and composition guidance without turning
  generic checklists into package requirements.
- Add opaque clarification candidates for consequential product ambiguity,
  explicit author dispositions, and proposal-bound application of accepted
  meaning.
- Add frozen clarification probes with content-addressed preparation,
  pre-execution verification, retained evidence, and failure quarantine.
- Serialize authoring mutations with revision checks and a workspace lock.
  Return compact receipts while complete records remain on disk.
- Preserve declared context modules as fixed authoring inputs. Prevent accepted
  meaning from leaking into those modules during ordinary package revision.
- Add a frozen authoring-evaluation run contract. Exercise it with one Codex
  run and one Claude run as limited evidence, not a causal model comparison.

### CLI and runtime

- Add a read-only package shell with deterministic lexical search across
  declared package material and exact release documentation.
- Reject non-global resource addresses after DNS resolution and reject unsafe
  regular-expression patterns in untrusted schemas.
- Add correctness-focused lint and JavaScript type gates to the release check.
- Deduplicate runtime primitives and extract the generated agent guide without
  changing its resolved output.

### Exact-release relationship

- Keep source packages on protocol family `0.3` without source rewriting.
- Require validation and regenerated handoffs when moving from exact release
  `0.3.0` to `0.3.1` because release-bound documents, schemas, conformance
  metadata, and receipts have new identities.

## 0.3.0 — 2026-08-02

| Surface | Version |
| --- | --- |
| Protocol family | `0.3` |
| Exact protocol release / `@seedspec/protocol` | `0.3.0` |
| Conformance suite | `0.3.0` |
| `@seedspec/runtime` | `0.3.0` |
| `@seedspec/cli` | `0.3.0` |

Protocol 0.3 makes the unified context lifecycle the breaking interoperability
change. The coordinated runtime and CLI release also advances guided authoring
as a separate first-party product surface.

### Guided authoring

- Add revision-checked authoring operations for findings, questions, answers,
  source attachments, and review closure.
- Add digest-bound text-document proposals, explicit author acceptance or
  rejection, and recoverable engine application. Accepted but unapplied changes
  block packing; undecided proposals remain visible advisories. Authors can
  retract accepted but unapplied changes without losing decision history.
- Keep authoring reads side-effect free and report stale or unreadable history
  as recoverable notices instead of command blockers.
- Publish the authoring result contract and keep CLI and future web frontends on
  one headless operation layer with replaceable storage boundaries.
- Publish the separate authoring change-proposal contract outside Protocol
  conformance and expose the complete lifecycle through structured CLI output.
- Shorten the human entry prompt while preserving the complete version-matched
  agent work order behind the CLI.
- Add an authoring quickstart, worked example, error model, and bundled
  documentation surfaces.
- Improve implementation handoff discovery for declared providers and bundled
  resources without turning discovery into activation.

### Unified context lifecycle

- Make `context.modules` the required semantic-input collection and
  `definition.module` the primary intent reference.
- Replace ambiguous source shapes with explicit `package`, `artifact`, and
  `resource` discriminators.
- Nest bridge bindings on target modules and keep bridge Skills as independent
  modules.
- Replace `context-modules.yaml` with digest-bound `context-index.yaml`.
- Add request, bundle, preparation-receipt, use-receipt, and integration-
  descriptor schemas.
- Add instance-scoped adapter registration, inert integration discovery,
  explicit native validation, verified bridge authoring, and atomic context
  preparation.
- Bind adapter files and bridge directories by digest. Never load adapter code
  during discovery.
- Keep artifacts passive. Primary intent is no longer an artifact disposition.
- Treat Protocol 0.3 as a clean cut. Retired package shapes require re-authoring.

### Composition carried forward

- Preserve purpose- and audience-aware modules with logical identity and
  namespaced native formats.
- Add explicit bridge Skill bindings as a portable fallback for Skill-aware
  harnesses while preserving native adapters and plain Markdown use.
- Add recursively bundled child packages and explicit parent-to-child
  integration seams.

## 0.2.3

| Surface | Version |
| --- | --- |
| Protocol family | `0.2` |
| Exact protocol release / `@seedspec/protocol` | `0.2.3` |
| Conformance suite | `0.2.3` |
| `@seedspec/runtime` | `0.2.3` |
| `@seedspec/cli` | `0.2.3` |

### Authoring and handoff ergonomics

- Show the complete version-matched authoring work order by default and add
  `author review --summary` as the shorter human-facing view.
- Bundle an optional `author-seedspec` skill and require explicit author consent
  before exporting it into a project.
- Let `seedspec prompt` accept a local package path or GitHub URL and produce a
  self-bootstrapping `npx @seedspec/cli begin ...` handoff that requires no
  global install or SeedSpec skill.

## 0.2.2

| Surface | Version |
| --- | --- |
| Protocol family | `0.2` |
| Exact protocol release / `@seedspec/protocol` | `0.2.2` |
| Conformance suite | `0.2.2` |
| `@seedspec/runtime` | `0.2.2` |
| `@seedspec/cli` | `0.2.2` |

- Correct the friendly authoring summary between completed review passes so it
  reports completed progress and the next review instead of saying that review
  has not started.

## 0.2.1

| Surface | Version |
| --- | --- |
| Protocol family | `0.2` |
| Exact protocol release / `@seedspec/protocol` | `0.2.1` |
| Conformance suite | `0.2.1` |
| `@seedspec/runtime` | `0.2.1` |
| `@seedspec/cli` | `0.2.1` |

### Authoring

- Add a path-independent, revisioned authoring-workspace snapshot that remains
  readable while a draft is invalid.
- Allow authoring workspaces to begin before a valid package exists and assign
  opaque workspace identity independently from package identity.
- Add automatic discovery for `workspace.yaml`, `seedspec.yaml`, and the
  conventional sibling `seedspec/` and `authoring/` layout.
- Make `npx @seedspec/cli author` the human front door and group status,
  review, questions, checks, history, evaluation, and packing beneath the
  author namespace.
- Keep exact versions, noninteractive npm confirmation, explicit paths,
  revisions, digests, and JSON as automation controls rather than beginner
  requirements.
- Record the shared headless-engine contract for CLI and web authoring,
  artifact-level portability, explicit acceptance of agent-proposed document
  changes, and agent-session model consent.

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
- Allow a declared external intent format to serve as the primary definition
  without activating its native workflow.
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
