# SeedSpec Authoring

> **Informative guidance.** This document describes the reference authoring
> experience. It does not make semantic quality part of protocol conformance.

SeedSpec authoring helps a person turn supplied intent into a useful,
portable seed. It does not try to finish the product design before
implementation, discover every concern common to similar products, or certify
that a specification is complete.

The default authoring principle is:

> Review the authored surface; do not invent a larger one.

A short seed can be honest and useful. Authoring adds value by explaining what
the package currently communicates, finding contradictions created by its own
claims, making success observable, and helping the author understand the
configuration and supporting material they actually included.

The seed carries the requirements the author knows at this stage. It is not a
claim that every adopter, environment, or implementation requirement is already
known. Later project-specific requirements remain applied intent unless the
package author deliberately accepts them into a new package version.

## The minimum useful seed

The reference authoring and publishing experience treats two Markdown concerns
as the practical floor:

1. **Seed intent** says what should exist or change, who it is for, and what
   matters.
2. **Observable success** says what someone could observe if that seed were
   realized successfully.

`seedspec init` scaffolds these as a primary context module at `seed.md` and an
acceptance component at `success.md`. Protocol 0.3 does not validate retired
package layouts. The reference publish check requires a declared,
non-placeholder acceptance component so a distributable seed carries its own
success definition.

Success material is not an exhaustive test plan and is not evidence that a
realization exists. It should cover only outcomes the seed actually states.

## Start or resume

Run inside a SeedSpec authoring project:

```bash
npx @seedspec/cli author
```

The command discovers the package and adjacent authoring state and recommends
the next useful action. It does not require a global install, exact version,
`--yes`, package path, or state path for ordinary human use.

To get the prompt that a person can paste into an agent:

```bash
npx @seedspec/cli author prompt
```

Practical requirements exploration is the default. The prompt asks whether the
author wants a practical first specification with reasonable recommended
defaults or a deeper discovery pass. To select deep discovery immediately, use:

```bash
npx @seedspec/cli author prompt --deep
```

Deep discovery walks dependent decisions one at a time, recommends an answer
for each, and waits for shared understanding before document proposals.

To treat the supplied material literally and apply only necessary shaping, use:

```bash
npx @seedspec/cli author prompt --minimal
```

All three prompts keep recommendations outside package meaning until the author
accepts exact wording. The selected coaching depth is stored in
`workspace.yaml`, so later agents receive the same posture.

The complete version-matched agent operating brief is:

```bash
npx @seedspec/cli author review
```

Use `--summary` only for a shorter human view. The full output is intentionally
self-contained so a capable agent does not need an installed SeedSpec skill,
online documentation, or access to the SeedSpec implementation.

## One natural conversation, four private threads

The author should experience a natural co-authoring conversation about the
thing they want to make. The operating brief gives the agent four private
threads for organizing its attention and durable state:

1. **The seed** — confirm the central direction the author actually supplied.
2. **Coherence** — compare authored claims and declarations for contradictions,
   broken references, and meaning on which an existing statement depends.
3. **Observable success** — ensure a separate success document contains
   understandable observations aligned with the seed.
4. **Configuration and supporting material** — inventory and review declared
   configuration, decisions, profiles, tasks, skills, assets, artifacts,
   examples, reference code, and evidence.

These are not four headings, wizard pages, reports, or lessons the author needs
to understand. The agent does not announce an area number, explain the review
framework, enumerate the package, or manufacture a strengths section.

The threads are review lenses, not lifecycle stages. Authoring also has a
separate scope action and coaching depth:

- **Review lens** identifies the material currently under review.
- **Coaching depth** controls how strongly the agent scrutinizes that material.
- **Scope action** clarifies, expands, contracts, or probes the current intent.
- **Baseline** is the exact package version and digest the author chooses to
  hand off.

Review findings remain source-bound. Default shaping explicitly authorizes
grounded exploration inside the stated subject. A kind lens supplies private
decision-tree starting branches, not a missing-topic checklist. `--minimal`
disables that exploration. Candidate ideas stay in the authoring workspace
until the author accepts their meaning and an exact package change.

