# SeedSpec and GitHub Spec Kit

> Positioning and product-boundary analysis based on the SeedSpec 0.1 alpha and
> GitHub Spec Kit documentation available on July 19, 2026. This is explanatory,
> not normative. Because Spec Kit is evolving quickly, review the linked primary
> sources before reusing externally.

## Executive summary

SeedSpec and GitHub Spec Kit both put product intent ahead of implementation and
give coding agents structured context instead of relying on an ad hoc prompt.
They differ most clearly in what they are designed to make portable.

- **SeedSpec provides solution portability.** It packages a configurable shape
  of a solution—not a finished implementation—so product intent can move
  between authors, publishers, users, coding agents, repositories, and
  implementation stacks.
- **Spec Kit provides process portability.** It installs a repeatable,
  customizable development workflow into a project so teams can use structured
  specifications with different coding agents and engineering environments.

Put another way:

> **SeedSpec lets product intent travel. Spec Kit turns product intent into a
> development process.**

SeedSpec's primary object is a distributable product package. Spec Kit's primary
object is a repository-local set of working artifacts that acts as a high-order
abstraction for producing and evaluating code.

## What GitHub says Spec Kit is

GitHub's headline is:

> “Define what to build before building it—with any AI coding agent.”

GitHub describes Spec Kit as an open-source toolkit and, in its current
documentation, as an “extensible, intent-driven harness.” Its ready-to-use
Spec-Driven Development workflow is:

```text
Spec -> Plan -> Tasks -> Implement
```

Each phase produces Markdown that feeds the next phase, giving the coding agent
structured context rather than a series of improvised prompts. The process can
be run interactively, automated as a workflow, or customized through presets,
extensions, and bundles.

GitHub's broader Spec-Driven Development philosophy is that specifications can
become executable and drive implementation. Its strongest framing makes intent
the source of truth and code an expression of that intent.

Current documentation allows more flexibility than that original framing might
suggest. Teams can treat specs as temporary, anchored documentation, or a
persistent source of truth. Spec Kit does not require one artifact-persistence
model.

Primary sources:

