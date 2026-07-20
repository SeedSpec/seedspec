# SeedSpec Runtime

The runtime is a neutral CLI and JavaScript library. It does not know about
marketplace commercial editions or any particular agent prompt format.

## Commands

```text
seedspec prompt
seedspec begin <root-package-path> [--json]
seedspec validate <path>
seedspec digest <path>
seedspec inspect <path> [--json]
seedspec artifacts <path> [--json]
seedspec resources <path> [--json]
seedspec resource-digest <directory>
seedspec resolve-resources <project-path> [--json]
seedspec record-resource-use <project-path> <package-id> <resource-id> <loaded|skipped> [--reason <text>] [--json]
seedspec adapters [--json]
seedspec validate-artifact <path> <artifact-id> [--json]
seedspec discover-features <root-package-path> --catalog <path> [--catalog <path>] [--json]
seedspec resolve <root-package-path> [--add <package-path>] [-i <profile>] [--configuration-selections <yaml>] [--completion-scope <yaml>] [--artifact-selections <yaml>] [--technical-preferences <yaml>] [--output <path>]
seedspec init <solution|application|feature|workflow|automation|configuration|integration> [--output <path>]
seedspec conformance [cases.yaml]
seedspec verify-lock <project-path> --package <path> [--package <path>]
seedspec completion <project-path> [--json]
```

`prompt` prints a short, agent-agnostic instruction that a package distributor or buyer can give to an implementation agent. It delegates the detailed workflow to version-compatible official tooling rather than embedding a long marketplace-maintained prompt.

The CLI ships a compatible local copy of the operational instructions needed to
use SeedSpec. An environment that supports independently versioned online core
instructions must request the version selected by protocol compatibility first.
If it must use the bundled compatible copy, it must tell the user the requested
and resolved versions and why canonical resolution failed. Core operational
instructions are not an author-selectable implementation resource. The 0.1
reference CLI currently uses its bundled instructions; the separate public core
instruction channel and its resolver are not part of this implementation-
resource change.

`begin` is the read-only entry point for an agent that has received a root package. It validates the package, inventories configuration, decisions, implementation profiles, components, artifacts, acceptance material, and early planning guidance, explains the optional-content trust boundary, and prints the ordered steps that precede resolution. It does not write a project, select configuration or an implementation profile, execute package content, fetch remote artifacts, or activate an artifact workflow.

`begin` marks `configuration.example` as review-required. The example is author material, not a selected default.

`inspect` validates the package and returns package-derived identity, name,
description, metadata, kind, configuration, capabilities, conflicts, decisions,
implementation profiles, components, artifacts, relationships, implementation
resources, compatibility, extensions, and canonical digest. JSON output is a
read-only indexing surface; it does not add registry claims or activate package
content.

`resources` lists author-selected implementation resources, usage levels,
version policy, canonical locations, bundled fallback locations, applicability,
and additional-guidance policy without fetching or loading content.
`resource-digest` computes the content digest authors place on a bundled
resource directory.

`resolve` accepts repeated `--add` options, with `--feature` retained as an alpha compatibility alias; one `--configuration-selections` document covering every selected package; an optional `--completion-scope`; product-decision answers through `--decisions`; separate `--technical-preferences`; and `--artifact-selections` for selected, declined, or deferred artifacts. Package kind is a hint and does not constrain root or addition position. A configuration entry chooses the exact author example or supplies a complete custom object; custom values are never merged with the example. If the document is omitted, examples are retained as `example-unreviewed`, `configuration_status` is `review`, and project status is `needs-input`. Completion scope is independent: uncovered selected packages produce `completion_scope_status: review` but do not change input readiness. Artifacts omitted from their selection file remain visibly `unreviewed`. Selection never authorizes execution or adapter invocation.

`-i <profile-id>` and `--implementation <profile-id>` record a preferred
implementation profile for the root package. Use
`--implementation <package-id>/<profile-id>` for an addition and repeat the
option when more than one selected package needs a preference. The preference
may come from the author, an internal platform team, a consultant, or the end
user. It is strong guidance, not a change to core intent or an authorization to
execute. If any selected package declares multiple profiles without a recorded
preference, resolution produces `implementation_profile_status: review` and project
`status: needs-input`; the generated agent guide explains the candidates and
requires the agent to ask which direction to prefer.

