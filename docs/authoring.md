# SeedSpec Authoring

> **Informative guidance.** This document describes authoring practices and
> reference tooling; it does not define package conformance.

Authoring is a guided intent-discovery and refinement workflow, not a
requirement to hand-edit manifests. The reference interfaces below all produce
the same portable protocol package and leave room for additional authoring
experiences.

## Authoring interfaces and frontends

The canonical SeedSpec package is declarative YAML, JSON, Markdown, and declared
artifacts. Authors should be able to produce that package through interfaces
suited to their experience and source material rather than being required to
construct every file by hand.

The included 0.1 authoring toolset is implemented in JavaScript for Node.js and
currently provides:

- `seedspec init <kind>` for kind-specific package scaffolding;
- `seedspec audit <package-path>` for a versioned, kind-aware authoring review;
- `seedspec validate` and `seedspec lint` for structural validation and
  deterministic authoring feedback;
- `seedspec docs authoring [area]` for guidance bundled with the installed
  tool version; and
- agent-guided application and feature authoring skills under `skills/`.

Additional tooling may offer web forms, conversational agent flows, visual editors,
language-specific builders, or other higher-level frontends that compile to the
canonical package. Such frontends could provide reusable helpers, stronger
construction errors, collaborative review, and organization-specific
conventions without becoming dependencies of the generated SeedSpec.

Generated output must pass ordinary package validation and must be usable by a
consumer that has none of the authoring frontend installed. Executable authoring
source may travel as an optional artifact, but validation or implementation
must not execute it implicitly. Reproducible authoring tools should produce the
same package bytes from the same source and inputs and should surface generated
changes for author review.

## Agent-guided audit lifecycle

The reference authoring workflow assumes that a capable agent runs the CLI
beside an author. SeedSpec does not embed a model. The CLI owns protocol-aware,
deterministic work: validating packages, selecting a kind-aware review lens,
tracking pass state, emitting current instructions, and checking the shape of
results. The agent owns semantic work: inspecting source material, identifying
material uncertainty, asking the author for decisions, editing the package,
and explaining its judgment.

Start or continue the next incomplete audit area with one command:

```bash
seedspec audit <package-path> [--target <depth>]
```

The command emits a Markdown work order for the agent and initializes a
standardized YAML result. After the agent records a completed result, running
the same command advances to the next incomplete area. There is deliberately no
`next` command: progression is derived from durable pass state rather than a
transient cursor. The output lists all seven areas and tells the agent which area
would follow an accepted pass.

Target one area for an initial or repeated review with `--area`:

```bash
seedspec audit <package-path> --area material-ambiguity
```

Inspect existing state without creating or changing files with `--status`.
Text is the primary agent-and-human interface; `--json` exposes the same state
for another harness. `seedspec docs authoring [area]` prints guidance shipped
with the installed tool, so an agent does not need to guess from possibly newer
web documentation.

The ordered review areas are:

1. **Concern separation** checks the primary intent source, purpose,
   obligations and boundaries, success and evidence, decision latitude,
   configuration, additions, implementation profiles, supporting artifacts,
   resources, and package-evidence boundaries.
2. **Kind-aware discovery** applies the selected `kind` as an authoring lens,
   never as a fixed template or validity gate.
3. **Material ambiguity** identifies competing interpretations that could
   materially alter behavior, authority, data treatment, portability, or
   success.
4. **Decision provenance** describes consequential decisions, their
   materiality, expected latitude, proposed and selecting parties, constraining
   sources, and attribution confidence without treating author control as a
   quality score.
5. **Internal consistency** combines deterministic diagnostics with semantic
   review across package concerns.
6. **Progressive hardening** evaluates the requested capture, shape, harden,
   compose, or package depth without treating depth as a quality score.
7. **Agent-ready handoff** tests the package as an independent implementation handoff,
   including the actual output of `seedspec begin`.

One nonterminal pass is active at a time. `needs-author` keeps the pass active
when a consequential decision requires the author. `completed` means that the
area has a validated review record; it does not certify that the package is
complete, high quality, or free of open questions. `abandoned` and
`superseded` preserve history while allowing a later pass to revisit the area.

The audit command has no package-writing or `--fix` mode. Creating a pass writes
only audit state. A capable agent may apply explicit author decisions,
source-supported refinements, and mechanical corrections to the package, then
must record their basis and the final package digest. Suggestions and
consequential inference stay out of the distributable package until confirmed.

## Authoring state