- [GitHub Spec Kit repository](https://github.com/github/spec-kit)
- [Spec Kit documentation](https://github.github.com/spec-kit/index.html)
- [Spec Kit Quick Start](https://github.github.com/spec-kit/quickstart.html)
- [What is Spec-Driven Development?](https://github.github.com/spec-kit/concepts/sdd.html)
- [Spec persistence models](https://github.github.com/spec-kit/concepts/spec-persistence.html)
- [GitHub's introduction to Spec-Driven Development](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)

## Who Spec Kit is for

GitHub does not present a single “Who is it for?” statement, but the intended
audience is clear from the workflow and prerequisites:

- developers and engineering teams using AI coding agents;
- teams building new software or adding features to existing repositories;
- organizations that want a repeatable development process, architectural
  principles, quality gates, and governance;
- enterprises that require offline or air-gapped operation; and
- process authors creating extensions, presets, workflows, or reusable team
  bundles.

Product managers and other stakeholders can participate in defining and
reviewing intent, but the operating user is normally someone working inside a
repository, terminal, and engineering workflow. The quick start assumes CLI
installation, project initialization, agent selection, technical planning, and
implementation.

## Comparison

| Dimension | SeedSpec | GitHub Spec Kit |
| --- | --- | --- |
| Core identity | Portable product-intent format, protocol, and toolset | Extensible development-process toolkit and harness |
| Central promise | Carry a product definition between authors, users, agents, and implementations | Define what to build before building it with an AI coding agent |
| Primary unit | Versioned application or feature package | Repository-local feature specification and its derived artifacts |
| Intended portability | Product intent across organizational and implementation boundaries | Development process across coding agents, teams, and environments |
| Typical starting point | Someone authors or acquires a package, configures it, and gives it to an agent | A developer initializes Spec Kit in a project and describes a feature or change |
| Default lifecycle | Package -> selections -> resolved handoff -> implementation -> evidence | Spec -> plan -> tasks -> implementation -> convergence |
| Product reuse | Application and feature packages can be distributed, configured, and composed | Process components can be shared; product specs normally belong to a project |
| Technical design | Kept separate from portable product intent and decided for the actual implementation | Explicitly developed in the planning phase |
| Validation model | Protocol conformance, configuration validation, package integrity, deterministic resolution, and verification state | Template-guided quality checks, cross-artifact analysis, project principles, and implementation convergence |
| Relationship to code | A handoff that does not permanently control the generated application | A working artifact set that can serve as the source or high-order abstraction from which code is produced |
| Primary audience | Product creators, package authors, end users, and teams directing coding agents | Developers, engineering teams, and organizations operating coding-agent workflows |
| Ecosystem distribution | Application packages, feature packages, artifacts, and optional implementation resources | Extensions, presets, workflows, bundles, and agent integrations |
| Execution authority | Discovering, resolving, or selecting packaged tooling does not automatically authorize execution | Installed extensions and workflows can actively modify or operate the development process |

## The portability distinction

Both systems are agent-neutral, but they mean different things by portability.

### SeedSpec: semantic and solution portability

A SeedSpec package is intended to retain its product meaning when it crosses a
boundary:

```text
author or publisher
        -> buyer or end user
        -> selected coding agent
        -> chosen implementation environment
```

The recipient should be able to identify the package, validate it, review its
configuration, compose selected features, preserve supporting material, and
resolve it for a particular project without adopting the author's technology
stack or coding workflow.

This makes SeedSpec suitable for customized distribution of a **shape of a
solution**. Different users may make different configuration and technical
choices while retaining traceability to the same authored product intent.

### Spec Kit: procedural and engineering portability

Spec Kit makes a structured development method usable across coding agents and
engineering environments. Its specifications, plans, and tasks live with the
project and progressively translate intent into implementation.

Those artifacts can be versioned, checked, and reused, but their primary job is
to drive work in a particular repository. Their validity is largely contextual:
they are evaluated against that project's constitution, plans, tasks, code, and
chosen workflow. They are not primarily a publisher-to-buyer product package or
a protocol-level interchange object.

Calling a Spec Kit specification a **high-order abstraction for writing code**
is therefore reasonable. It behaves somewhat like a human-readable source
program: the agent elaborates it into technical plans, tasks, tests, and code.
SeedSpec operates one level farther upstream. It preserves the product contract
that can be handed to Spec Kit or another implementation process.

## Where they overlap

Both systems:

- put the “what” and “why” before the technical “how”;
- give agents structured context instead of ad hoc prompts;
- support multiple coding agents;
- separate product behavior from implementation choices;
- work for greenfield applications and changes to existing projects;
- favor human-readable Markdown; and
- encourage explicit success criteria and review before implementation.

This overlap means that describing SeedSpec only as “tools for describing
software before it becomes code” makes it sound like a smaller Spec Kit. That
description is accurate but does not expose SeedSpec's distinctive value:
distribution, configuration, composition, identity, integrity, and handoff
across parties and implementation contexts.

## How they can work together

The two systems can be complementary rather than mutually exclusive:

```text
SeedSpec application or feature package
        -> user configuration and product decisions
        -> resolved SeedSpec handoff
        -> Spec Kit feature specification
        -> technical plan
        -> tasks
        -> implementation and convergence
```

In this relationship:

- SeedSpec is the portable upstream product source;
- a Spec Kit specification is a project-local interpretation or derived
  execution artifact;
- Spec Kit manages the development workflow; and
- implementation findings and verification evidence can be recorded without
  requiring SeedSpec to become a permanent control plane.

## Recommended SeedSpec description

SeedSpec is a portable, agent-ready package format and toolset for carrying
product intent from the people who define software to the people and agents
that implement it. It packages what an application or reusable feature should
do—including its behavior, configuration, decisions, supporting resources, and
success criteria—into a versioned handoff that can be validated, distributed,
configured, and composed independently of any codebase or coding agent.

A capable coding agent can use a resolved SeedSpec package as the structured
starting point for building a new application or adapting a feature into an
existing one. The package defines the intended outcome and provides a basis for
judging success, while the user and agent remain free to choose the
architecture, technology stack, hosting, and implementation workflow.

SeedSpec is for people and teams who want to build software with coding agents
from a durable, reusable product definition rather than an ad hoc prompt. It is
also for product authors and domain experts who want to package application
ideas or reusable features so other people can configure and implement them
with their preferred agents.

Package authors can include additional context, acceptance material, and
implementation resources to reduce ambiguity and improve the fidelity of the
result. That material guides implementation without taking control away from
the end user, who decides what gets built, which guidance is used, and how the
resulting software evolves.

## Positioning shorthand

Use these distinctions when explaining the products:

- **SeedSpec packages a solution shape; Spec Kit structures its implementation.**
- **SeedSpec provides solution portability; Spec Kit provides process portability.**
- **SeedSpec travels between parties and projects; Spec Kit operates inside the project.**
- **SeedSpec is an upstream product contract; Spec Kit is a development harness.**
