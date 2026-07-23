# SeedSpec evaluation findings

> **Informative evidence summary.** This document summarizes current
> experiments and their limitations. It is not part of protocol conformance and
> does not turn a result from one model, case, or realization into a universal
> performance claim.

SeedSpec evaluations ask whether explicit intent, guided authoring, semantic
structure, and portable package context give independent agents a better
starting state than the same source material without those advantages.

The evaluation system, case definitions, harnesses, traces, and detailed
reports live in
[SeedSpec/seedspec-evals](https://github.com/SeedSpec/seedspec-evals). They are
maintained separately so evaluation methods and evidence can evolve without
becoming protocol requirements.

## Current conclusion

The clearest result so far is that a real specification gives an agent a better
starting opportunity than leaving important behavior implicit. Making intent
explicit reduces the consequential product policy an agent must infer or
invent.

SeedSpec builds on that baseline. Its authoring workflow helps experts develop a
fuller specification, its semantic roles make the result easier to inspect and
adapt, and its package protocol lets organizations distribute an exact version
instead of passing around disconnected prompts or documents. None of those
advantages guarantees the implementation, but together they improve the
quality and reusability of the starting state.

## What the current work indicates

### Explicit intent reduces consequential invention

In the first authorship-gradient case, a zero-shot treatment made a material
custody-policy deviation, omitted a durable disagreement state, and selected an
unsupported time-zone policy. Treatments that received explicit author answers
preserved those boundaries more accurately.

The practical lesson is straightforward: an agent has a better opportunity to
preserve intended behavior when important product knowledge is made explicit
before implementation instead of being left for the agent to infer.

### Good Markdown is a strong baseline

The same experiment found that ordinary Markdown produced with strong general
specification guidance captured the tested material boundaries well. SeedSpec
cannot claim that multiple files, a manifest, or schema validity automatically
produce better product intent.

This negative result is important. SeedSpec's advantage must come from the
combination of guided authoring, stable semantic roles, provenance,
configuration, reusable resources, distribution, and downstream handoff—not
from file structure alone.

### Protocol validity is not specification quality

The minimal SeedSpec treatment passed deterministic package checks but omitted
material cancellation and overdue behavior and lacked part of the requested
accessibility evidence. A valid package can still be incomplete or weak.

Guided and restructured SeedSpec treatments more clearly separated product
authority, adopter configuration, acceptance evidence, and implementation
guidance. They also preserved open choices and decision provenance more
explicitly. That structure is most valuable when the specification must be
reviewed, reused, adapted, or distributed beyond its original authoring session.

### Specialized guidance can carry knowledge a model cannot infer

A later repeated experiment compared five authoring treatments across three
runs each for a specialized warehouse-transfer contract. Package-scoped skill
guidance covered **33 of 36** shared obligation observations, compared with
**14 of 36** for no guidance. Material decisions aligned on **21 of 21**
observations with the specialized skill, compared with **10 of 21** without it.

The result does not show that a skill file is magical. Embedding the same
content directly in the instructions was nearly as strong. The finding is that
relevant domain knowledge must be available and reliably consulted; a capable
model cannot consistently recover an unfamiliar contract it was never given.
Packaging the guidance preserves reuse, attribution, independent versioning,
and an inspectable consultation record.

### More guidance is not automatically better

In both repeated cases, blindly combining specialized guidance with a generic
audit increased cost without improving the result and sometimes reduced
coverage. Tooling should select and sequence relevant guidance rather than
stack every available workflow.

## Evidence table

| Current finding | Evidence strength | Appropriate interpretation |
| --- | --- | --- |
| Explicit product decisions reduce material agent invention. | Observed in the authorship-gradient case. | A real specification gives the agent a better starting opportunity than leaving the same decisions implicit. |
| General Markdown can be excellent. | Observed directly in the same comparison. | Semantic structure must add authoring, reuse, provenance, or handoff value; structure alone is insufficient. |
| A valid SeedSpec can still have material gaps. | Observed directly in the minimal treatment. | Protocol validity and seed quality must remain separate claims. |
| Guided semantic authoring improves explicit uncertainty and ownership. | Observed in the guided and restructured treatments. | The authoring system is a first-class part of SeedSpec's value. |
| Specialized packaged guidance can materially improve obligation coverage. | Repeated three times per treatment in one synthetic specialized domain. | SeedSpec can carry expertise that a general model cannot reliably infer, but broader replication is still needed. |
| Authorship gains produce stronger implementations. | Not yet established by the cited authorship experiments. | Implementation congruency across agents, models, and environments is the next evidence boundary. |

## Evaluation program

- The [evaluation repository](https://github.com/SeedSpec/seedspec-evals)
  contains the runner, cases, schemas, and operating instructions.
- The [evaluation lab
  plan](https://github.com/SeedSpec/seedspec-evals/blob/main/docs/labs.md)
  defines the broader authorship, runner-parity, implementation-congruency, and
  robustness program.
- [Evaluation
  profiles](https://github.com/SeedSpec/seedspec-evals/blob/main/docs/evaluation-profiles.md)
  define how decision alignment, obligation coverage, semantic ownership,
  process cost, and technical evidence are recorded without collapsing them
  into one unsupported quality score.

This page is the public interpretation of the cited July 2026 authorship and
skill-guidance runs. Run-level reports and evidence belong in the evaluation
repository rather than the protocol release bundle.

## What SeedSpec may responsibly say today

The results support these public statements:

- Explicit intent gives agents a better opportunity to preserve important
  product decisions than leaving those decisions implicit.
- A good standalone specification already provides substantial value.
- Semantic structure and guided authoring help preserve authority, choices,
  uncertainty, and evidence across reuse and handoff.
- Package-scoped domain knowledge can improve coverage when the model could not
  otherwise infer that knowledge.
- A valid package is not automatically a strong specification, and a strong
  specification does not guarantee a correct implementation.

The current results do not support a universal percentage-complete claim, an
exact prompt-savings claim, or a claim that every SeedSpec realization
outperforms every implementation from ordinary Markdown. Those questions
require controlled implementation-stage comparisons with matched models, tool
access, environments, and evaluation criteria.
