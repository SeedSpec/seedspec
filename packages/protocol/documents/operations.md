# SeedSpec Protocol 0.4 operations

The protocol defines four package operations. Each operation is offline and
treats package content as untrusted input.

## `validate`

Read `SPEC.md`, optional `seedspec.yaml`, referenced section files, context
entrypoints, format documentation, and bundled children. Resolve and validate
the package. Validate success anchors and local structured references. Write
nothing. Return stable diagnostics on failure.

Validation never executes scripts or fetches URLs.

## `digest`

Validate the package. Return its lowercase `sha256:` content digest. Identical
portable paths and file bytes produce the same digest. Timestamps, permissions,
and empty directories do not affect it.

## `inspect`

Validate the package. Return normalized declarations, source paths, overrides,
section expansion, success anchors, unanchored criteria, and bundled-child
provenance. Write nothing.

Inspection reports authored structure. It does not certify semantic quality.

## `flatten`

Validate the package. Emit one `SPEC.md` containing normalized frontmatter and
the original Markdown body. Include the source package digest in a YAML
comment.

Flattening removes dependence on `seedspec.yaml` and external section files for
manifest resolution. It does not inline context-module or bundled-package
content.

Review flattened output before it replaces authored sources.

## Runtime tooling

These commands use the 0.4 package structure. They are not protocol conformance
operations. Validation still does not prove implementation conformance.

### `check`

Validate the package. Report success criteria, anchors, evaluation modules, and
which claims are enforceable.

Without evidence, `check` is an authoring preview. Unanchored or unenforceable
criteria are review warnings unless `--strict` is set.

With `--evidence <file>` or `--evaluate <script> --workspace <dir>`, `check`
binds independent evidence to criterion IDs. The evaluator is supplied by the
caller and runs outside the package. Package files are not executed.

Implementing-agent evidence can report coverage. It cannot certify
verification. Trusted runner kinds are `tool`, `independent-agent`, and
`human`.

### `lock` and `verify-lock`

Write and later verify `{id, version, digest, source}` records for packages.
A lockfile pins bytes. It is not a marketplace.

### `get`

Copy a local package to an output directory only when its digest matches.

### `preview`

Serve the check report as a local page. Optional `--evaluate` and
`--workspace` show trusted evidence for a realization.

### `init`

Write a minimum `SPEC.md` with `id`, `name`, and `version`. Kind is omitted.
Do not write project state inside the package.

### `skill`

Print or copy the consumer implementation skill. It tells an agent to read
`SPEC.md`, call `seedspec check`, and not certify verification from its own
judgment.

### `project`

Write adopter selections to a workspace file, default `.seedspec/project.yaml`.
The file records package path and digest, configuration values, an
implementation-profile module id, and enabled optional bundled packages.

Project state must live outside the package. Paths that start with `.` are not
portable package paths, and writing selections into the package would change
its digest.

## Deferred protocol operations

Authoring, resolution, preparation, and verification are not protocol
operations. A later family would define new operations rather than restore
earlier experimental APIs.
