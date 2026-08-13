# `@seedspec/cli`

Reference command-line interface for the SeedSpec Protocol 0.4 structural core.

```bash
npx @seedspec/cli validate ./package
npx @seedspec/cli digest ./package
npx @seedspec/cli inspect ./package --json
npx @seedspec/cli flatten ./package --output ./flattened/SPEC.md
npx @seedspec/cli check ./package [--strict] [--evidence <file>]
npx @seedspec/cli check ./package --evaluate ./evaluate.mjs --workspace ./impl
npx @seedspec/cli lock ./package --output seedspec.lock.json
npx @seedspec/cli preview ./package
npx @seedspec/cli conformance
```

`validate`, `digest`, and `inspect` are read-only. `flatten` writes only the
explicit output path. `check` may run a caller-supplied evaluator against a
workspace; it does not execute files from the package.

Protocol 0.4 does not accept Protocol 0.3 packages. The CLI is experimental;
pin exact versions.
