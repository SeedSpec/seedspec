# Decision 0013: Build CLI and web authoring on one headless engine

- Status: accepted for the first-party authoring product
- Date: 2026-07-24

Implementation note, 2026-08-02: the 0.3 staging state now implements workspace
creation and inspection, observations, questions, answers, source attachment,
review closure, text-document proposals, explicit author decisions, and engine
application. The replaceable storage adapter and workspace archive remain.

The frontend and engine boundary remains accepted. Decision
[0014](0014-source-bound-authoring.md) replaces the seven-pass default and
review-gated packing behavior with four source-bound conversations and a
minimal success-material gate.

## Context

SeedSpec 0.2 has a useful headless authoring-review kernel. The runtime can
scaffold a valid package, validate and lint it, create versioned review passes,
track their outcomes outside the distributable package, inspect an independent
handoff, and report durable review state alongside publication readiness.

It is not yet a complete authoring engine. Creating intent from source
material, managing an invalid draft, recording questions and answers, proposing
and approving changes, and editing pass results still depend on a capable agent
writing package and authoring-state files directly. The CLI JSON output exposes
some useful data, but absolute paths and file-shaped mutations make it an
incidental interface rather than a frontend contract.

A web workbench will need persistence, concurrency, structured mutations, and
safe agent integration that a local filesystem supplies only implicitly. If
those behaviors are implemented independently in a web application, the CLI
and web experiences will drift and the portable package will no longer be
enough to explain how authoring state was produced.

## Decision

### One engine, multiple frontends

The CLI and web workbench will be clients of one versioned, headless authoring
engine. The engine will expose structured operations and serializable results;
the CLI will format those results for a terminal, while a hosted service may
expose the same operations to a browser.

The web application must not implement authoring semantics by parsing CLI text,
shelling out to CLI commands as its application contract, or independently
rewriting the engine's state files. The CLI remains a first-party frontend and
local automation surface, not the definition of the engine.

Frontend parity means:

1. the same core operation has the same preconditions, state transition,
   result, error code, and version metadata;
2. the same accepted package content produces the same validation, lint, and
   portable digest results;
3. authoring history preserves the same sources, questions, decisions,
   findings, proposals, approvals, and pass outcomes; and
4. either frontend can explicitly export an ordinary SeedSpec package that
   does not depend on the frontend that produced it.

Terminal and browser interactions do not need to look identical. The CLI may
favor explicit commands and files; the web workbench may favor conversation,
forms, document views, diffs, and review controls.

### Human CLI ergonomics

The human authoring entry point is:

```bash
npx @seedspec/cli author
```

It uses npm's current stable release, permits npm's ordinary first-run
confirmation, discovers one local authoring project from the current directory,
and resumes its current work. Human instructions do not require a global
install, `--yes`, an exact package version, or explicit package and state paths.

Exact versions, `--yes`, paths, expected revisions, identifiers, and JSON are
automation and reproducibility controls. They remain supported without defining
the beginner experience. All authoring commands accept an explicit package path
when discovery would be ambiguous or inappropriate.

Parity applies to durable authoring artifacts and their meaning, not to an
identical frontend capability set. A web workbench may include an embedded
agent that helps an author explore and make decisions while the CLI relies on a
separately supplied agent or direct commands. Frontend-specific capabilities
must submit their durable results through the shared engine so accepted
sources, questions, answers, findings, changes, and package bytes remain
portable and attributable.

### Product boundary

The authoring engine owns:

- workspace identity, revision, and lifecycle;
- draft package documents and attached source-material records;
- authoring target depth and source-bound review state;
- factual inventory, grounded findings, contradictions, optional suggestions,
  session questions, and author answers;
- proposed, accepted, rejected, and applied changes with attribution and
  retained author-decision histories;
- deterministic validation, lint, digest, publish-check, and export results;
- version stamps for the protocol, engine, instruction, and state formats; and
- durable transitions between drafting, review, author resolution, final
  checks, and export readiness.

A replaceable agent host owns semantic work:

- interpreting source material;
- identifying contradictions and ambiguities triggered by authored material;
- drafting questions, findings, and package changes;
- explaining consequences and alternatives; and
- recommending whether an area is already good enough or has a small useful
  improvement.

The engine validates and records those proposals. It does not treat model
output as trusted state, silently turn an agent proposal into author intent, or
claim that a completed review proves specification quality.

