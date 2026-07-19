# ADR 0003: Artifact dispositions and implementation targets

Status: accepted for the private alpha

## Context

Artifact declaration and materialization show an implementing agent what a
package contains, but they do not record what the end user chose. In the first
rich-package exercise, a hosting profile was selected while an implementation
skill and scaffold script were declined. The resolved handoff preserved all
three without distinguishing them. The hosting choice also lived in arbitrary
technical YAML whose package and artifact references could not be validated.

Hosting and platform guidance can affect the earliest architecture choices.
SeedSpec must surface that context without claiming that it knows the resulting
implementation is compatible, deployable, or accepted by a provider.

## Decision

- Accept a separate artifact-selection document during resolution.
- Record `selected`, `declined`, and `deferred` choices; record omitted artifacts
  as `unreviewed`.
- Validate every selection against the packages and artifacts in the resolution.
- Preserve all local artifacts regardless of disposition so the handoff remains
  auditable and a later decision does not depend on rediscovery.
- Keep disposition separate from activation. Even `selected` never authorizes
  loading a skill, running a command, fetching a URL, invoking an adapter, or
  adopting an external workflow.
- Mark execution artifacts as `requires-specific-user-direction` in resolved
  state.
- Add an optional, provider-neutral `implementation_targets` envelope to
  technical preferences.
- Require namespaced target kind and target identifiers plus one or more
  validated component or artifact guidance references.
- Require artifact guidance referenced by an implementation target to have a
  `selected` disposition.
- Surface implementation targets and their resolved guidance paths before
  architecture planning while stating that they are context rather than
  compatibility guarantees.

## Consequences

An interrupted or transferred agent workflow can distinguish content that was
selected, declined, explicitly deferred, or never reviewed. Executable material
can be selected as intended input without converting a data record into broad
action authority.

Hosting providers, including future SeedSpec commercial products, can publish
namespaced targets and guidance without becoming part of the neutral protocol.
The implementing agent remains responsible for the actual architecture, conflict
resolution, testing, and deployment readiness.

The alpha still does not define an activation command, approval token, provider
registry, deployment API, or compatibility certification.

