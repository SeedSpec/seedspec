# SeedSpec architecture

> **Informative architecture.** This document explains the SeedSpec system and
> the protocol's place within it. The normative contract begins with the
> language definition and is bound by the exact protocol release across the
> package specification, operation contracts, schemas, and conformance corpus.

SeedSpec helps people turn product and domain expertise into reusable,
agent-ready starting points. The system combines guided authoring, a portable
package protocol, reference runtime and CLI tooling, independent distribution,
and user-directed implementation.

The **SeedSpec Protocol** is the interoperability layer inside that system. A
SeedSpec package is a versioned, human-readable collection of package-author
intent, configuration, capabilities, package evidence, optional related
artifacts, ordered implementation task runbooks, and implementation resources.
The protocol defines their semantic roles, identity, composition, integrity,
resolution, handoff, and verification state across independent tools.
Resolution adds end-user applied intent and keeps baseline, realization, and
outcome evidence attached to the claims they can establish.

Guided authoring is a separate value layer. It helps an author identify material
ambiguity, distinguish fixed intent from adopter or agent choices, attach
evidence to the right claims, and prepare a coherent handoff. A package can be
valid without being complete or strong, and an excellent specification can
exist before it is packaged as a SeedSpec.

A SeedSpec package is deliberately not a starter repository or executable
workflow. It may suggest or require a target when the intended outcome depends
on one, but it does not otherwise select a programming language, framework,
datastore, cloud, repository architecture, deployment system, or execution
mechanism.

## Why the structure carries meaning

SeedSpec assigns stable semantic ownership to concerns that are easily blended
in an informal document:

- **Product intent** records what must be true.
- **Configuration** records what an adopter may choose.
- **Decisions and provenance** record who selected what and why.
- **Acceptance** records how success should be evaluated.
- **Implementation resources and tasks** provide subordinate guidance about how
  to do the work.
- **Evidence** records what has actually been observed or verified.

These concerns can be expressed clearly in one Markdown document. Packaging
becomes valuable when the material must cross authors, teams, agents, projects,
or time: recipients can discover the same semantic roles without rediscovering
authority, examples, open decisions, applicability, and evidence boundaries.
See [why semantic structure matters](docs/semantic-structure.md).

## Five system layers

1. **SeedSpec Authoring** — guided workflows help an author capture source
   material, find consequential gaps, establish semantic ownership, and produce
   a package at an honest depth.
2. **SeedSpec Protocol** — the neutral package and handoff contract defines
   roles, identity, schemas, validation, composition, integrity, and state.
3. **SeedSpec Runtime and CLI** — generic tools validate, inspect, audit,
   discover, configure, resolve, and prepare packages without implicitly
   executing package content.
4. **Libraries, publishers, and marketplaces** — independent distributors
   curate exact packages, versions, evidence, support, and policy outside the
   neutral protocol.
5. **Implementation and integration** — replaceable agents interpret the
   handoff, adapt it to the actual environment, realize the selected outcome,
   and record scoped evidence under end-user direction.

```text
source idea, expertise, or existing solution
                              |
                              v
                   guided SeedSpec authoring
                              |
                              v
                versioned SeedSpec package
                              |
                              v
        applied intent + product configuration + preferences
                              |
                              v
          resolved project specification + verification plan
                              |
                              v
             replaceable agent + implementation environment
                              |
                              v
          agent-realized solution + scoped evidence
```

## Three separate quality questions

| Question | Primary owner | What the result establishes |
| --- | --- | --- |
| Can an independent tool interpret this package? | Protocol, schemas, and conformance tooling | Package validity and interoperable structure for the declared version. |
| Does the seed communicate the important intent well? | Author, authoring workflow, and reviewers | An evidence-informed quality judgment, not a protocol-conformance result. |
| Did this implementation satisfy the selected intent? | End user, implementing agent, and evaluators | A scoped completion result supported by realization or outcome evidence. |

Keeping these questions separate lets SeedSpec provide strict distribution and
handoff behavior without turning package validity into a correctness promise.

## Design principles

- Intent over deterministic execution.
- Specificity of intent is not prescription of execution.
- Stable semantic ownership over accidental document layout.
- Guided authoring over manual file construction or format-valid emptiness.
- One protocol can describe software, configured systems, automations,
  operational artifacts, and composite solutions.
- Agentically composable packages and implementation profiles under end-user
  direction.
- Kind hints guide tools and agents without constraining root or addition roles.
- Core intent remains separate from candidate implementation profiles.
- Package-author intent remains distinguishable from end-user applied intent
  and agent proposals.
- Separate intent, design, execution, and infrastructure.
- Preserve useful author task order without inventing a workflow graph or
  treating task completion as conformance.
- Package and relate artifacts without imposing one universal specification
  format.
- Discovery is not activation; artifact presence does not authorize an agent
  workflow.
- Authors choose which versioned implementation resources travel with a
  package; agents inspect summaries and apply them against actual project and
  user context.
- Package-scoped skills are resolved and explicitly consulted from the handoff;
  they are not installed into a native skill registry or automatically invoked.
- The end user directs the implementing agent.
- Official adapters add optional depth without becoming protocol dependencies.
- Handoff and lineage over permanent control of a realized solution.
- Markdown remains primary for behavior; structured data adds discovery,
  validation, configuration, composition, revision meaning, and optional
  checkable contract evidence.
- Configuration over package forks.
- Durable intent before consequential changes.
- Explicit capability requirements and provided capabilities.
- Capability versions, structured change history, and severity-aware comparison
  as testing evidence and prioritized review signals, not installation gates.
- Optional capability conformance suites and digest-bound realization results
  remain separate from project completion verification.
- Agent adaptation over forced contract conformity.
- Portability without forced generality.
- Verification plans before execution; scoped evidence after observation.
- Package, baseline, realization, and outcome evidence are not interchangeable.
- Escape hatches for users who want to work directly in code or a target system.

The complete rationale and decision tests are in
[docs/principles.md](docs/principles.md). Protocol-level adapter boundaries are
recorded in [ADR 0002](docs/decisions/0002-artifacts-adapters-and-agent-choice.md).
The broader agent-realized solution scope is recorded in [ADR
0008](docs/decisions/0008-one-protocol-for-agent-realized-solutions.md); kind
hints and implementation profiles in [ADR
0009](docs/decisions/0009-kind-hints-and-implementation-profiles.md),
machine-operable capability evidence in [ADR
0011](docs/decisions/0011-machine-operable-capability-evidence.md), ordered task
runbooks in [ADR 0012](docs/decisions/0012-ordered-agent-task-runbooks.md), and
examples in [docs/use-cases.md](docs/use-cases.md).

## v0.1 alpha boundary

This repository tests the protocol with conformance fixtures for a software
application root, a profiled workflow root, and feature additions; authoring
and guided-use skills; a reference CLI; a generic artifact model; an official
ProductSpec adapter; versioned capability contracts with structured history
and optional conformance suites; author-controlled implementation-resource
resolution; ordered task runbooks; candidate implementation profiles;
applied-intent resolution; explicit evidence subjects; deterministic handoff
output; agent guidance; persistent implementation notes; and acceptance
information. Complete packages and realized solutions remain independently
versioned in the reference-solutions repository.

The platform does not enforce what an agent builds or changes. The resolved
project supplies structured intent and evidence; the agent may map renamed
concepts, revise an approach, add missing behavior, or adapt verification as
needed. The actual realized state and its evidence determine whether the use
case works.

The alpha intentionally excludes package registries, implementation-guidance
catalog services and ranking, marketplaces, signing, production deployment,
universal generation engines, agent orchestration, and migration automation.
