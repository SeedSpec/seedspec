# Decision 0014: Make authoring source-bound and seed-oriented

- Status: accepted for the reference authoring product; default exploration
  posture amended by [Decision 0019](0019-default-kind-aware-exploration.md)
- Date: 2026-07-24

## Context

The first authoring workflow ordered seven audit lenses and gated packing on
all seven completed results plus zero open authoring questions. Its
decision-provenance area instructed a capable agent to inventory every
consequential choice an implementing agent might otherwise make.

In manual co-authoring, a strong model followed those instructions literally.
It produced a decision inventory larger than the SeedSpec being reviewed and
promoted missing platform contracts and absent domain topics into package-author
questions. Progressive depth did not prevent this because every target still
ran the same review sequence.

This behavior conflicted with the central product idea: a SeedSpec is a useful
starting point for a person and implementing agent, not a complete
implementation specification.

## Decision

The default authoring workflow is source-bound.

1. Absence is not a gap. A finding must cite authored or supplied material that
   creates the concern.
2. Generic kind and domain checklists do not create missing requirements.
3. Broader ideation is opt-in and produces optional suggestions. Decision 0019
   later makes grounded exploration inside the stated subject the default while
   retaining this rule for unrelated scope.
4. Genuine contradictions between authored claims must be resolved or expressed
   as intentional alternatives.
5. Four private review threads replace the seven-pass default: seed, coherence,
   observable success, and configuration/supporting material. They organize
   agent attention and durable state, not the visible conversation.
6. `improved`, `good-enough`, and `not-relevant` are all successful author
   dispositions.
7. Configuration is deliberate authored variation, not a destination for every
   unresolved question.
8. Local authoring questions are not automatically portable package content or
   future implementation work.
9. Guided review is advisory for packing. Stable valid bytes and a separate
   package-authored success document are the reference readiness floor.
10. Legacy pass records remain readable and are not rewritten.
11. Source-bound is a restriction on findings, not an instruction to search for
    sources. Archived workspaces, git history, sibling directories, and engine
    implementation are outside the default context boundary.
12. The author-facing default is a short natural response and one useful
    question. Process narration, package enumeration, review-area explanations,
    and unsolicited exact rewrites stay out of the opening response.
13. The agent asks whether the author wants to address a grounded concern before
    drafting exact replacement wording. A displayed change still requires a
    second, explicit acceptance before application.
14. Durable review summaries preserve substantive author-confirmed direction or
    choices, not agent activity. A pending result keeps its summary empty and
    records the current question separately.

The agent remains free to help the author brainstorm when explicitly asked.
That conversation is intentionally separate from source-bound review.

## Consequences

- The author decides how deep a seed should become.
- A capable agent can explain omissions without calling them defects, but it
  cannot invent omissions from a generic product model.
- Decision provenance is recorded with actual author answers and accepted
  changes rather than reconstructed as an exhaustive audit.
- The web workbench can render the same inventory, findings, contradictions,
  suggestions, dispositions, and changes as the CLI.
- The CLI's operating brief carries the complete behavior contract to agents
  that have no installed SeedSpec skill. Decision 0019 later permits a longer
  copied prompt so the selected exploration interaction begins before review.
- Strong models may still inspect broadly to complete a task, so the active
  context boundary and prohibited author-facing patterns are stated explicitly
  rather than implied by the four review threads.
- Protocol 0.2 remains structurally backward compatible. Making `seed.md` and
  `success.md` the normative minimum package shape requires a future protocol
  family change rather than a silent change to the 0.2 schema.
