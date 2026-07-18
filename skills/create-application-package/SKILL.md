---
name: create-application-package
description: Turn a rough software product idea into a portable, implementation-agnostic SeedSpec application package with explicit actors, workflows, domain concepts, permissions, configuration, edge cases, and acceptance criteria. Use when creating or substantially revising an application package that must conform to the SeedSpec Protocol and validate with the seedspec CLI.
---

# Create SeedSpec application package

Create durable product intent, not an implementation plan. Accept starting material ranging from one sentence to a detailed specification or working application. Keep frameworks, databases, cloud providers, and repository layouts out of the package unless the product outcome genuinely depends on them. The runtime supplies general coding-agent handoff guidance separately.

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
- observable evidence of conformance.

Separate required core behavior from optional features. Do not fold optional ideas into the application merely because they were mentioned. For capture-only work, an empty capability list and empty-object configuration are valid.

## 3. Resolve only material ambiguity

Ask a targeted question only when different answers would materially change product behavior, permissions, accounting, irreversible data treatment, or package portability. Group closely related decisions. Continue with clearly recorded, reversible defaults for routine details.

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
- `definition/app.md` with purpose, actors, permissions, concepts, workflows, state models, business rules, configuration behavior, failures, edge cases, out-of-scope features, and conformance intent;
- `configuration/schema.json`, `configuration/example.yaml`, and a guide when options need explanation;
- `acceptance/criteria.md` with numbered, observable behaviors covering success, authorization, state, configuration, idempotency, and failure paths.

Use Markdown as the expressive center. Keep structured files limited to metadata, discovery, validation, configuration, and composition.

Declare capabilities as namespaced, versioned product contracts such as `org.seedspec.core.actors`, not screens, classes, endpoints, or infrastructure.

When the source material includes a useful native specification, design, plan, infrastructure description, or evidence document, preserve it under `artifacts` with a namespaced type and concern. Do not manufacture an artifact merely to fill a category, merge distinct concerns, or mark it governing/advisory. ProductSpec is one optional rigorous intent artifact, not a required replacement for the SeedSpec definition.

## 6. Validate and review

Run:

```bash
seedspec validate <package-path>
seedspec inspect <package-path>
seedspec artifacts <package-path>
```

If the author deliberately included a recognized native format and wants its conformance checked, invoke `seedspec validate-artifact <package-path> <artifact-id>` separately. Successful package validation must not be presented as native artifact validation, or vice versa.

Repair every schema, path, configuration, and capability error. Then review the package directly:

- Can a reader recognize the same product when implementation details vary?
- Are role boundaries and state transitions explicit?
- Can retries or concurrent decisions duplicate consequential actions?
- Are accounting or history rules auditable where relevant?
- Does each configuration choice have defined behavior?
- Are acceptance criteria observable rather than architectural?
- Did marketplace policy or publisher commercial language leak into the protocol artifact?

Finish only when the package validates and the inspection matches the intended identity and capabilities.
