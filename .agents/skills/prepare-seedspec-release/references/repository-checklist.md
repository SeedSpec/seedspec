# SeedSpec coordinated release checklist

## Core (`seedspec`)

- `release.json` is the source of truth.
- Root, protocol, runtime, CLI, and conformance suite use the exact release.
- Runtime and CLI dependencies are exact pins.
- Protocol schemas use immutable exact-release `$id` values.
- The protocol package contains schemas, normative documents, the conformance
  bundle, and the exact release manifest.
- `npm run release:protocol`, `npm run release:verify`, `npm run check`, and
  `npm run release:pack` pass.

## Reference solutions

- Every current distributable package uses the current protocol family.
- First-party reference packages released with the suite use the coordinated
  release version.
- Current packages validate with the packed CLI.
- Historical authoring state remains clearly identified and is not silently
  rewritten when its digests would become false.

## Evaluation tools

- Vendored schemas and protocol metadata exactly match the release package.
- The harness records exact protocol, runtime, CLI, model, configuration, and
  artifact digests.
- Existing tests and a clean 0.2 smoke run pass.
- Published evidence states narrow findings and limitations; do not turn
  benchmark saturation into a broad quality claim.

## Website

- Exact files exist under `public/releases/<release>/schemas/`.
- The current family alias exists under `public/schemas/v<family>/`.
- Both trees are generated from the protocol package and match its digests.
- Old exact releases remain available.
- Requests for missing schema files fail clearly and never return the website
  application shell with status 200.
- Install commands and release copy use numeric versions and the default npm
  distribution tag.

## Final smoke

- Install packed package archives into a new temporary directory.
- Run `seedspec doctor --full`.
- Initialize a seed, guide it through preparation, review it, run
  `publish-check`, pack it, inspect the archive, and validate the unpacked
  package.
- Verify exact public schema URLs after deployment.
