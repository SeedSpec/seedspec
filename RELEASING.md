# Releasing SeedSpec

First-party protocol, runtime, and CLI artifacts share one exact release.
The protocol is experimental. Every published artifact must identify that
same release.

## Version contract

- First-party release artifacts use the exact version in `release.json`.
- The protocol family is the major/minor pair in `release.json`.
- Published package versions do not use prerelease suffixes such as `-alpha`.
- Packages authored by other publishers keep their own independent semantic
  versions. `seedspec init` writes `0.1.0` as the new package version.
- Exact schema identifiers and permanent website assets live under
  `https://seedspec.dev/releases/<release>/schemas/`.
- `https://seedspec.dev/schemas/v<family>/` is a convenient family alias. It
  is not an immutable release identifier.

## Release phases

Sweep the public surface first with `$audit-seedspec-surface`. Then:

### 1. Prepare

Update `release.json` and regenerate exact protocol artifacts:

```sh
npm run release:protocol
npm run release:verify
```

The generator copies the normative protocol documents into
`@seedspec/protocol`, records their digests beside the schema and conformance
digests, writes the conformance bundle, and creates the exact release
manifest.

### 2. Verify

```sh
npm run check
npm run release:pack
```

`release:verify` fails when first-party versions, protocol identifiers,
generated documents, schema URLs, conformance metadata, or dependency pins
drift apart.

### 3. Stage the website

The website lives in a separate repository. Copy the generated schema
directory to both:

- `public/releases/<release>/schemas/` for the immutable release
- `public/schemas/v<family>/` for the moving family alias

Do not hand-edit a schema after copying it from the protocol package.

### 4. Publish

Publish in dependency order: `@seedspec/protocol`, `@seedspec/runtime`,
`@seedspec/cli`. Then test a new temporary directory with
`npx @seedspec/cli version` and `npx @seedspec/cli conformance`.

### 5. Finalize

Tag the source commit as `v<release>`, verify the exact website URLs return
JSON rather than an application fallback, record the npm integrity values, and
publish the release notes.

One-time npm trusted-publisher setup and the cross-repository checklist live
in
`.agents/skills/prepare-seedspec-release/references/repository-checklist.md`.