By default, audit state lives in a sibling directory named
`<package-path>.seedspec-authoring`. Use `--state <directory>` to choose a
different location. The CLI rejects any state path inside the distributable
package.

```text
<authoring-state>/
├── workspace.yaml
├── sources.yaml
├── open-questions.yaml
├── candidates/
└── passes/
    └── 0001-concern-separation/
        ├── request.yaml
        ├── instructions.md
        └── result.yaml
```

`workspace.yaml` binds the review to a package, protocol version, target depth,
and last observed digest. Package paths are relative to the state directory
when possible. `sources.yaml` inventories authoring inputs,
`open-questions.yaml` keeps unresolved decisions out of distributable intent,
and `candidates/` holds speculative material. Each pass records the exact
instruction, tool, and protocol versions plus before-and-after package digests,
findings, questions, changes, and validation evidence.

The concern-separation pass records a proposed canonical owner for misplaced or
duplicated material before an agent restructures the package. The
decision-provenance pass records the authored decision surface as structured
findings: materiality, expected latitude, proposing and selecting parties,
constraints, evidence, and confidence. These records remain authoring state;
they do not become package authority merely because an evaluator produced them.

Authoring state is local and is never bundled, uploaded, synchronized, or
exported implicitly. The stable layout is intended to support manual sharing
now and an explicit export or hosted scratch-space flow later.

## One primary intent source

Every package has one package-author primary intent source at
`definition.entrypoint`. Native SeedSpec authoring should keep this source
physically compact and make four semantic areas easy to find:

1. **Purpose** explains the problem, objective, desired change, and affected
   actors.
2. **Obligations and boundaries** distinguish required outcomes, invariants,
   constraints, forbidden states, and non-goals.
3. **Success and evidence** separates realization acceptance from later outcome
   evidence and explains credible observation methods.
4. **Decision latitude** identifies fixed intent, choices reserved for the end
   user, and choices delegated to the implementing agent.

These are semantic areas, not a requirement to create four files. A single
clear Markdown document is preferable to scattering small fragments, but a
large document should not absorb acceptance, implementation-profile guidance,
configuration, resources, or agent routing merely to minimize file count.
Agent-facing instructions should identify authoritative locations and conflict
rules instead of repeating their content. Kind-aware questions add relevant
depth inside these areas.

## Describe the decision surface

Decision provenance is descriptive. A package that deliberately delegates
architecture to an agent is not weaker than one that ships normative reference
code merely because the author made fewer choices. The useful question is
whether the package makes the intended distribution of decision authority
clear enough to compare with a later realization.

For each consequential decision, distinguish who proposed an option, who is
expected to select it, what constrains it, and who will implement it. Use
`fixed`, `preferred`, `delegated`, `open`, and `unresolved` to describe expected
latitude. Classify materiality as critical, material, or minor and record the
basis for the classification. Preserve mixed or unknown attribution rather
than manufacturing precision.

Reference implementations and other realization artifacts should make their
influence on identified consequential decisions clear when it matters:
normative decisions are expected to be preserved, preferred decisions are
strong defaults, and illustrative decisions teach without silently
constraining the realization. Do not label an entire reference artifact
normative by default. Decision influence also does not activate an artifact or
its native workflow. A later evaluation can compare this authored decision
surface with observed agent choices, including whether material inferences
were disclosed or made ambiently.

The primary source may instead use a recognized external intent format. Declare
the same package-local file as an artifact with the intent concern and reference
its artifact ID from `definition.artifact`. The file is then core intent in its
native format. Adapter validation remains separate from SeedSpec package
validation, and the format's own workflow is not activated automatically.

## Author intent and end-user applied intent

Package authoring defines a reusable baseline. Resolution asks the end user the
same classes of questions for one realization: what the package should solve
here, which obligations and boundaries apply, what the agent may decide, and
what observations would establish success.

The agent should infer a concise draft from the user's request, package, and
read-only environment evidence before asking questions. It should ask only
about material uncertainty, label its additions `proposed`, and let the user
affirm or correct a compact summary. The resulting applied-intent input records
each package as `as-authored`, `adapted`, or `partial` and may add local intent
contributions. It is project state, not a mutation of the published package.

Authoring and adoption tools should use the same semantic vocabulary while
changing the lens:

- package author: what should generally be true for a faithful realization;
- end user: what must be true in this environment for this use; and
- agent: what can be observed, safely inferred, or must be confirmed.

