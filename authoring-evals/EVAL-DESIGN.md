# Controlled authoring evaluation design

## Questions and evidence

| Question | Primary evidence |
|---|---|
| Does authoring preserve source meaning? | Frozen meaning axes, source citations, semantic fidelity score |
| Does it invent scope? | Frozen obligations, forbidden inventions, invented-obligations score |
| Does it recognize consequential ambiguity? | Decision ledger, proxy-author questions, missed-decisions and question-burden scores |
| Does it respect fixed context modules? | Exact protected-path snapshot comparison and semantic assessment |
| Can it resume and converge? | Required fresh session, durable state, readiness, fresh-agent usefulness |
| Do agents produce acceptably equivalent packages? | Four blinded grades and reference-bounded comparison |
| Do CLI changes cause regressions? | Re-run the frozen corpus against a candidate CLI and compare gates and grades |

The current pilot answers the first six questions against CLI 0.3.1. The
regression lane remains reserved until a candidate CLI exists.

The workflow ablation compares the full SeedSpec authoring path with direct
package editing. It keeps the subject, author model, model settings, proxy
answers, fresh-session boundary, package protocol, CLI build, and judge fixed.

## Corpus

| Subject | Controlled pressure |
|---|---|
| `01-sparse-product-idea` | Several plausible product interpretations |
| `02-mature-requirements` | Detailed requirements with gaps and little ambiguity |
| `03-controlled-revision` | Revision of an existing package without scope expansion |
| `04-fixed-context-modules` | Editable primary intent with immutable context modules and skills |
| `05-fresh-context-recovery` | Interrupted work with a required fresh-agent recovery turn |
| `06-composition-conflict` | Multiple packages or capabilities with conflicting constraints |

Each subject freezes these ledgers:

- authoritative meaning;
- consequential decisions;
- supported obligations;
- permitted variability;
- forbidden inventions; and
- protected paths.

Subjects can also declare source-backed fixed claims with exact structured
package targets. These contracts are active only in a fixed-claim-gate lane.

Proxy-author answers remain outside the runner workspace. The controller only
reveals an answer after the author agent asks its matching consequential
question.

## Evaluation layers

### Deterministic gates

The deterministic evaluator checks:

- protocol validity;
- lint cleanliness;
- package change from the starter in the direct workflow;
- absence of `seedspec author` commands in the direct workflow;
- publish readiness and review closure in the SeedSpec workflow;
- open questions and candidates in the SeedSpec workflow;
- exact protected-path preservation;
- observed fresh-session lineage;
- private posture proposal, confirmation, correction, and non-leakage; and
- completion of any declared fixed-claim publish gate.

A failed deterministic assessment does not erase the run. Evidence remains
available for semantic grading and diagnosis.

Question, candidate, and proposal counts remain process observations. Proposal
paths and exact document wording are not quality gates. Version 2 subjects can
retain historical document expectations, but the evaluator does not read their
`contains`, `contains_any`, or `excludes` fields.

### Semantic grade

Sol receives a content-addressed evidence kit. The kit excludes runner and
author-model identity. It includes the final package, frozen sources, reference
ledgers, and sanitized process evidence.

Sol scores eight dimensions from 0 through 4. Higher is better.

1. Semantic fidelity
2. Invented obligations
3. Missed consequential decisions
4. Unnecessary question burden
5. Preservation of implementation latitude
6. Internal consistency
7. Packaging readiness
8. Usefulness to a fresh planning or implementation agent

Every score and reference-axis assessment requires a kit-relative citation.
Finalization verifies schema, identity, arithmetic, axis coverage, and citation
paths.

### Semantic gate

A completed grade passes only when:

- at least one critical or material reference axis exists;
- no critical or material axis is divergent; and
- every permitted-variability bound is respected.

The gate uses the judge's cited frozen-axis assessments. It does not scan final
documents for expected words or phrases.

### Workflow ablation

`seedspec-authoring` uses authoring state, review passes, questions, candidates,
proposals, and publish checks. `simple-authoring` gives the same model the same
starter package and sources, then permits direct package edits. The simple lane
can use the frozen CLI only for inspection, validation, and linting.

