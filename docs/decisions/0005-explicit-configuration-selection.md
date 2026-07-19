# ADR 0005: Configuration examples are not defaults

Status: accepted for the private alpha

## Context

Every SeedSpec package contains a complete validated configuration example.
The original resolver silently used that example as selected configuration and
merged partial overrides into it. A project could therefore report `ready`
without a user or agent ever choosing its product behavior.

## Decision

- Keep `configuration.example` as required author-supplied package material.
- Do not redefine an example as a user-selected default.
- Accept one optional configuration-selection document covering every selected
  application and feature package.
- Let each entry choose the exact package example or provide a complete custom
  object.
- Never merge omitted custom values from the example.
- If selections are omitted, preserve examples as `example-unreviewed`, set
  `configuration_status: review`, and set project status to `needs-input`.
- Report `ready` only when configuration is selected and no required package
  decision remains unanswered.

## Consequences

Explicit use of an author's example remains concise, custom configuration is
auditable, and an incomplete handoff can still be inspected without pretending
to be implementation-ready. Agents must construct complete custom values, but
JSON Schema makes missing fields immediately visible. The CLI records a claimed
selection; it does not claim to prove that a human personally approved the
input file.

