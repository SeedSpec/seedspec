# `@seedspec/cli`

Command-line interface for validating, inspecting, resolving, and using
SeedSpec packages.

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
```

`seedspec begin` is the read-only agent handoff. It validates the package and
surfaces package-author intent, applied-intent, configuration,
implementation-profile, supporting-material, trust, and verification-plan choices
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
- Source: [SeedSpec/seedspec](https://github.com/SeedSpec/seedspec)
