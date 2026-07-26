# Authoring errors and notices

> **Informative reference.** Every code the authoring commands can emit, what
> caused it, and how to clear it.

Two kinds of message come out of the authoring commands:

- **Errors** stop the command. Something must change before it can run.
- **Notices** appear in `notices[]` and never stop anything. They report what
  the engine observed.

Nothing here is a judgment about the package. Structural failure and
specification quality are separate claims.

## Notices

### `AUTHORING_REVIEW_STALE`

Every thread is reviewed, and the package has changed since.

This is normal. Editing a package after reviewing it is ordinary authoring, and
guided review is advisory for packing — publishing is not blocked. Review again
when the change is material to a thread you already closed; ignore it when it
is not.

### `AUTHORING_PASS_UNREADABLE`

A historical pass record could not be read — usually written by an older
release, occasionally hand-edited into an invalid shape.

The record is preserved exactly as-is and skipped. Nothing is rewritten. If it
belonged to a thread you still care about, run `seedspec author review` and the
engine opens fresh work for that thread.

## Errors

### `AUTHORING_WORKSPACE_NOT_FOUND`

No package or workspace here or in any parent directory.

Discovery checks the current directory and walks **upward**. It never descends
into subdirectories, so running from one level above your package will not find
it.

```bash
# starting from nothing
npx @seedspec/cli init application --output my-package
cd my-package
npx @seedspec/cli author

# you already have a draft
npx @seedspec/cli author create ./my-package
```

`author create` adds authoring state around a directory that already exists. It
does not create package documents — use `init` for that.

### `AMBIGUOUS_AUTHORING_WORKSPACE`

More than one real workspace was found.

The engine resolves the common cases itself: a started workspace beside an
unstarted suggestion is not ambiguous, and archived siblings are skipped. This
error means two genuine workspaces are in play. Name the one you want:

```bash
npx @seedspec/cli author review ./my-package --state ./my-package-authoring
```

### `AUTHORING_STATE_INSIDE_PACKAGE`

The authoring state directory resolved to a location inside the package.

Authoring state is workspace state — drafts, questions, review records — and is
never part of the distributable package. Keep it as a sibling:

```text
my-solution/
├── seedspec/     the package that ships
└── authoring/    workspace state that does not
```

The conventional default is `<parent>/authoring` when the package directory is
named `seedspec`, and `<package>.seedspec-authoring` otherwise.

### `AUTHORING_WORKSPACE_MISMATCH`

The workspace describes a different package.

Either the package id changed after the workspace was created, or the workspace
was moved away from the package it tracks. An older state format is *not* a
mismatch — historical workspaces stay readable.

Confirm which package the workspace belongs to:

```bash
grep -A4 '^package:' <state>/workspace.yaml
```

### `INVALID_AUTHORING_RESULT`

The **open** pass record does not satisfy the result contract.

Only the active pass is validated; historical passes degrade to a notice. See
the exact contract:

```bash
npx @seedspec/cli author schema result
```

You should rarely see this. Use the recording commands rather than editing the
file directly:

```bash
echo '{"summary":"...","disposition":"improved"}' \
  | npx @seedspec/cli author reviewed --json -
```

### `AUTHORING_REVISION_CONFLICT`

The workspace changed between reading it and writing.

Expected on a shared workspace, and the intended protection: something else
wrote first, and blind retry would discard that write. Re-read, decide whether
your change still applies, and send it with the current revision.

```bash
npx @seedspec/cli author status --json   # .workspace.revision
```

Locally, omitting the revision skips the check.

### `AUTHORING_PASS_ACTIVE`

You asked for one thread while another is still open.

Close the current one, or let the engine pick:

```bash
echo '{"summary":"...","disposition":"good-enough"}' \
  | npx @seedspec/cli author reviewed --json -
npx @seedspec/cli author review          # no --area
```

`good-enough` and `not-relevant` close a thread as legitimately as `improved`.

### `NO_ACTIVE_AUTHORING_PASS`

A recording command ran with no open thread. Start one:

```bash
npx @seedspec/cli author review
```

### `UNKNOWN_AUTHORING_QUESTION`

No question with that id. The error lists the open ones; `author questions`
shows them with their text.

### `INVALID_AUTHORING_INPUT`

A recording payload is missing a required field. The details name each one.

Required by type: `finding` needs `source` and `assessment`; `inventory` needs
`item`; `contradiction` needs `claim_a` and `claim_b`; `suggestion` and
`tooling-feedback` need `summary`; `question` needs `question`. Ids are assigned
for you.

### `INVALID_AUTHORING_AREA` / `INVALID_AUTHORING_TARGET`

An unrecognized thread or coaching depth. Areas: `seed`, `coherence`,
`success`, `supporting-material`. Depths: `capture`, `shape` (default),
`harden`, `compose`, `package` — see `author guidance --topic depth`.

### `INVALID_AUTHORING_STATE`

A workspace file could not be parsed as YAML. The path and parse error are in
the details. This applies to `workspace.yaml`, `sources.yaml`, and
`open-questions.yaml`; malformed *pass* records degrade to a notice instead.

### `UNKNOWN_AUTHORING_GUIDANCE` / `UNKNOWN_AUTHORING_SCHEMA`

No such topic or schema. Run `author guidance` or `author schema` with no
argument to list them.

### `AUTHORING_LOCATION_NOT_FOUND`

The path given does not exist.

### Less common codes

| Code | Cause |
| --- | --- |
| `UNKNOWN_AUTHORING_PASS` | `--pass` named a pass that does not exist. `author history` lists them. |
| `AUTHORING_PASS_CLOSED` | `--pass` named a pass that already reached a terminal outcome. Omit `--pass` to act on the open one. |
| `AUTHORING_SOURCE_EXISTS` | A source with that id is already attached. Choose another id or leave it out and let one be assigned. |
| `AUTHORING_STATE_FILE_MISSING` | An expected workspace file is absent. `author create` restores the scaffolding without touching existing records. |
| `AUTHORING_STATE_NOT_READABLE` | A workspace file exists but could not be read — usually permissions. |
| `INVALID_PACKAGE_PATH` | The path is not a SeedSpec package directory or `seedspec.yaml`. |

### `UNSAFE_PACKAGE_CONTENT`

The package contains a symbolic link, an unsafe path, or a filename that cannot
travel portably. Package content must be ordinary files that survive being
archived and unpacked elsewhere.

## Getting unstuck

```bash
npx @seedspec/cli author status     # works even on an invalid draft
npx @seedspec/cli author history    # every pass and its outcome
npx @seedspec/cli author questions  # what is waiting on you
npx @seedspec/cli doctor --full     # verify the installation itself
```

`author status` is deliberately the most forgiving command. It reports what it
can and turns problems into diagnostics rather than failing, so there is always
a way to see the current state.
