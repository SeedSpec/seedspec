# `@seedspec/cli`

Reference command-line interface for the SeedSpec Protocol 0.4 structural core.
`seedspec --help` is the live command list if this page drifts.

```bash
npx @seedspec/cli init ./package [--id <id>] [--name <name>] [--force] [--json]
npx @seedspec/cli validate ./package
npx @seedspec/cli digest ./package
npx @seedspec/cli inspect ./package [--json]
npx @seedspec/cli flatten ./package [--output ./flattened/SPEC.md]
npx @seedspec/cli check ./package [--json] [--strict]
    [--evidence <file>] [--evaluate ./evaluate.mjs --workspace ./impl]
    [--output <file.json>]
npx @seedspec/cli lock ./package [--output seedspec.lock.json] [--json]
npx @seedspec/cli verify-lock seedspec.lock.json [--json]
npx @seedspec/cli get ./package --digest sha256:... --output ./copy
npx @seedspec/cli preview ./package [--port <number>]
    [--evaluate ./evaluate.mjs --workspace ./impl]
npx @seedspec/cli project ./package [--file <project.yaml>] [--json]
    [--profile <id>] [--set <id=value>] [--enable <id>]
npx @seedspec/cli skill [--output ./SKILL.md]
npx @seedspec/cli conformance [cases.yaml] [--json] [--output <report.json>]
npx @seedspec/cli version [--json]
```

`validate`, `digest`, and `inspect` are read-only. `flatten` writes only the
explicit output path. `check` may run a caller-supplied evaluator against a
workspace; it does not execute files from the package. `check --output` writes
JSON: a shaped evidence record when verification ran, or the full check report
otherwise. `init` writes `SPEC.md` and can print the created record as JSON.
`project` writes adopter selections outside the package. `skill` prints or
copies the consumer implementation skill.

This family does not accept packages from a previous family. The CLI is
experimental; pin exact versions.
