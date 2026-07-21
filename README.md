# SeedSpec Protocol v0.1 Alpha

SeedSpec is an agentically composable protocol for packaging intent into
portable, agent-ready specifications. Each package describes what should be accomplished, provides
relevant context and resources, and defines the criteria for success while
leaving execution and implementation to the agent under the end user's
direction.

Its package format is a small declarative DSL; the larger SeedSpec contract is
a protocol because it also defines identity, composition, integrity, trust,
resolution, implementation handoff, and verification across tools and agents.

The protocol increases implementation fidelity without promising deterministic
agent execution or identical output. A realization may be a new application, a
feature adapted into an existing product, configured state in an external
system, an automation, an operational artifact, or a composite of those forms.

This design alpha contains the protocol schemas, authoring and resolution
toolchain, and small protocol-owned fixtures used to exercise conformance.
Independently versioned packages and their realized outputs live in
[SeedSpec/reference-solutions](https://github.com/SeedSpec/reference-solutions).

## Use the published CLI

Run the CLI without installing it globally:

```bash
npx @seedspec/cli --help
npx @seedspec/cli validate <package-path>
npx @seedspec/cli audit <package-path>
npx @seedspec/cli begin <package-path>
```

The npm packages use prerelease versions while the protocol remains a design
alpha. Pin exact versions when building tools that depend on its schemas or
runtime behavior.

## Work on the protocol

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
npx seedspec discover-features conformance/fixtures/comprehensive-application \
  --catalog conformance/fixtures/
```

Use `--configuration-selections <yaml>` to choose each selected package's exact example or a complete custom configuration. Omitting it preserves the examples as unreviewed placeholders and produces `status: needs-input`, never a ready project. Use `-i <profile>` or `--implementation <profile>` to record a strong preference among author-declared implementation profiles. When multiple profiles exist and none is preferred, the generated handoff requires the agent to explain them and ask the user which direction to take. Use `--completion-scope <yaml>` to select author acceptance material or record project-local observable criteria. `ready` describes implementation input, while `seedspec completion` independently reports verification progress. Use `--technical-preferences <yaml>` to record other non-product implementation preferences separately and `--artifact-selections <yaml>` to durably mark artifacts selected, declined, or deferred. A selected execution artifact still requires specific user direction before activation.

## What exists in v0.1 alpha

- A compact declarative package DSL with versioned JSON Schemas inside a wider
  handoff and composition protocol.
- Self-contained conformance fixtures for a comprehensive application,
  portable and revision-different features, and a workflow with several
  implementation profiles. These are test data, not reference packages.
- A generic `seedspec` CLI with a buyer-to-agent prompt, kind-aware authoring
  audits, bundled authoring guidance, read-only root-package bootstrap,
  validation, inspection, artifact adapters, feature discovery, resolution,
  and initialization.
- Kind-aware authoring lint that keeps advisory scope and completeness feedback
  separate from protocol validity.
- Authoring skills for application and feature packages, plus a beginner-facing `use-seedspec` lifecycle skill.
- A generic artifact model and explicit ProductSpec adapter backed by the official ProductSpec parser.
- Versioned capability contracts, provider candidates, compatibility statements,
  and conflicts that create implementation review context rather than dependency
  gates or compatibility verdicts.
- Kind hints for solutions, applications, features, workflows, automations,
  configurations, and integrations without kind-specific composition gates.
- Explicit configuration choices, implementation profiles, completion scopes and structured verification state, structured decisions, artifact dispositions, validated implementation-target guidance, content-addressed locks, agent handoff guidance, and durable deviation records.
- Author-controlled, independently versioned implementation resources with
  explicitly consulted package-scoped skills, target and capability context, verified canonical
  resolution, visible bundled fallbacks, and local use records.
- Tooling tests and a format conformance suite.

The layers and alpha boundary are summarized in [ARCHITECTURE.md](ARCHITECTURE.md). The protocol's decision principles are recorded in [docs/principles.md](docs/principles.md). [Use cases](docs/use-cases.md) include applications, configured SaaS systems, cross-system automations, composite enterprise solutions, and distribution models. The decision to keep those outcomes in one protocol is recorded in [ADR 0008](docs/decisions/0008-one-protocol-for-agent-realized-solutions.md); kind hints and implementation profiles are defined in [ADR 0009](docs/decisions/0009-kind-hints-and-implementation-profiles.md), with operational guidance in [kind-aware authoring](docs/kind-guidance.md) and [implementation profiles and state](docs/implementation-profiles.md). The artifact and ProductSpec boundary is documented in [docs/adapters.md](docs/adapters.md). The current format is described in [docs/protocol.md](docs/protocol.md) and [packages/protocol/schemas/v0.1/](packages/protocol/schemas/v0.1/).

Capability contracts and author-selected skills, instructions, verification,
tools, and target profiles are separated in
[docs/implementation-resources.md](docs/implementation-resources.md).

## Repository layout

```text
packages/
├── protocol/    canonical schemas and protocol metadata
├── runtime/     reference validation, resolution, and conformance library
└── cli/         the seedspec command-line interface
conformance/     portable conformance cases and fixtures
docs/            specification guidance and protocol decisions
skills/          authoring and implementation-handoff workflows
```

This repository contains protocol-owned assets and first-party protocol
tooling. Reference packages, realized solutions, websites, and marketplaces are
maintained as independent consumers.

## Concept flows

```text
idea + optional native artifacts
  -> SeedSpec root package
  -> addition discovery + product configuration
  -> resolved project specification
  -> user-directed agent handoff
  -> agent-realized solution + verification evidence
```

```text
existing project
  -> feature idea
  -> SeedSpec feature package
  -> updated resolved specification
  -> integration review
  -> implementation agent adapts the existing solution
```

```text
configured-system intent + optional realization guidance
  -> SeedSpec root package
  -> user-selected configuration and preferred implementation profile
  -> agent inspects authorized external systems
  -> configured state + automation + verification evidence
```

Manifest `kind` is a strong authoring and agent-communication hint, not a
composition gate. Resolution position determines root versus addition. The
profiled-workflow fixture verifies that multiple implementation profiles can
preserve one core intent without turning a fixture into a recommended solution.

## Validation and trust

```bash
npm run check
npm run conformance
```

Format conformance proves structure, digesting, and deterministic runtime
output. It does not make agent execution deterministic or prove publisher
identity, package safety, or realization quality.
