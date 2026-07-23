# Why semantic structure matters

> **Informative explanation.** This guide explains why SeedSpec assigns stable
> roles to package material. It does not add protocol requirements beyond the
> normative specification and schemas.

A capable model can build useful software from a prompt, and a well-authored
Markdown specification can be an excellent implementation input. SeedSpec does
not assume that adding files or YAML automatically improves either one.

The harder problem appears when product and domain knowledge must survive
handoffs: from an expert to an authoring agent, from an author to an adopter,
from one team to another, from a catalog to a project, or from one implementing
agent to another. An informal document may contain all the necessary material
while leaving every recipient to reconstruct its authority and applicability.

SeedSpec gives recurring concerns stable semantic ownership so people and tools
can preserve those distinctions instead of repeatedly inferring them.

## The semantic roles

### Product intent: what must be true

The primary intent source records the desired outcome, actors, obligations,
invariants, constraints, forbidden states, non-goals, success, and decision
latitude. It is the package author's reusable baseline, not an implementation
plan or a record of one adopter's choices.

### Configuration: what the adopter may choose

Configuration identifies meaningful product variation and validates the values
selected for one use. An example demonstrates a valid shape; it is not silently
treated as the adopter's decision.

### Decisions and provenance: who selected what, and why

Package-author intent, end-user applied intent, observed environment facts, and
agent proposals retain different attribution. This prevents a convenient agent
choice from being rewritten as though the author or adopter required it.

### Acceptance: how success should be evaluated

Acceptance material describes what should be checked. A verification plan says
what future evidence would establish; it is not itself proof that the outcome
exists or works.

### Implementation resources and tasks: guidance about how to do the work

Profiles, skills, instructions, tools, target guidance, and ordered task
runbooks can help an agent realize the intent. They remain subordinate guidance:
discovering or selecting them does not make them product intent, grant execution
authority, or prove that their advice was followed.

### Evidence: what has actually been observed or verified

Package evidence, baseline evidence, realization evidence, and outcome evidence
have different subjects. SeedSpec keeps those subjects explicit so evidence for
one claim is not presented as proof of another.

## Why one Markdown file is not always enough

One document can communicate these roles through careful headings and prose.
That may be sufficient for one author, one project, and one immediate handoff.
The limitations become operational when the material must be reused or
distributed:

- Which passages define product behavior and which are implementation advice?
- Which values are examples and which did this adopter select?
- Which open questions remain material?
- Who made a consequential decision, and for what context?
- Which artifact is authoritative when several overlap?
- Which exact revision was approved, tested, or supplied to an agent?
- What was planned for verification and what was actually observed?

SeedSpec does not forbid a compact primary document. It places machine-readable
identity, relationships, configuration, selections, and evidence state around
human-readable intent. A runtime can then inventory and preserve the material
without trying to understand every sentence or treating all prose as equal.

## What the authoring tools add

Protocol validity establishes that a package can be interpreted. It cannot
establish that an author discovered the important product rules or supplied
enough context for a strong realization.

The reference authoring workflow addresses that separate problem. Its guided
audits help an author or authoring agent:

1. separate intent, configuration, acceptance, design, and implementation
   guidance;
2. apply a kind-aware review lens without imposing a rigid template;
3. identify ambiguity that could materially change behavior or authority;
4. record decision provenance and preserve genuine unknowns;
5. check consistency across the package;
6. harden a seed progressively rather than manufacture completeness; and
7. inspect the handoff an independent implementing agent will actually receive.

This is why structure and tooling should be evaluated together. Empty folders
do not add expertise. Stable semantic roles plus guided authoring create a
better opportunity to capture, review, and reuse the expertise that exists.

See [SeedSpec Authoring](authoring.md) for the workflow and [evaluation
findings](evaluations.md) for the current evidence and limitations.

## Enterprise example: one approved widget seed

Suppose several teams repeatedly deploy a customer-support widget. A shared
document may describe the widget well but still leave operational questions:
which copy is current, which sections are policy, whether example values were
approved, which deployment constraints apply, and what evidence is required
before release.

An internal SeedSpec library can publish an exact package version and digest.
The package separates the widget's required behavior from adopter configuration,
records the source and status of decisions, carries platform-specific guidance,
and preserves acceptance material. An enterprise catalog or policy system—not
the neutral protocol—can designate the approved package and version.

The protocol does not create organizational agreement by itself. It gives the
organization an identifiable, inspectable object about which agreement can be
expressed and reproduced.

## Claim boundary

Semantic structure improves the opportunity to preserve meaning; it does not
make agent execution deterministic. A valid package may still be sparse,
mistaken, or poorly suited to a particular adopter. The authoring workflow can
surface gaps but cannot replace unavailable expertise or the authority to make
material decisions. The selected realization must still be evaluated against
its actual environment and completion scope.
