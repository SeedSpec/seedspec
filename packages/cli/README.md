# `@seedspec/cli`

Command-line interface for authoring and using portable, agent-ready SeedSpec
packages.

The CLI helps authors shape and review seeds, helps adopters inspect and
configure them, and prepares a provenance-preserving handoff for an implementing
agent. It does not embed a model or treat package validity as a guarantee of
semantic completeness or realization quality.

## Run without installing

```bash
npx --yes @seedspec/cli@next --help
npx --yes @seedspec/cli@next version
```

## Install

```bash
npm install --global @seedspec/cli@next
seedspec --help
```

Common entry points:

```bash
seedspec validate <package-path>
seedspec version --json
seedspec audit <package-path>
seedspec audit <package-path> --area material-ambiguity
seedspec audit <package-path> --status
seedspec docs authoring
seedspec inspect <package-path> --json
seedspec begin <package-path>
seedspec digest <package-path>
seedspec capability-conformance <package-path> <capability-id> [--result <yaml>]
```

`seedspec begin` is the read-only agent handoff. It validates the package and
surfaces package-author intent, applied-intent, configuration,
implementation-profile, ordered-task, supporting-material, trust, and verification-plan choices
before implementation begins.

`seedspec audit` creates or continues an authoring review outside the
distributable package and prints versioned Markdown instructions for a capable
agent. The same command advances after a completed pass; `--area` targets one
of the seven review areas and `--status` is read-only. The CLI does not embed a
model or modify package content. See `seedspec docs authoring` for guidance
bundled with the installed version.

Protocol `0.1` is a design alpha. Discovery or validation never authorizes
package activation or execution.

- Documentation: [seedspec.dev](https://seedspec.dev)
- Why semantic structure matters: [guide](https://github.com/SeedSpec/seedspec/blob/main/docs/semantic-structure.md)
- Source: [SeedSpec/seedspec](https://github.com/SeedSpec/seedspec)
