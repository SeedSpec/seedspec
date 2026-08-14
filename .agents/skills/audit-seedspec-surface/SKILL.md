---
name: audit-seedspec-surface
description: Audits and cleans SeedSpec public surfaces for leftover trees, retired commands, broken links, and docs that still describe a previous product. Use when preparing a release, after a protocol cut, or when README, CONTRIBUTING, RELEASING, docs, or maintainer skills have drifted.
---

# Audit SeedSpec Surface

Catch leftover product, eval, and docs residue before it ships. This is not
the version-bump workflow. After the surface is clean, use
`$prepare-seedspec-release`.

## What this repository is

Protocol, schemas, conformance suite, first-party runtime and CLI, and
documentation. It is not an authoring studio, eval harness, or catalog.

`README.md` is the only documentation index. `validate` and `check` are
linters over the package format. Check fixtures are not protocol conformance.
Family compatibility is README strategy, not language or protocol prose.

## Run the scanner first

```bash
npm run audit:surface
```

The scanner reads
[references/inventory.json](references/inventory.json). It fails on retired
paths that still exist, retired terms and commands on current surfaces, npm
scripts that are not in `package.json`, CLI commands that are not in the
binary, and broken relative links.

Do not edit `CHANGELOG.md` history to silence a hit. If the inventory is
wrong, update the inventory.

## Then judge what the scanner cannot

Compare these live sources to the public surfaces:

1. CLI help in `packages/cli/bin/seedspec.js`
2. Root `package.json` scripts
3. The README documentation catalog versus files that exist under `docs/`
4. `docs/glossary.md` versus terms used in CONTRIBUTING, RELEASING, docs, and
   `.agents/skills/`
5. `scripts/generate-protocol-release.mjs` source documents versus
   `packages/protocol/documents/`

Flag and fix:

- A second docs index, root `ARCHITECTURE.md`, or ADRs presented as current
  contract.
- README consumer commands mixed with repository checks (`npm test`,
  `npm run conformance`).
- Protocol operations omitted from README (`validate`, `digest`, `inspect`,
  `flatten`).
- One-time publisher setup written as if it were a per-release step.
- Exact release numbers in README, CONTRIBUTING, RELEASING, or informative
  guides. Family identifiers belong in shipped protocol documents, schema
  paths, and `release.json`.
- Skills or checklists that still name deleted commands, goldens, authoring,
  or `doctor` / `prepare` / `publish-check`.
- Generated protocol documents that drifted from `docs/`.

## Clean

| Kind | Action |
| --- | --- |
| Leftover tree or file | Delete it. Do not relocate eval or example residue into protocol conformance. |
| Stale current-surface claim | Edit the current file. |
| Historical changelog | Leave it. |
| Generated `packages/protocol/documents/` | Fix `docs/`, then `npm run release:protocol`. |
| Wrong inventory | Update `references/inventory.json`. |

Keep CONTRIBUTING to scope, classification, verify, and pointers to skills.
Keep RELEASING to the version contract and per-release steps. One-time npm
publisher setup belongs in the release checklist, not the human release doc.

## Verify

```bash
npm run audit:surface
npm run check
git diff --check
```

Report leftover artifacts deleted, current-surface edits, inventory updates,
and anything left as historical on purpose.