The default response is two to five conversational sentences and one clear
question. During the seed thread, for example:

> This seed says we are making a shared authoring engine with CLI and web
> experiences that produce the same portable artifacts. Is that still the
> direction you want?

When the author confirms the direction, the agent records that privately and
continues. When it notices a concern grounded in the authored material, it
describes one issue in product language and first asks whether the author wants
to address it. Exact replacement wording comes only after the author says yes.

When a consequential decision has two or three concrete options, the agent uses
the host's native single-choice control when one is available. It puts the
recommended option first, marks it recommended, states one material tradeoff
for each option, and preserves a free-form discussion path. A host without a
question control receives the same choice as numbered Markdown. The agent does
not invent completeness scores, time estimates, or numeric comparisons.

The author may finish an area as:

- `improved` — they accepted one or more changes;
- `good-enough` — they reviewed the area and chose its current depth; or
- `not-relevant` — the area does not apply to this seed.

All three produce `outcome: reviewed`. A reviewed area records a conversation;
it does not certify completeness or quality.

## The active context boundary

Source-bound review uses the current package and active authoring workspace by
default. It ignores archived or backup workspaces, sibling authoring
directories, git history, old passes outside the active workspace, and the
SeedSpec engine implementation unless the author explicitly brings one of
those into scope.

An empty active source list is valid. It commonly means the current package
documents are the authored material. The agent should not search for retired
sources, compare against historical versions, or narrate the files and commands
it used to orient itself.

## Requirements-heavy source material

When attached material contains approved requirements, source precedence, or
explicit unresolved product choices, the agent loads the version-matched
requirements guidance:

```bash
npx @seedspec/cli author guidance --topic requirements
```

The guidance classifies supplied meaning as fixed behavior, deliberate
configuration, author-owned decisions, implementation delegation, supporting
material, or ambient context. It does not supply a domain checklist.

Attachment makes a source available to the authoring review. It does not add
that source to the package. Consequential approved detail must enter package
bytes through an accepted document proposal. Substantial operational detail
can use a package-local Markdown context module, while intent, success, and
configuration retain their existing roles.

An explicit author-owned or non-delegable choice remains unfinished until the
author decides it and the accepted meaning enters package bytes. Unapproved
material cannot create requirements, exclusions, configuration, or technology
choices without author acceptance.

After accepted meaning enters the package, its candidate ID can ground later
coordinated proposals while at least one applied document that carries the
meaning remains unchanged. Unrelated package changes do not revoke the author's
decision. If every applied anchor changes or disappears, the engine rejects
reuse until current meaning and authority are established again.

## Exploration, facts, and decisions

The authoring agent separates facts it can retrieve from decisions the author
must make. It inspects the active package, attached sources, and available tools
instead of asking the author to repeat known information. A roadmap or vision
can bound scope when the author supplied it or accepted it as an active source;
a discovered filename has no authority by itself.

Default shaping privately compares plausible interpretations. If two competent
teams could build materially different products, the agent asks the author. If
they would build different implementations of the same product, the agent
preserves implementation latitude for later technical planning.

The agent can fill editorial and organizational gaps. It can recommend a
conventional, low-risk product default, but that recommendation does not become
author intent until accepted. Each consequential question includes a
recommended answer and the material consequence of choosing differently.

Deep discovery walks the decision tree in dependency order and asks one
question at a time. Before drafting, it summarizes fixed meaning, deliberate
configuration, delegated implementation choices, supporting material,
exclusions, accepted defaults, and unresolved decisions. The author confirms
that shared understanding before exact document proposals begin.

Product behavior stays separate from technical architecture. Implementation
complexity can justify later technical planning, but it does not authorize the
authoring agent to invent code shape or system design.

## Choose how supporting material travels

When an author has included—or asks to include—reference code, a design system,
an implementation skill, or other supporting material, the authoring
conversation should make its delivery choice explicit:

- **Linking** keeps the package small and can expose current upstream
  documentation, but access, content, and the exact units an agent consults may
  vary at implementation time.
- **Bundling** gives consumers the same local, inspectable bytes and lets the
  author curate the exact units that should guide implementation, but it adds
  package weight and maintenance responsibility.
- **Canonical plus bundled fallback** supports verified remote acquisition while
  retaining known-good local material when the remote source is unavailable.

Agents may reasonably decline to download code from an unfamiliar URL even
when they are willing to inspect package-local reference content. Conversely,
an external link can be sufficient when the author wants visual or conceptual
direction rather than guaranteed source reuse. The author should say which
outcome they intend and whether the realization may proceed when the material
cannot be retrieved.

A few megabytes of bundled material are usually inexpensive to distribute.
Authors should still prefer a relevant curated subset over hundreds of
speculative components, because excess material creates review, dependency,
licensing, and integration cost beyond raw download size. See
[Implementation resources](implementation-resources.md#link-bundle-or-use-both)
for the complete tradeoff and trust model.

The absence of supporting material is not itself an authoring defect. Raise this
choice when supplied intent or an existing declaration makes the material
relevant; do not turn it into a universal packaging requirement.

## Preserve declared material by default

The operating brief exposes declared context modules, implementation resources,
profiles, tasks, artifacts, reference material, and evidence. Visibility helps
the authoring agent understand the package; it is not authority to rewrite or
activate the material.

Existing non-primary context-module bodies are fixed inputs to the authoring
cycle. The authoring proposal and apply operations reject package-local paths
inside those modules. The agent can inspect a module when its declared role is
relevant, but it cannot rewrite the module to reconcile the surrounding spec.

When fixed module behavior conflicts with core intent, change SeedSpec-owned
documents or declarations around the module when that preserves the author's
intent. If the module itself must change, maintain it through its native
workflow. Resume authoring after the updated module bytes and declarations form
the new package baseline.

Other supporting material is preserve-by-default:

- do not optimize, normalize, migrate, rewrite, or remove their bodies merely
  because another structure appears preferable;
- review their declared purpose, usage, applicability, authority, delivery, and
  relationship to core intent;
- open a supporting body only when its declaration makes it relevant, a core
  claim depends on it, a reference is broken, or the author asks about it;
- do not conduct a general quality audit unless the author explicitly asks to
  review the named material; and
- propose a body edit only after the author explicitly requests that edit or
  accepts addressing a source-grounded conflict that requires it.

Before an intentional supporting-material edit, identify the declarations and
verification that bind the material. Bundled implementation resources carry an
independent version and digest. Changing their bytes without a matching
declaration update breaks validation. Artifacts can carry native format,
version, conformance, or relationship metadata. Every package-local change also
changes the package digest and can stale authoring proposals, resolved-project
locks, receipts, or evidence.

A declared skill remains guidance, and a declared verification resource or eval
remains supporting verification material. Authoring does not install or invoke
the skill, execute the eval or tool, fetch a remote resource, or promote its
contents into product intent without separate explicit authority. Product
behavior that matters must remain independently recoverable from core intent,
requirements, capability contracts, configuration, or success material.

## Declare context modules and bridges

When supplied material has a stable semantic format and an agent-facing
entrypoint, authoring can declare it as a context module. The authoring tool
should capture:

- one package-local module ID;
- the native namespaced format and optional version;
- a short discovery description;
- one entrypoint and source;
- relevant purposes and audiences; and
- zero or more explicit bridge Skills.

A format integration may offer default bridge Skills. The authoring tool can
recommend compatible defaults, but it writes only the author's actual
selection into `context.modules` and the target module's nested `bridges`.
The author can accept, replace, add, or remove a proposed bridge. Runtime
resolution must not restore an omitted default.

Use `seedspec context discover` to inspect compatible integrations. Use
`seedspec context author` for a dry-run bridge plan. Add `--write` only after
the plan matches the intended module IDs, paths, and bindings.

Use `seedspec context add <package> --skill <path-or-github-url>` when the
author selects a standalone task Skill. Review its dry-run files,
applicability, destination, and digest. Add `--write` only after they match the
author's selection. The command reads optional publisher defaults from the
Skill repository's `seedspec.yaml`; explicit purpose and audience options
override them.

Prefer a bridge whose scope matches the target module and purpose. Do not use a
bridge to add requirements absent from the native format. Preserve task Skills
as independent modules when they perform domain work rather than explain how to
consume another module. See [Context modules and bridge
Skills](context-modules.md).

## Source-bound findings

Absence is not a gap. A default finding must cite package or supplied source
material that created it.

Grounded examples include:

- two authored statements that cannot both guide the same realization;
- one authored statement with materially different plausible meanings;
- a declared configuration option whose effect is not explained;
- a broken declared reference;
- success material that promises behavior absent from the seed; or
- a seed outcome for which the declared success material provides no
  observation.

The absence of taxation, refunds, identity, retries, accessibility, hosting,
security, or any other common topic is not a finding when the seed never
introduces it.

A domain skill may evaluate a concept the author wrote about. It must not use
its checklist to introduce unrelated requirements. Default shaping can explore
consequential forks inside the stated subject. Broader ideation that enlarges
the subject remains a separate, opt-in conversation:

> Would you like to brainstorm possible expansion beyond the current seed?

Ideas from that conversation remain optional suggestions unless the author
accepts them into the package.

## Contradictions are different

A genuine contradiction prevents the same seed from giving coherent direction.
The agent should cite both claims, explain the conflict plainly, and help the
author resolve it.

If both claims are intentional alternatives, the agent may help express them as
clear authored variation. It must not silently choose one or hide the
contradiction behind implementation latitude.

## Configuration is authored behavior

Configuration is not an automatic destination for unresolved questions. It
expresses product variation the package author deliberately offers.

When configuration is declared, the authoring agent reviews:

- what may be selected;
- what each option or value means;
- what behavior changes;
- applicable constraints or invalid combinations; and
- how the selected behavior affects observable success when consequential.

If the author declines to expand a gap, the tooling does not automatically
create configuration, a portable question, a task, or future implementation
work.

## Questions belong to the current conversation

`open-questions.yaml` records questions raised during this authoring session so
the session can resume honestly. Those questions are not automatically part of
the package and are not obligations for a future implementing agent.

If the author deliberately wants a consumer-selected decision in the package,
they author it using the package's configuration or decision vocabulary with
clear meaning. Declining an authoring suggestion is simply a decision to leave
the seed as written.

## Clarification candidates separate inference from intent

A clarification candidate records a consequential ambiguity before the agent
asks the author to choose its meaning. Ordinary input supplies the issue,
plausible alternatives, source claims, and separate model inference. The engine
assigns an opaque ID and safe classification defaults. Probe evidence can add
the richer materiality and affected-concern classification. Routine
confirmation and factual questions remain ordinary conversation questions.

The author may accept, decline, delegate, defer, or retain ambient latitude.
Candidate disposition does not mutate the package. Accepted meaning must enter
an exact document proposal with the candidate ID as its basis. The thread cannot
close, and the package cannot be packed, until accepted meaning is applied.

## Frozen clarification probes are explicit

A prior probe asks one receiving model to interpret the current package before
the author chooses. It is optional. Preparing a probe does not call a model.

`author probe-prepare` writes an external frozen bundle. The bundle binds exact
package bytes, workspace revision, instructions, visibility, model, runner,
settings, tools, limits, pricing basis, and retention policy. The command fails
before execution when its context or projected budget exceeds the ceiling.

Run `author probe-check` immediately before model execution. Import the result
with `author probe-record`. A valid run records either one author-facing question
or no action. A failed, stale, over-budget, or invalid result is quarantined.

One run creates one candidate occurrence. It does not create or imply a
comparison group. Probe output cannot mutate package bytes. Accepted meaning
still uses the ordinary proposal, decision, and application operations.

## Author authority and changes

The agent records each exact text replacement through `author propose` and shows
the resulting proposal ID, package path, and wording. This does not change the
package. After the author responds, `author decide` records explicit acceptance
or rejection. `author apply` writes only an accepted proposal whose package and
document bytes remain current. Silence, continued conversation, or acceptance
of another change is not approval. Before application, the author can reject a
previously accepted proposal. The workspace retains both decisions.

Use `author changes` to inspect before and after content. Proposal state remains
in the authoring workspace and is not part of the distributable package or
Protocol conformance. A thread cannot close with a proposed or accepted change.
An accepted but unapplied change blocks packing so accepted intent cannot be
silently omitted from the release bytes.

Every mutation uses the workspace revision printed by `author review` or the
previous mutation receipt. The CLI serializes local mutations and rejects a
missing or stale revision. Mutation receipts contain the changed record and new
revision; complete candidates, proposals, and document bodies remain on disk
and are available through the read commands.

The review result privately separates:

- `summary` — the substantive product direction, clarification, or authored
  choice confirmed when a thread is reviewed;
- `inventory` — factual package contents;
- `findings` — source-cited interpretive concerns;
- `contradictions` — incompatible authored claims;
- `suggestions` — optional expansion ideas;
- `tooling_feedback` — SeedSpec platform or authoring-tool defects; and
- accepted, proposed, and rejected package changes.

Platform defects do not become package-author questions. Nonblocking tooling
feedback is recorded without interrupting the authoring conversation.

The result is not a transcript or activity log. While a thread is awaiting the
author, `summary` remains empty and the current question belongs in
`questions.asked`. A reviewed summary preserves what was substantively
confirmed; it must not say merely that the agent read, reflected, reviewed,
asked a question, ran commands, or changed files.

## Coaching depth

The `minimal`, `shape`, `deep`, `harden`, `compose`, and `package` targets tune
how closely the agent examines authored material. They never authorize a
generic completeness checklist:

- `minimal` preserves supplied intent with the least interpretation;
- `shape` explores the stated subject into a practical planning baseline;
- `deep` walks consequential decisions with the author before drafting;
- `harden` scrutinizes high-consequence claims the author actually made;
- `compose` examines relationships among declared material; and
- `package` improves portable clarity without treating distribution as
  completeness.

When a package declares bundled composition, the supporting-material review
examines each linked integration Markdown file against the parent and child
intent. It can suggest prose about responsibility boundaries, concept mapping,
state ownership, cross-boundary actions, configuration mapping, loading and
failure states, excluded responsibilities, and observable integration checks.
These are authoring prompts, not protocol-required headings. The review does
not propose components that the package does not declare.

## State and compatibility

Authoring state remains outside the distributable package:

```text
<authoring-state>/
├── workspace.yaml
├── sources.yaml
├── open-questions.yaml
├── change-proposals.yaml
├── candidates/
│   └── index.yaml
├── probes/
│   ├── index.yaml
│   └── runs/
│       └── <run-id>/
└── passes/
    └── 0001-seed/
        ├── request.yaml
        ├── instructions.md
        └── result.yaml
```

New passes use instruction format `0.21` and result format `0.3`. An active
source-bound pass that uses the current result format is refreshed to the
current conversation and record brief when review resumes, without discarding
its result state. Existing `0.2` passes and their seven legacy area IDs remain
readable and are preserved in history. A new review continues with the four
source-bound private threads instead of rewriting old records.

## Review is not a packaging gate

A package with stable valid bytes and separate authored success material can be
packed even when some guided areas remain unreviewed or the local authoring
session retains questions, undecided candidates, or undecided proposals.
Publish checking reports those conditions as advisories. Accepted clarification
meaning and accepted document changes must be applied before packing.

Publishers and organizations may impose stronger review profiles for their own
catalogs. Those policies must not be presented as the universal definition of
a valid or useful seed.
