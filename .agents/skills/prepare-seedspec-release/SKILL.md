---
name: prepare-seedspec-release
description: Prepare and audit a coordinated SeedSpec release across the protocol, runtime, CLI, conformance suite, reference packages, evaluation tools, marketplace prototype, and website. Use when bumping SeedSpec versions, publishing packages or schemas, staging release URLs, checking release integrity, or diagnosing drift among SeedSpec repositories.
---

# Prepare a SeedSpec Release

## Overview

Produce one exact, reproducible SeedSpec release instead of independently
versioned artifacts. Treat `release.json` in the core repository as the source
of truth and use the repository checks as gates.

Read `references/repository-checklist.md` before changing another repository.

## Workflow

### 1. Inspect before editing

- Read `release.json`, `RELEASING.md`, package manifests, and current Git
  status in every repository in scope.
- Preserve unrelated or unfinished changes. Do not normalize historical
  evidence merely because it mentions an older release.
- Distinguish first-party release versions from versions chosen by independent
  seed authors.

### 2. Align the release contract

- Use the exact `release_version` for the root workspace, protocol, runtime,
  CLI, conformance suite, and other first-party release artifacts.
- Use the `protocol_family` in package manifests and generated handoffs.
- Do not add `-alpha` or another prerelease suffix. Describe maturity with the
  release status and documentation.
- Pin first-party package dependencies to the exact coordinated version.

### 3. Generate exact artifacts

- Run `npm run release:protocol` in the core repository.
- Confirm that the protocol package contains its normative documents, schemas,
  conformance bundle, and exact release manifest.
- Never edit generated release artifacts to fix drift. Fix the source or
  generator, then regenerate.

### 4. Verify every boundary

- Run `npm run release:verify`, `npm run check`, and `npm run release:pack`.
- Test the CLI from packed archives in a new temporary project.
- Sync website schemas from the generated protocol package, then run the
  website integrity check.
- Verify each exact schema URL returns the expected JSON and digest. Reject
  HTML fallbacks and redirects to mutable content.
- Run repository-specific checks from the checklist.

### 5. Publish and record

- Publish packages in dependency order: protocol, runtime, CLI.
- Use the default npm tag for numeric releases.
- Tag the exact clean source revision.
- Record package integrity, website deployment, smoke-test results, and
  intentionally limited evaluation claims in the release notes.
- If any gate fails after publication, stop the rollout and document the
  partial state before changing another artifact.

## Integrity rules

- An exact release URL is permanent.
- A family alias is convenient but mutable.
- Digests bind bytes, not intent.
- Generated metadata must be reproducible from tracked sources.
- Historical records remain historical; current distributable artifacts must
  pass the current contract.
- A green evaluation supports only the claim that evaluation tested.
