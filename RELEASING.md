# Releasing SeedSpec

SeedSpec `0.2.0` is the first coordinated release of the protocol, runtime,
CLI, conformance suite, reference packages, website artifacts, and supporting
tools. The release is experimental because the protocol is still evolving, but
every published artifact must identify the same exact release.

## Version contract

- First-party release artifacts use the exact version in `release.json`.
- The protocol family is the major/minor pair in `release.json`, currently
  `0.2`.
- Published package versions do not use prerelease suffixes such as `-alpha`.
- Seed packages authored by other publishers keep their own independent
  semantic versions. The default version for a newly initialized seed is
  `0.1.0`.
- Exact schema identifiers and permanent website assets live under
  `https://seedspec.dev/releases/<release>/schemas/`.
- `https://seedspec.dev/schemas/v0.2/` is a convenient family alias. It is not
  an immutable release identifier.
- npm packages are published to the default `latest` tag. The project status
  communicates that releases below `1.0.0` are evolving.

## Release phases

Before the first staged run, configure `publish.yml` as the trusted publisher
for all three existing npm packages, bind it to the `npm` GitHub environment,
and allow `npm stage publish`. The workflow uses a GitHub-hosted runner, OIDC,
Node 24, and npm 11.18 because staged publishing requires current npm and Node
releases. Approval remains a separate maintainer action with 2FA.

### 1. Prepare

Update `release.json`, migrate source packages, and regenerate exact protocol
artifacts:

```sh
npm run release:protocol
npm run release:verify
```

The release generator copies the normative protocol documents into
`@seedspec/protocol`, records their digests beside the schema and conformance
digests, refreshes digest-bound conformance goldens, and creates the exact
release manifest. It runs the manifest step again after the goldens so the
result is stable in one command.

### 2. Verify

Run the full repository check and inspect the archives npm will publish:

```sh
npm run check
npm run release:pack
```

`release:verify` fails when first-party versions, protocol identifiers,
generated documents, schema URLs, conformance metadata, or dependency pins
drift apart. Package archives must contain the normative documents and exact
release manifest.

### 3. Stage the website

Copy the generated schema directory to both:

- `public/releases/<release>/schemas/` for the immutable release
- `public/schemas/v<family>/` for the moving family alias

Run the website release-integrity check before deployment. Do not hand-edit a
schema after copying it from the protocol package.

### 4. Publish

Publish in dependency order:

1. `@seedspec/protocol`
2. `@seedspec/runtime`
3. `@seedspec/cli`

Publish the exact versions from a clean commit. Then test installation in a
new temporary directory with `seedspec doctor --full`.

### 5. Finalize

Tag the source commit as `v<release>`, verify the exact website URLs return
JSON rather than an application fallback, record the npm integrity values, and
publish the release notes and evidence links.

## Repository responsibilities

See
`.agents/skills/prepare-seedspec-release/references/repository-checklist.md`
for the cross-repository checklist used by maintainers and agents.
