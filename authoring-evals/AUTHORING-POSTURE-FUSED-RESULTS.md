# Fused authoring-posture results

Date: 2026-08-05

## Result

Fusing posture correction with the first consequential product decision is an
efficient interaction, but it did not produce a repeatable quality advantage
on its own.

| Subject | Usable scores | Semantic passes | Mean score | Mean turns |
| --- | --- | ---: | ---: | ---: |
| Sparse product idea | 32, 29 | 2/2 | 30.50 | 2.00 |
| Mature requirements | 32, 22, 22 | 1/3 | 25.33 | 2.00 |
| Plain direct, mature | 25, 27, 25 | 1/3 | 25.67 | 2.00 |

One additional sparse run was excluded before grading. The proxy matcher did
not recognize `already-lent` as matching `already lent`. The response was
semantically correct; the matcher now normalizes punctuation for proxy routing.
No lexical package-quality check was reintroduced.

## Interaction behavior

1. Luna reads the request and sources without editing the package.
2. Luna records a private four-field posture proposal.
3. Luna states the proposal and asks one handoff-blocking product question.
4. The author corrects posture, if needed, and answers that decision together.
5. The controller persists both accepted states before package editing.

Every usable run completed in two turns. The posture remained outside the
package. Deterministic checks confirmed that the first turn did not edit the
package and that accepted posture remained private and frozen.

## Mature failure boundary

The two repeated mature failures were the known cross-artifact defect. Prose
and YAML fixed the metric, dashboard, timezone, delivery time, and channel, but
JSON Schema permitted alternatives. Both runs diverged on three critical
reference axes and scored 22/32.

The mature fused lane therefore had the same pass count as direct editing and
a 0.34-point lower mean. Posture can govern ambition, audience, question depth,
and stopping. It does not reliably compile fixed meaning into every package
representation.

## Process cost

| Mature lane | Turns | Input tokens | Output tokens |
| --- | ---: | ---: | ---: |
| Plain direct | 6 | 824,486 | 14,521 |
| Fused posture | 6 | 1,023,057 | 18,213 |

The fused lane used 24% more runner-reported input and 25% more output than the
direct lane. It avoided the extra turn and much larger context growth observed
with separate posture confirmation, but it was not cheaper than direct editing
in these mature runs.

## Decision

Keep the fused interaction as the candidate posture flow. Do not claim it as a
standalone quality control. Pair it with a narrow readiness gate when accepted
fixed claims have deterministic package representations.

## Evidence

- Qualification plan: `authoring-evals/runs/luna-posture-fused-0.3.1-plan.json`
- Repetition plan: `authoring-evals/runs/luna-posture-fused-0.3.1-confirm-plan.json`
- Qualification campaign: `~/.cache/seedspec-evals/runs/matrix-plan-4cdc4c76036ffef18d5a31249c59386d7b6cdbdf94f2dc280d20527b7d74a6e5/`
- Repetition campaign: `~/.cache/seedspec-evals/runs/matrix-plan-c43781d375b49c9f5121481cf1b018fb9ffd433b9f1fd986fb936a6189e7fcd4/`

No Claude calls were made. Recorded Anthropic spend remains `$17.61913180`.