If the two intent layers conflict materially, the agent should recommend
adaptation, partial reuse, or rejection before selecting an implementation
profile. It must not silently convert partial reuse into a full-package claim.

## Starting altitude

SeedSpec authoring may begin from a sentence, an existing product document, a
structured specification, a prototype, an architecture, a runbook, an existing
configured system, or a working application.

Preserve the supplied source and add only the structure justified by what is known. A sparse idea is not invalid merely because actors, capabilities, configuration, or acceptance criteria have not yet been fully developed. Do not manufacture details to make a package appear mature.

Authoring can proceed progressively:

1. **Capture** preserves the source idea in a minimal conforming package.
2. **Shape** identifies actors, outcomes, workflows, domain concepts, and meaningful variations.
3. **Harden** adds permissions, invariants, constraints, forbidden states,
   non-goals, failure behavior, edge cases, observable acceptance criteria, and
   explicit evidence subjects.
4. **Compose** identifies capability context, SeedSpec feature candidates, and related artifacts.
5. **Package** optionally selects versioned implementation resources and
   decides whether additional guidance discovery is delegated to the agent.

The user may stop at any stage. Authoring depth is a workflow choice, not a different protocol format or a package-quality claim.

## Choose the intended realization context

The same protocol may describe different forms of outcome. Authoring tools
should tailor discovery without turning those forms into separate protocols:

- **Application:** identify actors, domain concepts, permissions, workflows,
  state, failures, and observable product behavior.
- **Configured system:** identify the target account or environment, required
  access, existing-state discovery, naming and ownership, idempotency, rollback
  expectations, and durable records of created or changed resources.
- **Automation:** identify triggers, schedules, timezones, data meaning,
  recipients, side effects, retries, duplicate prevention, failure handling,
  and delivery evidence.
- **Composite solution:** cover the relevant combination and the boundaries
  between code, configured systems, automated work, and human operations.

Use the nearest manifest kind hint—`solution`, `application`, `feature`,
`workflow`, `automation`, `configuration`, or `integration`—to communicate the
expected shape and tailor authoring prompts. The hint does not impose a fixed
template, minimum depth, composition role, or implementation form. A sparse
package remains valid when details are not yet known. Authoring tools should
identify gaps and offer refinement rather than inventing completeness.

Use a namespaced custom kind only when no core hint is reasonably descriptive;
generic consumers will treat it like `solution` while preserving the value.

Provider-specific intent is valid. Portability does not require forced
generality: a HubSpot-authored solution may name HubSpot throughout. The author
should distinguish invariant outcomes from provider assumptions when doing so
would materially help an agent adapt the package, but should not erase useful
expertise merely to claim generic compatibility.

## Separate core intent, configuration, additions, and implementation profiles

- Core intent represents the outcome, behavior, capabilities, and success
  criteria that should survive implementation choices.
- Configuration represents meaningful variations in solution behavior.
- Additions extend or modify the composed intent; `feature` is the usual kind
  hint but not a composition requirement.
- Implementation profiles describe materially different platforms,
  architectures, or approaches for accomplishing the same core intent.

Keep related realizations discoverable together when their shared intent and
tradeoffs help an agent make a better decision. Record the selected direction
prominently while preserving concise context for alternatives that were
declined, deferred, or left unreviewed. An agent may explain a conflict and ask
the user to reconsider; it must not silently replace the recorded preference.

Give each implementation profile a concise name and description. Add guidance
only when it materially helps execution. Express viability as declarative
prerequisites and blockers rather than hard-coded interview scripts:

```yaml
implementation_profiles:
  - id: hubspot-dashboard
    name: HubSpot-native dashboard
    description: Realize the outcome primarily with HubSpot reporting and workflows.
    guidance: implementation/hubspot-dashboard.md
    prerequisites:
      - id: uses-hubspot
        statement: The organization uses HubSpot as the relevant system of record.
        verification:
          method: user-confirmation
          evidence: optional
    blockers:
      - id: native-fidelity-gap
        statement: Native capabilities cannot produce the required behavior faithfully.
        verification:
          method: environment-inspection
          evidence: required
```

Use `user-confirmation` when organizational truth or authority must come from a
person, `environment-inspection` when the agent can establish the condition
from actual state, `tool-check` for an authorized non-mutating probe,
`document-review` for controlled records or policy, and `manual-observation`
when a person must observe the result. Set evidence to `none`, `optional`, or
`required` independently from the method.

## Distinguish evidence before collecting it

Authors should state what an observation is meant to prove:

- package evidence supports a claim about the package, its testing, or known
  compatibility;
