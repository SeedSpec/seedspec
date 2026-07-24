# `@seedspec/cli`

Command-line interface for authoring and using portable, agent-ready SeedSpec
packages.

The CLI helps authors shape and review seeds, helps adopters inspect and
configure them, and prepares a provenance-preserving handoff for an implementing
agent. It does not embed a model or treat package validity as a guarantee of
semantic completeness or realization quality.

## Run without installing

```bash
npx --yes @seedspec/cli@0.2.0 --help
npx --yes @seedspec/cli@0.2.0 version
```

## Install

```bash
npm install --global @seedspec/cli@0.2.0
seedspec --help
```

Common entry points:

```bash
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

`seedspec prepare` moves a package through deterministic baseline checks,
guided agent review, author resolution, publish checking, an optional
fresh-agent evaluation, and packing. The command is resumable from durable
state and explains every phase.

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