A frontend owns presentation, navigation, local interaction state, and
frontend-specific collaboration or organization policy. Storage adapters own
filesystem, database, or object-storage persistence without changing authoring
semantics.

### Durable truth and mutation rules

The package and versioned authoring workspace are durable truth. Conversation
history may explain a proposal, but it is not the only record of a material
decision.

Every consequential package mutation must be:

- visible as a proposed or applied document change;
- attributable to an author answer, supplied source, mechanical operation, or
  agent proposal;
- based on a known workspace revision and package digest;
- accepted explicitly when it introduces or resolves material intent; and
- followed by fresh deterministic results before a review area can be marked
  reviewed.

Every agent-proposed document change requires explicit author acceptance.
Deterministic mechanical work may apply as part of an already authorized engine
operation, but the resulting mutation must remain visible, attributable, and
revision-bound.

Drafting must tolerate temporarily invalid package content. Package validity is
a checkpoint for reviewed areas, publish checks, and export; it is not a
precondition for reading status, editing a draft, or recovering a workspace.

Hosted operations use opaque workspace and document identifiers rather than
server filesystem paths. Mutations require an expected workspace revision and
fail on concurrent modification instead of silently overwriting newer work.
Import, export, sharing, upload, model use, and publication remain explicit
actions.

Starting an agent-assisted authoring session explicitly authorizes model calls
until the author pauses or stops that session. The active agent and model
context must remain visible. This session consent does not authorize external
tools, source acquisition, publication, or other consequential actions.

### Initial operation surface

The first stable vertical slice will support:

1. create or import an authoring workspace from an idea, source document, or
   existing SeedSpec package;
2. inspect workspace status and package documents even while the draft is
   invalid;
3. validate, lint, and digest the current valid draft;
4. start or resume one review area;
5. record inventory, grounded findings, contradictions, suggestions, and
   session questions;
6. record an author answer or decline a suggestion without creating future
   package work;
7. propose a document change and inspect its diff;
8. accept or reject the proposal against an expected workspace revision;
9. mark a review area improved, good enough, not relevant, abandoned, or
   superseded with verified results; and
10. explicitly export the portable package and run the publication gate.

Review areas are engine-owned, versioned conversations rather than
frontend-owned wizard pages. Their current source-bound form is defined by
Decision 0014.

### Delivery sequence

We will not finish a large terminal-only authoring product and then port it to
the web. We will also not build two independent authoring implementations at
once.

For each vertical slice:

1. define and test the engine operation and serializable contract;
2. expose it through the CLI and exercise it in a real authoring session; and
3. add the smallest web-workbench interaction that proves the same operation
   is usable without filesystem knowledge.

The first web work may begin once workspace creation, draft inspection,
revisioned mutation, and deterministic checks have engine-level contracts. The
remaining CLI and web experiences can then advance together by operation while
sharing one implementation.

## Non-goals

This decision does not:

- put model inference inside the protocol or require one model provider;
- make authoring state part of a distributable SeedSpec package;
- require identical CLI and web screen flow;
- require identical CLI and web capabilities;
- turn guided review areas into protocol conformance or a quality score;
- require real-time multi-user editing in the first workbench;
- make a hosted account necessary to author or consume a package; or
- authorize publishing, external access, or tool execution from discovered
  package content.

## Consequences

- The existing authoring runtime should be treated as the beginning of the
  engine, not as a finished web-ready API.
- Filesystem reads and writes must move behind an authoring-workspace adapter
  or a similarly explicit persistence boundary.
- Direct edits to `open-questions.yaml` and pass `result.yaml` need supported
  operations before a web workbench can reach meaningful parity.
- A versioned authoring-workspace archive must carry draft documents, sources,
  questions, answers, findings, proposals, approvals, pass history, and format
  metadata between frontends. Conversation transcripts are optional and
  credentials, provider session state, and frontend-only features are not
  portable authoring artifacts.
- CLI JSON should evolve toward stable resource identifiers, revisions, and
  structured actions rather than exposing local paths as the primary handle.
- Manual authorship sessions become contract discovery: friction that is
  intrinsic to authorship informs shared operations; friction caused only by
  direct file manipulation should not be copied into the web experience.
- A thin web workbench can start before every CLI authoring command is
  complete, but only after the shared operation it needs exists in the engine.