Both workflows use the same proxy-author controller and fresh-session schedule.
The direct lane must change the package and cannot invoke `seedspec author`.

### Mechanism ablations

Mechanism ablations add one behavior to `simple-authoring` while preserving the
same author model, subject, sources, proxy answers, CLI, and judge.

- `decision_ledger`: the controller records exact elicited answers in a durable
  JSON ledger. It never reveals unanswered decisions.
- `final_review`: after the package first becomes structurally ready, the
  controller requires exactly one generic semantic comparison with the sources.
- `authoring_posture`: the controller supplies private author choices for
  ambition, audience, next handoff, and collaboration budget. Derived guidance
  controls authoring depth but does not become product intent or package data.
- `posture_confirmation`: before editing, the agent recommends the four posture
  fields and the author confirms or corrects them in a separate exchange.
- `posture_fused_confirmation`: before editing, the agent recommends the
  posture and asks one blocking product question. The author's next response
  accepts or corrects both states together.
- `fixed_claim_gate`: at readiness, the controller compares declared
  source-backed claims with exact JSON or YAML targets. A contradiction blocks
  completion and produces target-specific repair diagnostics.
- `conflict_inventory`: before package editing, the agent records governing
  controls, conflicts, authority boundaries, unresolved decisions, and
  candidate compatibility. The controller freezes the artifact.
- `decision_contract`: before editing, the agent records every consequential
  decision and its outcome bounds. Accepted proxy answers remain durable.
- `intent_registry`: before editing, the agent records source authority,
  forbidden scope, package targets, and permitted latitude.
- `semantic_change_plan`: before a controlled revision, the agent records
  authorized changes, preserved invariants, excluded ideas, and semantic impact.
- `acceptance_contract`: before editing, the agent records observable scenarios,
  negative behavior, failures, and configuration invariants.

The deterministic evaluator checks mechanism integrity. It does not decide
whether an agent-authored artifact interpreted its sources correctly. The
decision-contract gate also requires every frozen proxy decision to receive an
answer. The fixed-claim gate only enforces claims and targets declared by the
subject; it is not a general semantic validator. The frozen-axis judge
evaluates semantic outcomes.

Mechanisms are isolated by default. One tested composition is permitted:
`posture_fused_confirmation` with `fixed_claim_gate`. This pair combines an
author-controlled stopping rule with a deterministic readiness boundary.

One preregistered paired observation can screen a prototype, but it cannot
establish an effect. Advance only prototypes that improve without adding a
reference-axis divergence. Use at least three observations for an advanced
mechanism. Compare it with plain direct editing and full SeedSpec on the same
subject. Treat pass-rate and cost differences as descriptive until they repeat
across models.

## Equivalence rule

Two or more packages are reference-bounded equivalent only when:

- every critical axis has no divergence;
- every material axis has no divergence;
- every permitted-variability bound is respected; and
- no critical divergence exists.

Digest equality does not establish semantic equivalence. Different package
structure and wording can remain equivalent.

The same blinded Sol judge grades all author agents. Comparisons require
distinct content-addressed evidence packages.

## Pilot and repeat policy

The pilot uses one repetition for each of 24 cells.

Repeat a cell when:

- the run fails for a non-product infrastructure reason;
- a result is near a material boundary;
- a model differs materially from peers; or
- process behavior appears unstable.

Use a new run contract for each repetition. Do not overwrite or repair a
completed attempt.

## CLI regression lane

CLI 0.3.1 is the released baseline. The matrix plan records the candidate as
`null` and the lane status as `reserved`.

When a candidate exists:

1. Freeze its executable and source digest.
2. Re-run the same subject and model cells.
3. Keep proxy-author answers and limits unchanged.
4. Compare deterministic gates by subject and model.
5. Compare semantic dimensions and reference divergences.
6. Treat new critical or material divergence as a regression.

Do not compare 0.3.0 with 0.3.1. That contrast is not decision-relevant.

## Limits on inference

- One repetition does not estimate model variance.
- Provider aliases can resolve to newer model snapshots over time.
- One judge can create correlated grading error.
- Semantic-axis assessments can still contain judge error.
- Runner and model changes remain confounded in cross-provider comparisons.
- The corpus supports bounded claims only for its frozen reference axes.