- a verification plan states how a future scoped realization or outcome should
  be judged;
- baseline evidence references observations about the end user's current
  environment before work and belongs with an `observed` applied-intent
  contribution;
- realization evidence demonstrates the produced solution or configured state;
  and
- outcome evidence demonstrates later effects such as changed behavior or an
  operational metric.

These categories do not substitute for one another. A tested reference
realization does not prove the user's realization. A successful user
realization does not prove that the package is generally portable or safe.
Authoring audits should flag evidence language whose subject or lifecycle stage
is ambiguous.

Every included completion-scope item receives an explicit verification plan
before implementation. The plan states the realization or outcome subject,
method, timing, and evidence requirement. Actual results belong only in
verification state after work begins.

## Related artifacts

Authors may include existing product documents, structured specifications, designs, execution plans, infrastructure descriptions, or evidence as optional `artifacts`. Preserve each artifact's native format and label the concern it addresses; do not merge separate concerns merely to make the SeedSpec look more complete.

Declaring an artifact alone does not select its workflow for an end user or
implementing agent. `definition.artifact` may identify the artifact content as
the package's primary intent, but even that does not activate its native
workflow. An author may explain why supporting material is useful, but should
not encode generic `governing`, `advisory`, or automatic activation policy.
Artifact-specific validation and transformation belong to adapters that a user
invokes explicitly.

## Implementation resources

Authors may select public, versioned skills, instructions, verification
material, tools, and target profiles through `implementation_resources`.
Authoring tools should offer tested first-party resources as defaults, but must
allow the author to exclude them. SeedSpec core does not inject a universal
guidance pack merely because it exists.

Prefer skills over long unconditional instructions when the implementing agent
can determine relevance from concise frontmatter. Include a resource only when
it contributes tested decisions, SeedSpec-specific integration behavior,
reusable packaging, executable verification, or a recurring lesson that agents
otherwise miss. Generic advice the agent already knows is a context cost, not a
benefit.

A bundled skill is package-scoped, not environment-installed. Write its
frontmatter description so an agent can understand the work it helps with, but
do not rely on native skill discovery or automatic invocation. Keep `SKILL.md`
self-contained enough to be consulted from the resolved handoff, keep supporting
references relative to the skill root, and use the resource's `usage` and
`applies_to` fields to communicate why and when the author expects consultation.
The skill explains how to work; the package's core intent and acceptance
material remain the authority for what outcome is requested.

Choose `required`, `recommended`, or `available` deliberately. Decide separately
whether additional catalog discovery is `agent-delegated` or `none`. Use
`applies_to` as matching context without claiming an actual implementation has
the named capability.

For bundled resources, run `seedspec resource-digest <directory>` and record the
exact digest. Prefer an exact canonical version for reproducible packages.
Tracking policies are appropriate only when the author accepts implementation-
time change and the resolver's exact resolved version will be recorded.

## Application workflow

Start at the level of detail the user supplies. For shaping or hardening, identify the intended outcome, actors, roles, domain concepts, fundamental workflows, permissions, business rules, state transitions, failure behavior, meaningful configuration candidates, and acceptance criteria. Ask only questions whose answers materially change behavior; use reversible values in the package example for the rest without implying that an end user selected them.

For capture-only work, preserve the original idea, use an empty configuration object when no behavioral choices are known, allow an empty capability list, and record important unknowns without forcing the user through full product discovery.

Give each provided capability a namespaced ID, exact revision, and product-behavior contract. For each required capability, record the exact revision the consumer was designed or tested against. Create the package, then run:

```bash
seedspec validate <package-path>
seedspec inspect <package-path>
```

## Feature workflow

When a resolved project exists, inspect `.seedspec/project.yaml`,
`resolved-intent.yaml`, `resolved-spec.md`, `agent-guide.md`,
`implementation-notes.md`, and `dependencies.lock.yaml` before asking
questions. Reuse known actors, terminology, configuration decisions, and
capabilities. Declare only the capabilities the feature truly uses and the
capabilities it adds.

Keep origin context, the portable feature, and project integration decisions distinct. Before sharing a feature broadly, remove application-private assumptions, replace narrow terminology, convert variable behavior into configuration, declare known conflicts and unresolved decisions, and select an explicit compatibility scope.

Capability, compatibility, and conflict declarations describe author intent and
testing evidence. Do not claim they prove that a realization implements a
capability or that a feature is compatible. The implementing agent makes that
determination from the actual project.
