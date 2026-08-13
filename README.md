# SeedSpec

SeedSpec Protocol 0.4 is an experimental package format for portable,
agent-readable product specifications.

Every package starts with `SPEC.md`. Its Markdown body carries authored intent.
Optional YAML frontmatter exposes selected semantics to tools. An optional root
`seedspec.yaml` can supply a base manifest; frontmatter has final authority.

## Minimum package

```markdown
---
id: daily-report
name: Daily report
version: "1.0.0"
---
# Daily report

Produce a report for the previous reporting day.
```

## Commands

```bash
npm install
npx seedspec validate ./package
npx seedspec inspect ./package --json
npx seedspec flatten ./package --output ./flattened/SPEC.md
npx seedspec check ./package
npx seedspec preview ./package
npm test
npm run conformance
npm run bakeoff
```

The 0.4.0 release implements the structural core:

- `SPEC.md` and optional `seedspec.yaml` discovery;
- deterministic recursive merge and override provenance;
- inline and one-level YAML sections;
- configuration, success, tasks, and capabilities;
- namespaced success anchors in specification prose;
- direct-path context modules and optional format metadata;
- implementation profiles as context modules;
- independently validated bundled packages;
- inspection and flattened `SPEC.md` output; and
- an offline conformance suite.

Runtime tooling on that core:

- `seedspec check` for claim coverage and independent evidence;
- `seedspec lock`, `verify-lock`, and `get` for digest-pinned copies;
- `seedspec preview` for an authoring view of the same report.

Compatibility, decisions, conflicts, and integration points remain prose. They
do not have 0.4 root fields.

Protocol 0.4 does not preserve or parse Protocol 0.3 packages. Reauthor older
packages against the new contract.

## Contract

- [Language](docs/01-language.md)
- [Protocol](docs/protocol.md)
- [Operations](docs/operations.md)
- [Migration policy](docs/migrations.md)
- [0.4 reset decision](docs/decisions/0023-protocol-0.4-package-reset.md)
- [0.4 conformance suite](conformance/v0.4/cases.yaml)

Validation establishes structure and content identity. It does not prove that
the specification is complete or that an implementation satisfies it.
