# Decision 0015: Web authoring architecture

- Status: **proposed**; not accepted and not implemented
- Date: 2026-07-25
- Supersedes nothing. Would extend [Decision 0013](0013-shared-authoring-engine-and-frontend-contract.md).

> **This is a proposal, not a decision.** The dedicated authoring session owns
> the CLI and web authoring direction; this record exists so the reasoning
> gathered while building the operation layer is not lost, and so that session
> can accept, revise, or reject it. Nothing here is settled, and no storage,
> identity, tenancy, or model-routing choice below should be treated as chosen.
>
> Every "decision" heading in this document should be read as "proposal".

## Context

Decision 0013 committed to one shared authoring engine with a CLI and a web
workbench as replaceable frontends, and forbade a second web-only engine. The
CLI came first deliberately: it was the cheapest way to reform the authoring
skills and observe how different agents, harnesses, and models respond to the
operating brief.

Several foundational write operations now exist: recording observations,
resolving questions, attaching sources, and closing a thread. Each can compare
an expected workspace revision when the caller supplies one. The proposal and
acceptance path remains unimplemented, so hosted architecture can be explored
but cannot move independently of the remaining engine work.

A separate evaluation harness already runs a Cloudflare Think agent against
SeedSpec packages. It solves several problems a hosted authoring product also
has — untrusted user content, durable turn recovery, model routing, per-step
usage capture — and solves several it does not, because an evaluation binds its
inputs before the model runs, while authoring creates its inputs through the
conversation.

## Proposal

### Sessions bind after the fact, not before

The evaluation harness is a **pre-hoc binding** system: exact inputs are
committed before a run so the output is attributable. Authoring is the inverse.
Relaxing write-once configuration for an interactive session is therefore not a
loss of rigor; the binding moves to publication.

A **workspace** is the durable unit and maps to one Think Durable Object,
addressed by workspace id. A **session** is a row inside it recording actor,
model, budget, and consent — the envelope that authorizes model calls until the
author pauses.

Immutable workspace identity stays in `configure()`. Everything an author may
legitimately change mid-workspace — model, coaching depth, active thread,
budget — moves to workspace state. Changing model must not conflict.

Concurrency is enforced per mutation through the workspace revision, not
through configuration identity, so two browser tabs behave correctly.

A **publication record** replaces the evaluation manifest: workspace, revision,
package digest, content-addressed bundle, and provenance covering the sessions,
the answers with their attribution, and each accepted change. The digest
assertions do not disappear; they re-point from binding a run before it starts
to binding a package after it is finished.

A package published from the web is natively valid input to the evaluation
harness. The web product's output is an eval input, which closes the loop the
CLI was built to open.

### Asking the author is a durable pause

Replacing the harness's simulated-author tool with a real question to a human is
the single largest change, and the most important one to get right: asking the
author is the most reliable authoring behavior the evaluation corpus measured.

The question parks as a durable action. The turn ends — no socket is held, no
step budget burns waiting. The pending question renders from durable state, so a
refresh, a new device, or a week later are the same case.

**Answers route through the engine before they reach the model.** The recording
operation runs first and the parked action resumes second. The answer becomes
durable authoring state first and model context second, which is 0013's rule
that the engine validates and records proposals rather than treating model
output as trusted state. The CLI's answer command and the web's answer button
are then the same operation.

A question must be a countable, attributable, answerable object — not a sentence
inside an assistant message.

### The engine runs behind a storage adapter, never reimplemented

The shared engine runs in the isolate behind a storage adapter, and the agent
reaches it only through engine-operation tools.

A Worker-native reimplementation is the second engine 0013 forbids, and that
drift has already happened once: the evaluation harness carries its own package
validation and its own copy of the canonical directory digest. Two
implementations of that digest exist today. A third is not acceptable.

Parity is enforced by test, not by intent: the same fixture through the
filesystem adapter and an in-memory adapter must produce byte-identical
revision, package digest, and diagnostics.

Two known blockers: the protocol package reads files at module scope, which
fails on import in a Worker and needs generated side-effect-free schema
constants; and archive creation depends on a Node-only dependency. Neither is a
portability concern for the package itself, because the portable digest is
computed over files rather than over an archive.

### The agent proposes; it never writes

Direct file-write tools are removed from the agent's active set in the web
product. Reads stay. Every mutation goes through propose, then author
acceptance, then an engine write.

This is structural rather than prompted because prompting was empirically
insufficient: under audit load a guided treatment selected competing-request,
cancellation, and identity policy without attributable author authority despite
the brief explicitly forbidding exactly that.

Workspace shell and network access stay disabled.

### Storage

- **Durable Object SQLite** — draft documents, authoring state, transcript,
  questions, proposals, budget ledger, provenance events. A single writer is
  what makes revision checks correct without distributed locking.
- **R2** — uploaded source material and assets, content-addressed; immutable
  published packages and export archives.
- **D1** — accounts, workspace membership, and the cross-workspace index. A
  Durable Object cannot answer "list my workspaces."

Authoring state must not live in D1; revision semantics require one writer.

Export shows the digest beside the command that verifies it, so "ordinary
portable files that validate without the web product" is checkable rather than
asserted.

### Budgets are a product surface, not a safety net

The evaluation corpus is unambiguous: a guided treatment cost roughly six times
a raw one in tokens and four times in wall clock, and the heaviest treatment
died at its ceiling.

Four independent bounds: per-turn steps, per-session token and cost budget, idle
auto-pause with a hard cap, and — the non-obvious one — **one guidance unit per
turn**. Stacking guidance measurably reduced obligation coverage while
multiplying cost, so a second request in the same turn is refused.

Interactive turns need *fewer* steps than an evaluation run, not more, because
the human is in the loop.

Hitting a budget is a state, not an error. The draft, the answers, and any
proposed change remain, and the package must be exportable in every budget state
including exhausted.

### Multi-tenancy

Identity by email link; authorization by workspace membership checked at
connection and again inside the Durable Object. Deny with 404 rather than 403 so
workspace existence does not leak.

The trusted/untrusted prompt split carries over unchanged — it is what made
every evaluation treatment reject an embedded injection payload. One semantic
change: in evaluation, author answers are case data; in the product the author
is the authority, so answers carry product authority but never tool or
permission authority. No tool accepts a URL.

Model and gateway are server-selected by plan. Author-supplied routing is a
billing hole.

## Consequences if accepted

- The web product cannot ship before the propose/accept operations land.
  Retrofitting attribution is not possible after the fact, so proposal
  attribution, revision-checked mutations, and the provenance ledger are not
  deferrable.
- The evaluation harness should adopt the shared engine, retiring its duplicate
  validation and digest.
- Data retention and jurisdiction are launch blockers, not later work, for a
  product whose premise is that people paste confidential domain expertise into
  it.
- The four review threads must not become wizard pages. 0013 makes review areas
  engine-owned conversations, and a progress bar over four threads reintroduces
  the completeness framing 0014 removed.
- No specification quality score. It would make `good-enough` and
  `not-relevant` read as failures when they are successful dispositions.

## Known risk

The durable-action approval methods are client-callable by default. A connected
browser could resolve a parked question without a recorded answer, producing an
approval with no attribution and bypassing the engine. Access must be gated, or
the methods overridden to require a recorded answer first. This is the sharpest
concrete risk in the design.
