# SeedSpec coordinated release checklist

## One-time npm publishing

Configure `publish.yml` as the trusted publisher for all three npm packages,
bind it to the `npm` GitHub environment, and allow `npm stage publish`. The
workflow uses a GitHub-hosted runner, OIDC, and current Node and npm releases
because staged publishing requires them. Approval remains a separate
maintainer action with 2FA.

## Core (`seedspec`)

- `release.json` is the source of truth.
- Root, protocol, runtime, CLI, and conformance suite use the exact release.
- Runtime and CLI dependencies are exact pins.
- Protocol schemas use immutable exact-release `$id` values.
- The protocol package contains schemas, normative documents, the conformance
  suite source, the conformance bundle, and the exact release manifest.
- `npm run audit:surface`, `npm run release:protocol`, `npm run release:verify`,
  `npm run check`, and `npm run release:pack` pass.

## Reference solutions

- Every current distributable package uses the current protocol family.
- Current packages validate with the packed CLI.
- Historical packages remain clearly identified and are not silently rewritten.

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
- Run `npx @seedspec/cli version` and `npx @seedspec/cli conformance`.
- Initialize a package with `seedspec init`, validate it, and inspect it.
- Verify exact public schema URLs after deployment.
