# SeedSpec Protocol v0.1 Alpha

SeedSpec gives people and implementing agents a portable package of ideas, product intent, configuration, integration context, testing information, and related artifacts. It helps them get partly or fully to a working application without prescribing or enforcing the application's final architecture or agent workflow.

This private alpha contains an **Allowance Tracker** SeedSpec application package, portable **Savings Goals** and **Chore Streaks** SeedSpec feature packages, and the authoring and resolution toolchain.

## Try the working use case

```bash
npm install
npm test
npm run conformance
npm run demo
```

The demo creates `.tmp/allowance-demo/.seedspec/` with a human-readable resolved specification, validated configuration, a preserved artifact index, capability revision reviews, agent guidance, persistent implementation notes, verification-report scaffolding, and feature integration records.

Inspect the source packages:

```bash
npx seedspec prompt
npx seedspec begin examples/allowance-tracker
npx seedspec inspect examples/allowance-tracker
npx seedspec inspect examples/savings-goals
npx seedspec inspect examples/chore-streaks
npx seedspec digest examples/allowance-tracker
npx seedspec artifacts examples/allowance-tracker
npx seedspec validate-artifact examples/allowance-tracker product-spec
npx seedspec discover-features examples/allowance-tracker --catalog examples/
```

Resolve only the application:

```bash
npx seedspec resolve examples/allowance-tracker --output .tmp/allowance-only
```

Resolve it with both features:

```bash
npx seedspec resolve examples/allowance-tracker \
  --feature examples/savings-goals \
  --feature examples/chore-streaks \
  --output .tmp/allowance-composed

npx seedspec verify-lock .tmp/allowance-composed \
  --package examples/allowance-tracker \
  --package examples/savings-goals \
  --package examples/chore-streaks
```

Use `--config <yaml>` to override application configuration, `--feature-config <package-id>=<yaml>` for a feature, `--technical-preferences <yaml>` to record non-product implementation preferences separately, and `--artifact-selections <yaml>` to durably mark artifacts selected, declined, or deferred. A selected execution artifact still requires specific user direction before activation.

## What exists in v0.1 alpha

- A compact package format with versioned JSON Schemas.
- Complete Allowance Tracker, Savings Goals, and Chore Streaks packages.
- A generic `seedspec` CLI with a buyer-to-agent prompt, read-only application bootstrap, validation, inspection, artifact adapters, feature discovery, resolution, and initialization.
- Authoring skills for application and feature packages, plus a beginner-facing `use-seedspec` lifecycle skill.
- A generic artifact model and explicit ProductSpec adapter backed by the official ProductSpec parser.
- Versioned capability contracts, provider candidates, compatibility statements,
  and conflicts that create implementation review context rather than dependency
  gates or compatibility verdicts.
- Structured decisions, artifact dispositions, validated implementation-target guidance, content-addressed locks, agent handoff guidance, and durable deviation and verification records.
- Tooling tests and a format conformance suite.

The layers and alpha boundary are summarized in [ARCHITECTURE.md](ARCHITECTURE.md). The protocol's decision principles are recorded in [docs/principles.md](docs/principles.md). The artifact and ProductSpec boundary is documented in [docs/adapters.md](docs/adapters.md). The current format is described in [docs/protocol.md](docs/protocol.md) and [packages/protocol/schemas/v0.1/](packages/protocol/schemas/v0.1/).

## Repository layout

```text
packages/
├── protocol/    canonical schemas and protocol metadata
├── runtime/     reference validation, resolution, and conformance library
└── cli/         the seedspec command-line interface
conformance/     portable conformance cases and fixtures
docs/            specification guidance and protocol decisions
examples/        neutral example application and feature packages
skills/          authoring and implementation-handoff workflows
```

This repository contains protocol-owned assets and first-party protocol tooling. Websites, marketplaces, and runnable reference applications are maintained as independent consumers.

## Concept flows

```text
idea + optional native artifacts
  -> SeedSpec application package
  -> feature discovery + product configuration
  -> resolved project specification
  -> user-directed agent handoff
  -> working application + verification evidence
```

```text
existing project
  -> feature idea
  -> SeedSpec feature package
  -> updated resolved specification
  -> integration review
  -> coding agent adapts the existing application
```

## Validation and trust

```bash
npm run check
npm run conformance
```

Format conformance proves structure, digesting, and deterministic handoff behavior. It does not prove publisher identity, package safety, or implementation quality.
