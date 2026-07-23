# Contributing to SeedSpec

SeedSpec welcomes authoring, protocol, runtime, CLI, documentation, and conformance
contributions. Changes should remain understandable to an independent
implementer without access to project history.

## Repository scope

This repository contains the SeedSpec authoring system, SeedSpec Protocol,
normative schemas and conformance cases, first-party runtime and CLI tooling,
and operational skills.
Demonstration packages and realized solutions belong in the separate
`SeedSpec/reference-solutions` repository unless they are minimal fixtures
needed to test a protocol rule.

## Classify the change

Before editing, identify the affected document class:

- `docs/protocol.md`, versioned schemas, and the conformance contract are
  normative;
- architecture, semantic-structure, evaluation, authoring, runtime, security,
  and topic guides are informative;
- architecture decision records are non-normative rationale; and
- marketplace policy and product strategy are outside the protocol contract.

An editorial change clarifies the existing contract. A semantic change alters
what an implementation accepts, produces, preserves, rejects, or reports.
Semantic changes must update normative prose, schemas, conformance coverage,
reference behavior, tests, and version metadata together.

## Protocol writing

- State requirements impersonally and name the responsible actor.
- Use BCP 14 keywords only for testable normative requirements.
- Distinguish packages, core intent, implementation profiles, implementation
  resources, resolved handoffs, and realizations.
- Do not present author declarations as observed implementation state.
- Do not imply that validation proves safety, compatibility, authorship, or
  realization quality.
- Keep provider-specific examples and design rationale out of normative rules.

The project-scoped `$harden-seedspec-protocol` skill under `.agents/skills/`
contains the complete editorial and publication checklist for agent-assisted
reviews.

## Verify the change

Install dependencies and run:

```bash
npm run check
npm run conformance
git diff --check
```

When a public command, schema URL, or package boundary changes, also test it as
an external consumer. Pull requests should identify:

- whether the change is editorial or semantic;
- the normative surfaces affected;
- compatibility and version impact;
- conformance cases added or changed; and
- any claims that remain informative rather than machine-verifiable.
