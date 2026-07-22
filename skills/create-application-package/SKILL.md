---
name: create-application-package
description: Turn a rough software product idea into a portable, implementation-agnostic SeedSpec application package with explicit actors, workflows, domain concepts, permissions, configuration, edge cases, and acceptance criteria. Use when creating or substantially revising an application package that must conform to the SeedSpec Protocol and validate with the seedspec CLI.
---

# Create SeedSpec application package

Create durable core intent, not an implementation plan. Accept starting material ranging from one sentence to a detailed specification or working application. Keep frameworks, databases, cloud providers, and repository layouts out of the package unless the intended outcome genuinely depends on them. The runtime supplies general coding-agent handoff guidance separately.

## 1. Select authoring depth

Infer the appropriate depth from the request:

- **Capture**: preserve a rough idea in a minimal valid package without inventing details.
- **Shape**: develop actors, outcomes, concepts, workflows, and meaningful variation.
- **Harden**: add permissions, invariants, failures, edge cases, and observable acceptance.
- **Compose**: declare mature capabilities and related artifacts for reuse.

Do not force a sparse idea through every stage. If depth is ambiguous, capture what is known, record consequential unknowns, and offer deeper authoring as a later step.

## 2. Establish context

Read `docs/protocol.md` and `packages/protocol/schemas/v0.1/seedspec.schema.json` from the SeedSpec repository. If a related package or product document exists, inspect it before asking questions.

Extract only what the supplied material supports:

- intended users and their desired outcomes;
- actor roles and authority boundaries;
- core domain concepts and their relationships;
- fundamental workflows and state transitions;
- permissions, invariants, failures, and edge cases;
- behaviors likely to vary between installations;
- observable success claims and credible verification plans;
- non-goals, forbidden states, and genuine constraints; and
- choices fixed by the author, reserved for the end user, or delegated to the
  implementing agent.

Separate required core behavior from optional features. Do not fold optional ideas into the application merely because they were mentioned. For capture-only work, an empty capability list and empty-object configuration are valid.

## 3. Resolve only material ambiguity

Ask a targeted question only when different answers would materially change product behavior, permissions, accounting, irreversible data treatment, or package portability. Group closely related decisions. Continue with clearly recorded, reversible example values for routine details; the example is not automatically an end-user-selected default.

Never ask the user to choose manifest syntax, directories, schema mechanics, or implementation technology as part of product discovery.

## 4. Design configuration

Turn meaningful product variations into a small configuration surface. Include a choice when multiple reasonable installations need different behavior. Keep invariants fixed when varying them would undermine the product's identity or safety.

For every option:

- use product language;
- define allowed values and validation in JSON Schema;
- select a coherent example value;
- explain prospective versus historical effects when relevant;
- avoid technical preferences such as framework or hosting.

## 5. Create the package

Run `seedspec init application --output <package-path>` when the CLI is available, then replace the starter content. Otherwise reproduce the same protocol shape.

Write:

- `seedspec.yaml` with a reverse-DNS identity, application kind, entrypoints, versioned provided capabilities, and discoverable components;
- one contract file for every provided capability;
- one primary intent source with clear **Purpose**, **Obligations and
  boundaries**, **Success and evidence**, and **Decision latitude** semantics;
- `configuration/schema.json`, `configuration/example.yaml`, and a guide when options need explanation;
- `acceptance/criteria.md` with numbered, observable behaviors covering success, authorization, state, configuration, idempotency, and failure paths.

Use Markdown as the expressive center. Keep structured files limited to metadata, discovery, validation, configuration, and composition.

Declare capabilities as namespaced, versioned product contracts such as `org.seedspec.core.actors`, not screens, classes, endpoints, or infrastructure.

Use native SeedSpec Markdown for the primary intent unless the author already
uses a recognized external intent format. To make an external document such as
ProductSpec the primary source, declare it as an intent artifact, set
`definition.entrypoint` to its path, and set `definition.artifact` to its ID.
Do not duplicate a weaker native definition merely to satisfy the package. This
selects the document's intent role, not its parser, skills, or workflow.

Preserve other useful specifications, designs, plans, infrastructure material,
or package evidence as supporting artifacts with namespaced types and concerns.
For package evidence, use `evidence_for` to name the package claim it supports.
Do not imply that package evidence proves a future user realization, and do not
manufacture artifacts merely to fill a category.

At packaging time, inspect the available versioned implementation-resource
catalogs. Offer tested SeedSpec resources as defaults, but let the author remove
them, change `expected`, `recommended`, or `available` usage, and choose
`additional_guidance: none` or `agent-delegated`. Prefer compact skills whose
frontmatter lets the implementing agent decide relevance. Do not include generic
advice merely to make the package appear more complete.

Treat a bundled skill as package-scoped guidance. It will be explicitly
consulted from the resolved handoff, not installed or automatically invoked by
frontmatter. Keep supporting references relative to the skill root, and keep
solution behavior and success criteria in the SeedSpec rather than the skill.

For a bundled failsafe, compute its exact bytes with
`seedspec resource-digest <directory>`. Keep capability and target applicability advisory; it helps
resource discovery but never claims that the resulting application implements
the capability or supports the target.

When the same core intent has multiple materially different implementation
directions, preserve them as `implementation_profiles` rather than product
configuration or solution decisions. Describe prerequisites and blockers as
verifiable conditions, keep profile-specific guidance separate from the core
definition, and do not imply that an author preference overrides the end user.

## 6. Validate and review

Run:

```bash
seedspec validate <package-path>
seedspec inspect <package-path>
seedspec artifacts <package-path>
seedspec resources <package-path>
```

If the author deliberately included a recognized native format and wants its conformance checked, invoke `seedspec validate-artifact <package-path> <artifact-id>` separately. Successful package validation must not be presented as native artifact validation, or vice versa.

Repair every schema, path, configuration, and capability error. Then review the package directly:

- Can a reader recognize the same product when implementation details vary?
- Are role boundaries and state transitions explicit?
- Can retries or concurrent decisions duplicate consequential actions?
- Are accounting or history rules auditable where relevant?
- Does each configuration choice have defined behavior?
- Are acceptance criteria observable rather than architectural?
- Are non-goals distinguishable from states the realization must forbid?
- Does each success claim distinguish a future verification plan from actual
  package, baseline, realization, or outcome evidence?
- Is decision latitude explicit enough that an end user and agent know which
  choices require affirmation?
- Did marketplace policy or publisher commercial language leak into the protocol artifact?

Finish only when the package validates and the inspection matches the intended identity and capabilities.
