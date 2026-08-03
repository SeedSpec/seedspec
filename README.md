# SeedSpec

**Experimental**

SeedSpec helps people turn product and domain expertise into portable,
agent-ready starting points. A SeedSpec package keeps the intended outcome,
important decisions, adopter choices, supporting context, and ways to check
success together so another person or agent does not have to reconstruct them
from a prompt, chat history, or informal document.

SeedSpec is more than its package format. The project includes guided authoring
tools that help authors find material gaps, an open protocol that gives package
content stable semantic roles, and reference tooling that validates, resolves,
and hands the selected material to an implementing agent. The agent and end user
still decide how to realize the outcome in the actual environment.

The protocol makes a seed portable and interpretable. It does not certify that
the seed is complete or guarantee a particular implementation. Authoring review,
package conformance, and realization evidence are deliberately separate claims.

## Why semantic structure matters

SeedSpec distinguishes:

- **Product intent** — what must be true.
- **Configuration** — what the adopter may choose.
- **Decisions and provenance** — who selected what, and why.
- **Acceptance** — how success should be evaluated.
- **Implementation resources and tasks** — guidance about how to do the work.
- **Evidence** — what has actually been observed or verified.

A model can receive all of that in one Markdown file, and a well-authored
Markdown specification can be excellent. Without standardized roles, however,
each recipient must rediscover which passages are authoritative, which values
are examples, which decisions remain open, what applies to this adopter, and
what constitutes evidence.

Semantic structure helps people and models preserve meaning across authoring,
review, distribution, adaptation, and implementation. File structure alone is
not the advantage; the value comes from the meaning assigned to each concern
and the authoring workflow that helps populate it. See [why semantic structure
matters](docs/semantic-structure.md) and the [current evaluation
findings](docs/evaluations.md).

## The SeedSpec system

| Layer | Role |
| --- | --- |
| **SeedSpec Authoring** | Source-bound conversations, skills, and frontends help authors clarify the seed they supplied, resolve contradictions, define observable success, and understand included supporting material. |
| **SeedSpec Protocol** | The package and handoff contract defines semantic roles, identity, configuration, composition, integrity, resolution, and scoped verification state. |
| **SeedSpec Runtime and CLI** | Reference tools validate, inspect, author, configure, resolve, and prepare packages for an agent without executing package content implicitly. |
| **Implementation environments** | User-chosen agents and tools adapt resolved intent to a real codebase, external system, workflow, or other target and record scoped evidence. |

Portability, independent verification, and neutrality are baseline properties
of every SeedSpec package. They apply regardless of who authored the package,
how it is shared, or where it is used.

Start with the [SeedSpec language definition](docs/01-language.md). It defines
the protocol's concepts, authority model, processing lifecycle, operations, and
claim boundaries before the package specification supplies exact field-level
rules.

The normative SeedSpec Protocol lives in this repository as
[`@seedspec/protocol`](packages/protocol/README.md), the [protocol
specification](docs/protocol.md), the [versioned schemas](packages/protocol/schemas/),
and the [conformance suite](conformance/cases.yaml). The former
`SeedSpec/seedspec-protocol` preview repository is retired; this repository is
the canonical source for both the protocol and first-party tooling.

## What the different results mean

- A **valid package** satisfies protocol structure and semantic validation. It
  is not automatically a strong or complete seed.
- A **reviewed authoring area** records that the author improved it, accepted
  it as good enough, or marked it irrelevant. It does not eliminate unknowns or
  certify quality.
- A **resolved handoff** preserves selected package material, user choices, and
  provenance for one implementation context. It does not prove the guidance was
  followed.
- A **prepared context bundle** records what was selected for one request and
  how each module was prepared. It does not prove that the content was followed.
- A **verified completion result** applies only to its declared scope and
  recorded evidence. It is not a universal certification of the package or
  realization.

## Use a published package

Run the CLI without installing it globally:

```bash
npx @seedspec/cli --help
npx @seedspec/cli version
npx @seedspec/cli begin <package-path-or-github-url>
npx @seedspec/cli prompt <package-path-or-github-url>
npx @seedspec/cli shell <package-path-or-github-url>
```

`seedspec begin` is the read-only starting point for an agent. It validates the
package, inventories the available intent and supporting material, explains the
trust boundary, and identifies the user choices needed before resolution or
implementation.

`seedspec shell` retains one validated package for repeated inspection,
deterministic documentation search, and exact section retrieval. Add `--jsonl`
for a prompt-free agent stream. The session remains read-only.

`seedspec prompt` prints a short handoff a person can paste into ChatGPT,
Codex, Claude, or another agent. A tool-capable agent follows it by running
`npx @seedspec/cli begin ...`, which supplies the complete version-matched work
order. The recipient does not need to install a SeedSpec skill or add anything
to its PATH.

The npm `latest` tag selects the default published CLI version. Human-facing
examples use that default. Tests, automation, and reproducible integrations
should pin an exact version and may add `--yes` to avoid npm's first-run
confirmation.

## Author a package

Start from nothing:

```bash
npx @seedspec/cli init application --output my-package
cd my-package
npx @seedspec/cli author
```

The [quickstart](docs/quickstart-authoring.md) walks through that path end to
end, and the [worked example](docs/worked-example.md) shows a rough seed
becoming a strong one.

`author` discovers the local draft and review state, reports the current work,
and suggests the next command. Run it inside a project containing
`seedspec.yaml`, a conventional `seedspec/` package, or an existing authoring
workspace; explicit paths remain available for automation and unusual layouts.

Authoring is guided rather than a requirement to hand-edit YAML and JSON. The
agent records through operations that validate and write durable state:

