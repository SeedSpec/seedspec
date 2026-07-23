# SeedSpec

**Protocol 0.1 design alpha**

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
| **SeedSpec Authoring** | Guided audits, skills, and frontends help authors capture intent, expose material ambiguity, record decision provenance, and prepare a useful handoff. |
| **SeedSpec Protocol** | The package and handoff contract defines semantic roles, identity, configuration, composition, integrity, resolution, and scoped verification state. |
| **SeedSpec Runtime and CLI** | Reference tools validate, inspect, author, configure, resolve, and prepare packages for an agent without executing package content implicitly. |
| **Publishers, libraries, and marketplaces** | Independent distribution systems curate packages, versions, evidence, support, and policy without changing the neutral package contract. |
| **Implementation environments** | User-chosen agents and tools adapt resolved intent to a real codebase, external system, workflow, or other target and record scoped evidence. |

The normative SeedSpec Protocol lives in this repository as
[`@seedspec/protocol`](packages/protocol/README.md), the [Protocol 0.1
specification](docs/protocol.md), the [versioned schemas](packages/protocol/schemas/v0.1/),
and the [conformance suite](conformance/cases.yaml). The former
`SeedSpec/seedspec-protocol` preview repository is retired; this repository is
the canonical source for both the protocol and first-party tooling.

## What the different results mean

- A **valid package** satisfies protocol structure and semantic validation. It
  is not automatically a strong or complete seed.
- A **completed authoring review** records that the requested review areas were
  examined. It does not eliminate every unknown or certify quality.
- A **resolved handoff** preserves selected package material, user choices, and
  provenance for one implementation context. It does not prove the guidance was
  followed.
- A **verified completion result** applies only to its declared scope and
  recorded evidence. It is not a universal certification of the package or
  realization.

## Use a published package

Run the current design-alpha CLI without installing it globally:

```bash
npx --yes @seedspec/cli@next --help
npx --yes @seedspec/cli@next version
npx --yes @seedspec/cli@next validate <package-path>
npx --yes @seedspec/cli@next begin <package-path>
```

`seedspec begin` is the read-only starting point for an agent. It validates the
package, inventories the available intent and supporting material, explains the
trust boundary, and identifies the user choices needed before resolution or
implementation.

The `next` tag identifies the current public design-alpha CLI. Pin exact
prerelease versions when building integrations that depend on schemas,
conformance behavior, or runtime output.

## Author a package

SeedSpec authoring is intended to be guided rather than a requirement to
hand-edit every YAML and JSON file:

```bash
npx --yes @seedspec/cli@next init application --output <package-path>
npx --yes @seedspec/cli@next audit <package-path>
npx --yes @seedspec/cli@next lint <package-path>
npx --yes @seedspec/cli@next validate <package-path>
```

The audit workflow combines deterministic protocol checks with agent-guided
semantic review. It helps separate concerns, apply a kind-aware lens, identify
material ambiguity, record decision provenance, check internal consistency,
harden the seed progressively, and review the independent handoff. The CLI does
not embed a model or silently rewrite package content.

See [authoring guidance](docs/authoring.md), [kind-aware authoring](docs/kind-guidance.md),
and the bundled authoring skills under [`skills/`](skills/).

## Work in this repository

```bash
npm install
npm test
npm run conformance
```

Inspect representative conformance fixtures:

```bash
npx seedspec prompt
npx seedspec begin conformance/fixtures/comprehensive-application
npx seedspec inspect conformance/fixtures/comprehensive-application
npx seedspec inspect conformance/fixtures/portable-feature
npx seedspec lint conformance/fixtures/profiled-workflow
npx seedspec artifacts conformance/fixtures/comprehensive-application
npx seedspec validate-artifact conformance/fixtures/comprehensive-application product-spec
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

## What exists in v0.1 alpha

- A compact declarative package format inside a wider handoff and composition
  protocol.
- Kind-aware authoring audits, bundled guidance, package scaffolding, linting,
  and authoring skills.
- A generic CLI and JavaScript runtime for validation, inspection, authoring,
  artifact adapters, discovery, configuration, resolution, locks, and scoped
  completion checks.
- One package-author primary intent source plus separately preserved end-user
  applied intent and agent proposals.
- Configuration choices, decision provenance, implementation profiles,
  implementation resources, ordered task runbooks, completion plans, typed
  evidence, and durable deviation records.
- Versioned capability contracts with structured history, review severity, and
  optional digest-bound conformance material.
- A generic artifact model and an explicit ProductSpec adapter without making
  ProductSpec a core dependency.
- Self-contained protocol fixtures, tooling tests, and a format conformance
  suite.

The [architecture](ARCHITECTURE.md) explains how these pieces fit together. The
[principles](docs/principles.md), [glossary](docs/glossary.md), [use
cases](docs/use-cases.md), and [versioning guide](docs/versioning.md) explain the
design boundaries. Normative behavior is defined only by the [protocol
specification](docs/protocol.md), [schemas](packages/protocol/schemas/v0.1/), and
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
- [SeedSpec/seedspec-marketplace](https://github.com/SeedSpec/seedspec-marketplace)
  explores distribution without making marketplace policy part of the protocol.

## Concept flow

```text
source idea, expertise, or existing solution
  -> guided SeedSpec authoring
  -> versioned SeedSpec package
  -> end-user fit, configuration, and implementation choices
  -> resolved project handoff
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
