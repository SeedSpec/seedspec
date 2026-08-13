# Authoring posture capture qualification

Date: 2026-08-05

## Result

Luna could recommend and confirm a private authoring posture, but a separate
confirmation exchange is not yet a useful production flow.

| Subject | Proposed posture match | Score | Semantic gate | Turns | Input tokens | Output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sparse product idea | 3/4 fields | 30/32 | Pass | 3 | 878,267 | 9,557 |
| Mature requirements | 3/4 fields | 25/32 | Pass | 3 | 640,099 | 6,608 |
| Combined | 6/8 fields | 27.5 mean | 2/2 pass | 6 | 1,518,366 | 16,165 |

Both proposals selected the expected ambition, audience, and handoff. Both
selected `standard` collaboration instead of the hand-labeled `brief`. The
proxy author corrected that field in the single confirmation exchange.

## Comparison

| Lane | Mean score | Semantic passes | Mean turns | Mean input tokens |
| --- | ---: | ---: | ---: | ---: |
| Direct editing | 26.33 | 3/6 | 2.33 | 346,399 |
| Injected posture | 29.83 | 5/6 | 2.17 | 273,275 |
| Captured posture | 27.50 | 2/2 | 3.00 | 759,183 |

The capture observations are qualifications, not repetitions. They show that
the protocol works and preserves semantic safety. They do not reproduce the
quality or process-cost advantage of a controller-injected posture.

## Failure boundary

The mature package repeated the known configuration inconsistency. Narrative
and examples fixed the metric, dashboard, timezone, delivery time, and Slack
channel. Its JSON Schema allowed alternative values. Sol scored semantic
fidelity, internal consistency, and readiness at 2/4 each.

Posture controls depth and allocation. It does not verify that fixed meaning is
enforced consistently across prose, configuration schemas, examples, and
acceptance material.

## Decision

Do not integrate a separate posture-confirmation turn. Test a fused flow:

1. Luna recommends posture before editing.
2. The author can correct it in the next response.
3. The same response answers the first necessary product decision.
4. The controller persists both accepted states.

This preserves author control without adding an exchange when a consequential
product question already blocks authoring.

## Evidence

- Plan: `authoring-evals/runs/luna-posture-confirmation-0.3.1-plan.json`
- Campaign: `~/.cache/seedspec-evals/runs/matrix-plan-75d15dc3492357da4f6c2db24c6bbb741675041dc61ca672f77a2fe5518bb07e/`

No Claude calls were made. Recorded Anthropic spend remains `$17.61913180`.
