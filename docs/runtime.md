# SeedSpec Runtime

The runtime is a neutral CLI and JavaScript library. It does not know about marketplace commercial editions or any coding-agent prompt format.

## Commands

```text
seedspec prompt
seedspec begin <application-path> [--json]
seedspec validate <path>
seedspec digest <path>
seedspec inspect <path>
seedspec artifacts <path> [--json]
seedspec adapters [--json]
seedspec validate-artifact <path> <artifact-id> [--json]
seedspec discover-features <application-path> --catalog <path> [--catalog <path>] [--json]
seedspec resolve <application-path> [--feature <feature-path>] [--configuration-selections <yaml>] [--artifact-selections <yaml>] [--technical-preferences <yaml>] [--output <path>]
seedspec init application [--output <path>]
seedspec init feature [--output <path>]
seedspec conformance [cases.yaml]
seedspec verify-lock <project-path> --package <path> [--package <path>]
```

`prompt` prints a short, agent-agnostic instruction that a package distributor or buyer can give to an implementation agent. It delegates the detailed workflow to version-compatible official tooling rather than embedding a long marketplace-maintained prompt.

`begin` is the read-only entry point for an agent that has received an application package. It validates the package, inventories configuration, decisions, components, artifacts, acceptance material, and early planning guidance, explains the optional-content trust boundary, and prints the ordered steps that precede resolution. It does not write a project, select configuration, execute package content, fetch remote artifacts, or activate an artifact workflow.

`begin` marks `configuration.example` as review-required. The example is author material, not a selected default.

`resolve` accepts repeated `--feature` options, one `--configuration-selections` document covering every selected package, product-decision answers through `--decisions`, separate `--technical-preferences`, and `--artifact-selections` for selected, declined, or deferred artifacts. A configuration entry chooses the exact author example or supplies a complete custom object; custom values are never merged with the example. If the document is omitted, examples are retained as `example-unreviewed`, `configuration_status` is `review`, and project status is `needs-input`. Artifacts omitted from their selection file remain visibly `unreviewed`. Selection never authorizes execution or adapter invocation.

Technical preferences may include provider-neutral `implementation_targets` with namespaced kind and target IDs plus validated references to selected package guidance. Referenced artifacts must be selected. The generated guide surfaces targets before architecture planning but does not claim that the final application is compatible or deployable.

Feature argument order is not semantic. `declaration-review-v1` records features in deterministic package-ID order and preserves all capability candidates, revision comparisons, conflicts, and cycles as author-supplied review context. Missing or multiple declarations do not reject a feature because the runtime cannot observe the real implementation. `digest` emits the same canonical package digest recorded during resolution. `verify-lock` recomputes package identities, deterministic order, declaration candidates, and review records from explicitly supplied package directories.

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
├── implementation-notes.md
├── verification-report.md
├── resolved-spec.md
├── resolved-config.yaml
├── dependencies.lock.yaml
└── features/
```

The output is deliberately readable by both people and coding agents. The runtime supplies implementation guidance and project-memory scaffolding, but the end user directs how the implementation agent uses optional artifact workflows. SeedSpec does not choose or change application code.

For a guided non-developer lifecycle, use the reusable `skills/use-seedspec` skill. It validates and explains a package, surfaces artifact choices, discovers feature candidates, resolves the selected handoff, and prepares the user's chosen implementation environment.