```bash
npx @seedspec/cli author record --json -         # findings, questions, inventory
npx @seedspec/cli author answer --json -         # the author's answer, or a decline
npx @seedspec/cli author attach-source --json -  # material the review may cite
npx @seedspec/cli author propose --json -        # exact before/after document bytes
npx @seedspec/cli author decide --json -         # explicit author acceptance or rejection
npx @seedspec/cli author apply --json -          # engine application of an accepted proposal
npx @seedspec/cli author reviewed --json -       # close a thread
```

The authoring workflow combines deterministic protocol checks with agent-guided
semantic review. The CLI does not embed a model or silently rewrite package
content. Proposed document replacements remain workspace state until the author
accepts them and the engine applies them against unchanged bytes.
The author can reject an accepted but unapplied proposal without losing its
earlier decision record.
`npx @seedspec/cli author prompt` prints the short prompt a person gives
an agent; the full review output then supplies the self-contained operating
brief. Its review threads stay private while the author gets a short, natural
conversation about the seed. The `--summary` option is the shorter human-facing
CLI form. The front door may offer a bundled project-local authoring skill, but
it must ask before exporting it and the skill is never required.

See the [documentation index](docs/README.md), [authoring guidance](docs/authoring.md),
[kind-aware authoring](docs/kind-guidance.md), [preparing and
publishing](docs/publishing.md), [authoring errors](docs/authoring-errors.md),
and the bundled authoring skills under [`skills/`](skills/).

## Work in this repository

```bash
npm install
npm test
npm run conformance
```

Produce a release-bound machine-readable report or verify the installed
toolchain:

```bash
npx seedspec conformance --json --output conformance-report.json
npx seedspec doctor --full
npx seedspec docs implementing
```

Inspect representative conformance fixtures:

```bash
npx seedspec prompt
npx seedspec begin conformance/fixtures/comprehensive-application
npx seedspec inspect conformance/fixtures/comprehensive-application
npx seedspec inspect conformance/fixtures/portable-feature
npx seedspec lint conformance/fixtures/profiled-workflow
npx seedspec artifacts conformance/fixtures/comprehensive-application
npx seedspec capability-conformance conformance/fixtures/comprehensive-application \
  org.seedspec.core.chores
npx seedspec discover-features conformance/fixtures/comprehensive-application \
  --catalog conformance/fixtures/
```

Use `--applied-intent <yaml>` to record whether each selected package applies as
authored, requires adaptation, or is only partially useful. Use
`--configuration-selections <yaml>` to select an example or supply complete
custom configuration for every package. Implementation profiles, technical
preferences, optional artifacts, completion scope, and evidence remain explicit
inputs or state rather than assumptions hidden in resolution. See [runtime
behavior](docs/runtime.md) for the complete lifecycle.

## Project scope

- A compact declarative package format inside a wider handoff and composition
  protocol.
- Four private source-bound authoring threads, bundled guidance, minimal
  seed-and-success scaffolding, linting, and authoring skills.
- A resumable preparation workflow, independent-agent evaluation workspace,
  publish gate, deterministic package archive, and digest-bound sidecars.
- A generic CLI and JavaScript runtime for validation, inspection, authoring,
  format integrations, context preparation, discovery, configuration,
  resolution, locks, receipts, and scoped completion checks.
- One package-author primary intent module plus separately preserved end-user
  applied intent and agent proposals.
- Configuration choices, decision provenance, implementation profiles,
  implementation resources, context modules with bridge Skills, ordered task
  runbooks, completion plans, typed evidence, and durable deviation records.
- Versioned capability contracts with structured history, review severity, and
  optional digest-bound conformance material.
- Passive supporting artifacts plus a unified context-module and adapter model
  without bundling any external semantic format into the core runtime.
- Self-contained protocol fixtures, tooling tests, and a format conformance
  suite.

The [architecture](ARCHITECTURE.md) explains how these pieces fit together. The
[principles](docs/principles.md), [glossary](docs/glossary.md), [use
cases](docs/use-cases.md), and [versioning guide](docs/versioning.md) explain the
design boundaries. [Context modules](docs/context-modules.md) explain the
shared discovery and bridge model. Normative behavior is defined only by the [protocol
specification](docs/protocol.md), [schemas](packages/protocol/schemas/), and
[conformance contract](conformance/cases.yaml).

## Repository layout

```text
packages/
├── protocol/    canonical schemas and protocol metadata
├── runtime/     authoring, validation, resolution, and conformance library
└── cli/         the seedspec command-line interface
conformance/     portable conformance cases and fixtures
docs/            specification, guidance, use cases, evidence, and rationale
skills/          authoring and implementation-handoff workflows
```

Related public repositories remain independent so their claims and release
cycles do not become protocol requirements:

- [SeedSpec/reference-solutions](https://github.com/SeedSpec/reference-solutions)
  contains complete example packages and realized outputs.
- [SeedSpec/seedspec-evals](https://github.com/SeedSpec/seedspec-evals)
  contains evaluation cases, harnesses, methods, and evidence.

## Concept flow

```text
source idea, expertise, or existing solution
  -> guided SeedSpec authoring
  -> versioned SeedSpec package
  -> end-user fit, configuration, and implementation choices
  -> resolved project handoff
  -> request-specific context bundle
  -> user-directed implementing agent
  -> realization + scoped evidence
```

A package may describe a new application, a feature adapted into an existing
product, configured state in an external system, an automation, an operational
artifact, or a composite outcome. See [use cases](docs/use-cases.md) for both
realization patterns and distribution models.

## Validation and trust

```bash
npm run check
npm run conformance
```

Format conformance proves structure, digesting, and deterministic runtime output
for fixed inputs. It does not make agent execution deterministic or prove
publisher identity, package safety, semantic completeness, compatibility with
an unseen environment, or realization quality.
