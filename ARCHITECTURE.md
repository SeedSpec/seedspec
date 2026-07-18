# SeedSpec Protocol Architecture

The SeedSpec Protocol packages **ideas and the artifacts that help turn them into software** while leaving implementation choices open. A SeedSpec package is a versioned, human-readable collection of product intent, configuration, capabilities, evidence, and optional related artifacts.

A SeedSpec package is deliberately not a starter repository. It does not normally select a programming language, framework, datastore, cloud, repository architecture, or deployment system.

## Five layers

1. **SeedSpec format** — the neutral package shape, schemas, composition hints, and validation contract.
2. **SeedSpec Authoring** — guided workflows that turn ideas into protocol-compliant application or feature packages.
3. **SeedSpec Runtime** — generic tools that validate, inspect, discover features and artifacts, configure, and resolve packages.
4. **Marketplaces and publishers** — independent distributors of packages whose commercial models remain outside the protocol.
5. **Implementation and integration** — replaceable coding agents interpret the handoff, adapt it to the actual repository, and record verification evidence.

```text
SeedSpec packages + product configuration + technical preferences
                              |
                              v
                 resolved project specification
                              |
                              v
                 replaceable execution engine
                              |
                              v
                    generated application
```

## Design principles

- Product intent over implementation detail.
- Separate intent, design, execution, and infrastructure.
- Package and relate artifacts without imposing one universal specification format.
- Discovery is not activation; artifact presence does not authorize an agent workflow.
- The end user directs the implementation agent.
- Official adapters add optional depth without becoming protocol dependencies.
- Handoff and lineage over permanent control of generated software.
- Markdown for behavior; structured data only for discovery, validation, configuration, and composition.
- Guided authoring over manual file construction.
- Configuration over package forks.
- Durable intent before code changes.
- Explicit capability requirements and provided capabilities.
- Capability versions as testing evidence and review signals, not installation gates.
- Agent adaptation over forced contract conformity.
- Portability without forced generality.
- Observable evidence over architectural prescription.
- Escape hatches for users who want to work directly in code.

The complete rationale and decision tests are in [docs/principles.md](docs/principles.md). Protocol-level adapter boundaries are recorded in [ADR 0002](docs/decisions/0002-artifacts-adapters-and-agent-choice.md).

## v0.1 alpha boundary

This repository tests the vision with one SeedSpec application package, two SeedSpec feature packages, authoring and beginner-use skills, a reference CLI, a generic artifact model, an official ProductSpec adapter, versioned capability contracts, deterministic handoff output, agent guidance, persistent implementation notes, and acceptance information.

The platform does not enforce what an agent builds. The resolved project supplies structured intent and evidence; the agent may map renamed concepts, revise architecture, add missing behavior, or adapt tests as needed. The application and its verification evidence determine whether the use case works.

The alpha intentionally excludes registries, marketplaces, signing, production deployment, universal generation engines, agent orchestration, and migration automation.
