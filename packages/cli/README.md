# `@seedspec/cli`

Command-line interface for validating, inspecting, resolving, and using
SeedSpec packages.

## Run without installing

```bash
npx @seedspec/cli --help
```

## Install

```bash
npm install --global @seedspec/cli
seedspec --help
```

Common entry points:

```bash
seedspec validate <package-path>
seedspec inspect <package-path> --json
seedspec begin <package-path>
seedspec digest <package-path>
```

`seedspec begin` is the read-only agent handoff. It validates the package and
surfaces configuration, implementation-profile, optional-content, trust, and
completion-scope choices before implementation begins.

Protocol `0.1` is a design alpha. Discovery or validation never authorizes
package activation or execution.

- Documentation: [seedspec.dev](https://seedspec.dev)
- Source: [SeedSpec/seedspec](https://github.com/SeedSpec/seedspec)
