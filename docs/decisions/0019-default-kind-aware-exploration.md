# Decision 0019: Default to kind-aware requirements exploration

- Status: accepted for the reference authoring product
- Date: 2026-08-04

## Context

Decision 0014 made authoring source-bound after a seven-pass audit manufactured
missing requirements from generic product checklists. That correction protected
author authority, but the later optional `--explore` prompt existed only in the
agent's opening context. The durable operating brief still treated absence as
non-actionable and excluded expansion from clarification candidates.

A same-kernel slide-deck rerun demonstrated the result. A fresh agent accepted
the central direction, wrote four success observations, and closed all review
areas after two questions. The package was valid and settled but did not explore
consequential authority, lifecycle, persistence, goal-change, removal, undo, or
scope-expansion branches.

The Warp article [How to build a cloud software factory: add spec-driven
development
skills](https://www.warp.dev/blog/how-to-build-a-cloud-software-factory-add-spec-driven-development-skills)
routes work by ambiguity and complexity. When many plausible product or
technical realizations differ significantly, a human should weigh in before
implementation. It also uses roadmap and vision material to determine fit,
separates product behavior from technical architecture, retains specifications
for later implementation and verification, and recommends interactive
refinement for ambiguous work.

## Decision

1. Practical requirements exploration is the default authoring posture.
2. `shape` uses reasonable recommendations and asks only when alternatives
   produce materially different products.
3. `deep` walks consequential decisions in dependency order, one question at a
   time, and gives a recommended answer for each.
4. `minimal` treats supplied material literally and performs only necessary
   shaping. The public opt-out is `author prompt --minimal`.
5. The author can choose deep discovery in the default opening conversation or
   select it directly with `author prompt --deep`.
6. The selected posture uses the existing durable coaching target in
   `workspace.yaml`; fresh agents receive the same posture.
7. Each package kind supplies private decision-tree starting branches. These
   branches are not mandatory questions, required sections, or evidence that an
   absent domain topic is a gap.
8. The agent retrieves available facts from the active package, approved
   sources, filesystem, and tools. Consequential product decisions remain with
   the author.
9. A roadmap or vision bounds scope only when supplied by the author or accepted
   as an active source. A discovered filename has no authority by itself.
10. If two capable teams could build materially different products from the
    current meaning, the agent asks. If the difference is implementation-only,
    it preserves delegation for later technical planning.
11. Model-recommended defaults remain optional product expansion until the
    author accepts their meaning and exact package wording.
12. Deep discovery summarizes fixed meaning, configuration, delegation,
    supporting material, exclusions, defaults, and unresolved decisions before
    drafting. The author confirms shared understanding first.
13. No posture uses a minimum question count, generic completeness checklist, or
    universal claim that discovery is exhaustive.

## Consequences

- Loose ideas receive active requirements formation without making every
  omission a defect.
- Already precise material can opt into minimal shaping.
- Ambiguous or complex subjects can use a grill-style interview without adding
  another authoring tool or protocol contract.
- Product decisions move upstream of implementation while technical design
  remains a later planning concern.
- Authoring prompts become longer because they carry interaction behavior to an
  arbitrary external agent.
- Agent variance remains an evaluation concern. The authoring evaluator must
  test whether default shaping finds consequential forks without inflating
  question burden or invented scope.
