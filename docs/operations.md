# SeedSpec Protocol 0.4 operations

The 0.4.0 structural release defines four package operations. Each operation is
offline and treats package content as untrusted input.

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

## Deferred protocol operations

Authoring, resolution, preparation, and verification are not Protocol 0.4.0
operations. Future implementations must use the 0.4 package structure instead
of exposing earlier experimental APIs.
