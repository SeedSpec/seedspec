# SeedSpec Protocol Architecture

The SeedSpec Protocol packages **intent and the resources that help an agent
realize it** while leaving implementation choices open. A SeedSpec package is a
versioned, human-readable collection of intent, configuration, capabilities,
evidence, optional related artifacts, and optional author-selected
implementation resources.

The structured package format is a small declarative DSL. SeedSpec as a whole
is a protocol: it defines identity, composition, integrity, trust, resolution,
handoff, and verification behavior across independent tools and agents.

A SeedSpec package is deliberately not a starter repository or executable
workflow. It may suggest or require a target when the intended outcome depends
on one, but it does not otherwise select a programming language, framework,
datastore, cloud, repository architecture, deployment system, or execution
mechanism.

## Five layers

1. **SeedSpec format** — the neutral package DSL, kind hints, schemas, and validation contract.
2. **SeedSpec Authoring** — guided workflows that turn intent into protocol-compliant root or feature packages at an appropriate depth.
3. **SeedSpec Runtime** — generic tools that validate, inspect, discover features and artifacts, configure and resolve packages, and securely resolve author-selected implementation resources.
4. **Marketplaces and publishers** — independent distributors of packages whose commercial models remain outside the protocol.
5. **Implementation and integration** — replaceable agents interpret the handoff, adapt it to the actual environment, realize the selected outcome, and record verification evidence.

```text
SeedSpec packages + product configuration + implementation-profile preference + technical preferences
                              |
                              v
                 resolved project specification
                              |
                              v
                 replaceable execution engine
                              |
                              v
                  agent-realized solution
```

## Design principles

- Intent over deterministic execution.
- Specificity of intent is not prescription of execution.
- One protocol can describe software, configured systems, automations, operational artifacts, and composite solutions.
- Agentically composable packages and implementation profiles under end-user direction.
- Kind hints guide tools and agents without constraining root or addition roles.
- Core intent remains separate from candidate implementation profiles.
- Separate intent, design, execution, and infrastructure.
- Package and relate artifacts without imposing one universal specification format.
- Discovery is not activation; artifact presence does not authorize an agent workflow.
- Authors choose which versioned implementation resources travel with a package;
  agents inspect summaries and apply them against actual project and user context.
- The end user directs the implementation agent.
- Official adapters add optional depth without becoming protocol dependencies.
- Handoff and lineage over permanent control of a realized solution.
- Markdown for behavior; structured data only for discovery, validation, configuration, and composition.
- Guided authoring over manual file construction.
- Configuration over package forks.
- Durable intent before consequential changes.
- Explicit capability requirements and provided capabilities.
- Capability versions as testing evidence and review signals, not installation gates.
- Agent adaptation over forced contract conformity.
- Portability without forced generality.
- Observable evidence over architectural prescription.
- Escape hatches for users who want to work directly in code or a target system.

The complete rationale and decision tests are in [docs/principles.md](docs/principles.md). Protocol-level adapter boundaries are recorded in [ADR 0002](docs/decisions/0002-artifacts-adapters-and-agent-choice.md). The broader agent-realized solution scope is recorded in [ADR 0008](docs/decisions/0008-one-protocol-for-agent-realized-solutions.md); kind hints and implementation profiles are recorded in [ADR 0009](docs/decisions/0009-kind-hints-and-implementation-profiles.md) and illustrated in [docs/use-cases.md](docs/use-cases.md).

## v0.1 alpha boundary

This repository tests the vision with one software application root, one
configured-system and automation root, two feature packages, authoring and
beginner-use skills, a reference CLI, a generic artifact model, an official
ProductSpec adapter, versioned capability contracts, author-controlled
implementation-resource resolution, candidate implementation profiles,
deterministic handoff output, agent
guidance, persistent implementation notes, and acceptance information.

The platform does not enforce what an agent builds or changes. The resolved
project supplies structured intent and evidence; the agent may map renamed
concepts, revise an approach, add missing behavior, or adapt verification as
needed. The actual realized state and its evidence determine whether the use
case works.

The alpha intentionally excludes package registries, implementation-guidance catalog services and ranking, marketplaces, signing, production deployment, universal generation engines, agent orchestration, and migration automation.
