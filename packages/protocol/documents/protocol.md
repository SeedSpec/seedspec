# SeedSpec Protocol 0.4

Status: experimental

Protocol 0.4 packages authored specification prose with a small set of
tool-readable declarations. `SPEC.md` is the required package entrypoint.

## Package structure

The minimum package is:

```text
SPEC.md
```

Optional protocol locations are:

```text
SPEC.md
seedspec.yaml
README.md
configuration/
success/
tasks/
capabilities/
formats/
context-modules/
bundled-packages/
```

`SPEC.md` contains optional YAML frontmatter and nonempty Markdown prose. The
prose has no required headings or section structure.

## Package fields

The minimum manifest is:

```yaml
id: daily-report
name: Daily report
version: "1.0.0"
```

Required fields are:

- `id`: stable author-chosen package identifier;
- `name`: human-readable package name; and
- `version`: semantic package version.

Identifiers can contain lowercase letters, numbers, hyphens, and periods.
Namespacing is allowed but not required. Identifier syntax does not establish
publisher authority or namespace ownership.

Optional package fields are:

```yaml
kind: application
target_protocol: "0.4"
description: Produces and delivers a daily report.
metadata:
  license: MIT
  homepage: https://example.com/daily-report
  repository: https://github.com/example/daily-report
  documentation: https://docs.example.com/daily-report
```

When `target_protocol` is present, the runtime validates it against the selected
protocol family. When absent, the tool uses its current protocol family. A
validation or publication receipt records the exact protocol release used.

`kind` is an optional package-shape hint. Built-in values are:

```text
solution
application
feature
component
workflow
automation
configuration
integration
```

Custom kinds use the same identifier syntax. A kind affects authoring prompts,
grouping, and presentation only. It does not impose kind-specific validity
rules or determine composition position. Omitting it is valid.

Metadata is descriptive. It does not prove license validity, publisher
identity, repository ownership, or document trust.

## Manifest sources

Tools load manifest sources in this order:

1. Load root `seedspec.yaml` when it exists.
2. Load YAML frontmatter from root `SPEC.md`.
3. Merge the frontmatter over the base manifest.
4. Validate the resolved manifest.

Mappings merge recursively. Frontmatter arrays, scalars, YAML `null`, and
mismatched types replace the base value. Arrays never merge by identity,
position, or inferred meaning.

Each source must contain a YAML mapping. Duplicate YAML keys are invalid. The
resolved manifest must contain every required package field.

All paths resolve from the package root. The package digest covers both
manifest sources and all other package files.

## Inline collections and sections

Configuration, success, tasks, and capabilities use one expansion rule.

A subject contains its inline collection or `sections`. It cannot contain both.
Each section contains its inline collection or `path`. It cannot contain both.
Sections cannot contain sections.

Example:

```yaml
tasks:
  sections:
    - id: setup
      name: Setup
      items:
        - id: initialize
          instruction: Initialize the project.
    - id: delivery
      path: tasks/delivery.yaml
```

`tasks/delivery.yaml` contains only:

```yaml
items:
  - id: deploy
    instruction: Deploy the project.
```

Tools insert external items at the section position. Section names affect
presentation only. Sections do not create namespaces, dependencies, or
execution branches.

| Subject | Collection | Directory |
| --- | --- | --- |
| Configuration | `variables` | `configuration/` |
| Success | `criteria` | `success/` |
| Tasks | `items` | `tasks/` |
| Capabilities | `items` | `capabilities/` |

External section files must use YAML and contain only the expected collection.

## Configuration

Configuration declares selectable package inputs:

```yaml
configuration:
  variables:
    - id: frequency
      name: Frequency
      description: Frequency used to generate the report.
      type: string
      required: true
      default: daily
      example: weekly
      options: [daily, weekly]

    - id: recipients
      description: Destinations that receive the report.
      type: array
      items:
        type: string
      default: [operations]
```

Each variable requires `id`, `type`, and `description`. `name`, `required`,
`default`, `example`, `options`, and array `items` are conditional or optional.

Supported types are `string`, `integer`, `number`, `boolean`, and `array`.
Array item types are limited to the four scalar types. Nested structured object
configuration is outside the 0.4 core.

`required` defaults to `false`. A default is intended behavior when the user
does not supply a value. An example is illustrative. Defaults, examples, and
options must match the declared type. A default must appear in `options` when
options exist.

Selected project values are project state. They are not written into the
package.

## Success criteria

Success criteria are structured acceptance claims:

```yaml
success:
  criteria:
    - id: configured-destination
      description: The report is delivered to the configured destination.
```

A criterion has `id` and `description`. It defines what must be true. It does
not define an evaluation method or provide evidence that the claim is true.

### Prose anchors

The `SPEC.md` body can connect prose to a criterion:

```markdown
## Delivery [success:configured-destination]

Send the completed report to the configured destination.
```

The marker grammar is:

```text
[success:<criterion-id>]
```

An anchor in a heading applies to that section. An anchor in another Markdown
block applies to that block. Multiple anchors can reference one criterion, and
one block can reference multiple criteria.

Anchors inside fenced code, indented code, inline code, or escaped text are
ignored. Every recognized anchor must resolve to a declared criterion. A
criterion without an anchor remains valid and appears as an authoring or
inspection warning.

An anchor connects authored meaning. It does not direct code placement,
establish implementation conformance, or provide verification evidence.

