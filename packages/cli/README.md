# `@seedspec/cli`

Command-line interface for authoring and using portable, agent-ready SeedSpec
packages.

The CLI helps authors shape and review seeds, helps adopters inspect and
configure them, and prepares a provenance-preserving handoff for an implementing
agent. It does not embed a model or treat package validity as a guarantee of
semantic completeness or realization quality.

## Run without installing

```bash
npx @seedspec/cli author
npx @seedspec/cli version
```

Human-facing commands use npm's current release and allow npm to ask before its
first download. Pin the package version and add `--yes` for unattended tests or
automation.

## Optional global install

```bash
npm install --global @seedspec/cli
seedspec --help
```

Common entry points:

```bash
seedspec author
seedspec author status
seedspec author review
seedspec author questions
seedspec author check
seedspec author history
seedspec author evaluate
seedspec author pack
seedspec author help
seedspec author create <package-path> [--target <depth>] [--state <directory>] [--json]
seedspec prepare <package-path> [--state <directory>]
seedspec review <package-path> [--area <area>]
seedspec publish-check <package-path> [--state <directory>]
seedspec eval <package-path> [--output <directory>]
seedspec pack <package-path> [--output <directory>]
seedspec skills list
seedspec skills export --output .agents/skills
seedspec upgrade <package-path> --to 0.2.0 --dry-run
seedspec validate <package-path>
seedspec version --json
seedspec doctor [--full] [--json]
seedspec audit <package-path>
seedspec audit <package-path> --area material-ambiguity
seedspec audit <package-path> --status
seedspec docs authoring
seedspec inspect <package-path> --json
seedspec begin <package-path-or-github-url>
seedspec digest <package-path>
seedspec capability-conformance <package-path> <capability-id> [--result <yaml>]
seedspec conformance [cases.yaml] [--json] [--output <report.json>]
seedspec docs implementing
```

`seedspec begin` is the read-only agent handoff. It validates the package and
surfaces package-author intent, applied-intent, configuration,
implementation-profile, ordered-task, supporting-material, trust, and verification-plan choices
before implementation begins.

`begin` and the root package input to `resolve` also accept public GitHub
repository URLs and GitHub `/tree/<ref>/<package-path>` URLs:

```bash
seedspec begin \
  https://github.com/SeedSpec/reference-solutions/tree/main/solutions/family-hub/seedspec
```

The CLI acquires the selected repository revision into an isolated temporary
directory, validates the requested package, and removes the acquisition after
the command. It does not run package scripts, initialize submodules, load
package-provided skills, or activate package content. Remote acquisition
currently supports public `https://github.com` URLs only.

`seedspec author` is the human authoring front door. It discovers an existing
workspace or conventional `seedspec/` and `authoring/` layout from the current
directory, initializes adjacent authoring state when a package exists, and
shows the current work plus the most relevant next command. Paths are optional
for authoring commands when discovery finds one unambiguous project.

The `status`, `review`, `questions`, `check`, `history`, `evaluate`, and `pack`
actions place existing authoring capabilities under one discoverable namespace.
Exact paths, state directories, revisions, and JSON are available for agents
and automation without defining the beginner experience.

`seedspec prepare` moves a package through deterministic baseline checks,
guided agent review, author resolution, publish checking, an optional
fresh-agent evaluation, and packing. The command is resumable from durable
state and explains every phase.

`seedspec author create` assigns an opaque workspace identity and initializes
portable authoring state around an existing, empty, or invalid draft directory.
It does not require a conforming package and is idempotent for an existing
workspace.

`seedspec author status` returns a versioned, path-independent authoring
workspace snapshot. It includes an opaque workspace identity when state has
been created, a content-derived revision, draft document inventory,
deterministic package status, questions, and review passes. It remains readable
while ordinary draft content is invalid. Human text omits opaque IDs and
digests unless they are needed; `--json` retains the complete machine contract.

`seedspec review` (also available as `seedspec audit`) creates or continues an authoring review outside the
distributable package and prints versioned Markdown instructions for a capable
agent. The same command advances after a completed pass; `--area` targets one
of the seven review areas and `--status` is read-only. The CLI does not embed a
model or modify package content. See `seedspec docs authoring` for guidance
bundled with the installed version.

`seedspec publish-check` enforces the blocking preparation gates.
`seedspec eval` creates a digest-bound independent-handoff workspace and agent
instructions without running a model. `seedspec pack` emits the source archive,
versioned inspection and publish-check records, and a digest-bound receipt.
`seedspec skills export` makes the version-matched skills in the CLI package
available to an author's agent.

`seedspec doctor` verifies that the installed CLI, runtime, exact protocol
release, schemas, and bundled conformance corpus agree. `--full` runs every
release-bound conformance case. `seedspec docs implementing` prints the
version-matched package-to-handoff workflow bundled with the CLI.

Protocol `0.2` is experimental. Discovery or validation never authorizes
package activation or execution.

- Documentation: [seedspec.dev](https://seedspec.dev)
- Why semantic structure matters: [guide](https://github.com/SeedSpec/seedspec/blob/main/docs/semantic-structure.md)
- Source: [SeedSpec/seedspec](https://github.com/SeedSpec/seedspec)