Resolution writes one project-level `implementation-profile-state.yaml`, even
when the root and additions each declare profiles. Every package's candidates
remain visible and each package has at most one preferred profile. Tooling that
compares mutually exclusive project realizations should use separate resolution
runs or workspaces rather than write competing states into one handoff.

`completion` validates the resolved scope and structured verification state,
checks their digest and exact item coverage, and derives `scope-review`,
`not-started`, `in-progress`, `failed`, `verified-with-gaps`, or `verified`. It
does not run application tests or inspect external systems; the implementation
agent records truthful results and evidence first.

Technical preferences may include provider-neutral `implementation_targets` with namespaced kind and target IDs plus validated references to selected package guidance. Referenced artifacts must be selected. The generated guide surfaces targets before architecture planning but does not claim that the final application is compatible or deployable.

Target guidance may reference an author-declared implementation resource as
well as a component or selected artifact.

`resolve-resources` processes the resolved resource index. It attempts the
declared canonical version first, validates remote manifest identity, version
policy, file digests, aggregate digest, file count, and size, and then writes
verified bytes to the resolved resource directory. If canonical resolution
fails, it re-verifies and uses an eligible bundled copy and prints and records
the reason. A
required unavailable resource makes the command fail after state is written;
recommended and available failures produce degraded state.

`record-resource-use` records `loaded` or `skipped` plus an optional reason in
local digest-bound state. Core does not export this telemetry.

Addition argument order is not semantic. `declaration-review-v1` records additions in deterministic package-ID order and preserves all capability candidates, revision comparisons, conflicts, and cycles as author-supplied review context. Missing or multiple declarations do not reject an addition because the runtime cannot observe the real implementation. `digest` emits the same canonical package digest recorded during resolution. `verify-lock` recomputes package identities, deterministic order, declaration candidates, and review records from explicitly supplied package directories.

`artifacts` lists declarations and registered adapters without invoking them. `adapters` lists the runtime's known artifact integrations. `validate-artifact` is an explicit request to run the registered format-specific validator. The official `org.seedspec.adapter.product-spec` adapter recognizes `org.seedspec.artifact.product-spec` and invokes `@productspec/parser`; ProductSpec is an optional dependency rather than a core package requirement.

`discover-features` recursively inspects local catalog directories and reports each valid feature as `candidate` or `review`. It may show capability, revision, compatibility-scope, and conflict declarations, but it never makes a compatibility verdict or selects a feature. Remote registry search and package acquisition remain separate catalog responsibilities.

The resulting workspace is:

```text
.seedspec/
├── project.yaml
├── agent-guide.md
├── components.yaml
├── components/
├── artifacts.yaml
├── artifacts/
├── implementation-resources.yaml
├── implementation-resource-state.yaml
├── implementation-resources/
├── implementation-profile-state.yaml
├── implementation-profiles/
├── implementation-notes.md
├── verification-report.md
├── completion-scope.yaml
├── verification-state.yaml
├── resolved-spec.md
├── resolved-config.yaml
├── dependencies.lock.yaml
└── additions/
```

The output is deliberately readable by both people and implementation agents.
The runtime supplies implementation guidance and project-memory scaffolding,
but the end user directs how the agent uses optional artifact workflows and
whether it may make consequential changes. SeedSpec does not choose or change
application code, external systems, or user data.

The CLI uses the first package as the composition root and `--add` packages as
additions. Manifest `kind` values steer authoring, discovery, and agent
communication but do not determine composition validity or imply that a
standalone codebase must be created. The resolved workspace does not assume
that completion evidence comes from a repository: evidence may include
external resource identifiers, permission checks, known-data queries,
delivered messages, screenshots, and platform audit records.

For a guided non-developer lifecycle, use the reusable `skills/use-seedspec` skill. It validates and explains a package, surfaces artifact choices, discovers feature candidates, resolves the selected handoff, and prepares the user's chosen implementation environment.