## Capabilities

Capabilities describe observable package functionality:

```yaml
capabilities:
  items:
    - id: daily-summary
      name: Daily summary
      description: Produces and delivers a daily operational summary.
      outcomes:
        - id: delivery
          description: Delivers the report to the configured destination.
      success_criteria:
        - configured-destination
```

A capability requires `id`, `name`, and `description`. `outcomes` and
`success_criteria` are optional. Each outcome requires `id` and `description`.
Criterion references must resolve locally.

Capability IDs are package-local. Capabilities have no independent versions.
Their provenance is the declaring package ID, package version, and package
digest.

Protocol 0.4 does not define `provides` and `requires` capability sides or a
universal capability ontology. Requirements on external systems remain in the
specification prose.

## Tasks

Tasks provide ordered implementation guidance:

```yaml
tasks:
  items:
    - id: implement-summary
      instruction: Implement the daily summary.
      capabilities: [daily-summary]
      success_criteria: [configured-destination]
```

A task requires `id` and `instruction`. Capability and criterion references are
optional and must resolve locally.

Task order is significant. Tasks do not define dependencies, parallel
execution, retries, or branching. Profile-specific procedures belong in the
selected implementation-profile module.

## Context modules

Context modules provide addressable supporting Markdown:

```yaml
context_modules:
  - id: delivery-evaluation
    type: evaluation
    description: Evaluates report delivery.
    path: context-modules/delivery-evaluation/EVAL.md
    format:
      id: evaluation-format
      version: "1"
      path: formats/evaluation-format.md
      url: https://example.com/evaluation-format
    applies_to:
      stages: [verification]
      capabilities: [daily-summary]
      success_criteria: [configured-destination]
```

Every module requires `id`, `type`, `description`, and `path`. Supported types
are:

```text
intent
skill
behavior
evaluation
policy
reference
implementation-profile
```

The path points directly to a Markdown entrypoint under `context-modules/`.
Its parent directory is the module root. Skill modules use `SKILL.md`.
Implementation profiles use `PROFILE.md`. Other types can use any Markdown
filename.

`format` is optional. When present, it requires an identifier and can include a
version, local documentation under `formats/`, and an HTTPS documentation URL.
Format IDs are dispatch hints, not URLs. Tools must never fetch a format URL
automatically. Declaring a format does not install or authorize tools.

`applies_to` is optional. Its supported dimensions are lifecycle `stages`,
local `capabilities`, and local `success_criteria`. Values within one dimension
use OR. Present dimensions combine with AND. An omitted dimension is
unrestricted.

### Implementation profiles

An implementation profile is a context module:

```yaml
context_modules:
  - id: cloudflare-worker
    type: implementation-profile
    description: Realize the specification on Cloudflare Workers.
    path: context-modules/cloudflare-worker/PROFILE.md
```

`PROFILE.md` is unrestricted Markdown. It has no required frontmatter,
headings, or sections. A harness can use headings as progressive-disclosure
boundaries, but heading names have no protocol-defined meaning.

Tooling presents profiles as selectable implementation directions. A selected
profile is project state. It is not written back into the package. Profile
scripts remain untrusted and require separate execution authorization.

## Bundled packages

Bundled packages are independently valid SeedSpec packages:

```yaml
bundled_packages:
  - id: authentication
    version: "2.4.0"
    digest: sha256:...
    path: bundled-packages/authentication/SPEC.md
    optional: true
```

Each declaration requires `id`, `version`, `digest`, and `path`. `optional`
defaults to `false`.

The declaration must match the child's package ID, version, and digest. The
child validates independently and can contain its own base manifest and nested
children. Duplicate package IDs with different versions or digests are invalid
within one resolved package tree.

An optional child is available for selection but is not automatically part of
the intended realization. Selection is project state. The parent package digest
still protects optional child bytes.

The parent does not repeat a child's configuration, success criteria, tasks,
capabilities, context modules, or metadata.

## Extensions

Unknown fields in protocol-owned objects are invalid. Experimental values use
the root `extensions` mapping:

```yaml
extensions:
  com.example.experiment:
    value: provisional
```

Extension keys require a namespaced identifier. SeedSpec validates the key but
does not interpret the value.

## Deliberately absent fields

Protocol 0.4 does not define root fields for:

- compatibility;
- decisions;
- conflicts;
- integration points; or
- implementation profiles.

Authors express compatibility, decisions, conflicts, and integration needs in
the specification prose. Implementation profiles use context modules.

## Validation boundary

Validation establishes structure, paths, deterministic resolution, IDs,
references, versions, digests, anchors, and bundled-child validity.

Validation does not prove prose completeness, implementation conformance,
capability usefulness, publisher authority, remote document trustworthiness,
or verification evidence.

## Resolved views

`seedspec inspect <package> --json` reports resolved declarations, source
locations, overrides, section expansion, anchors, unanchored criteria, and
bundled provenance.

`seedspec flatten <package>` writes resolved frontmatter followed by the
original Markdown body. The output includes the source package digest in a YAML
comment. Review it before replacing authored sources.

## Release behavior

`target_protocol: "0.4"` identifies the intended family when declared. The
installed runtime supplies the exact schema. During the alpha, 0.4.x releases
can change accepted fields. Revalidate packages after every runtime update.

Protocol 0.4 does not parse Protocol 0.3 packages.
