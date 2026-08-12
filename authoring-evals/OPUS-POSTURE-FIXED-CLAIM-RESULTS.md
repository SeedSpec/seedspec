# Opus fused-posture and fixed-claim results

Date: 2026-08-06

## Result

Opus produced three semantically passing mature-requirements packages under the
fused-posture and fixed-claim-gate workflow.

| Author | Scores | Semantic passes | Mean score | Mean turns | Gate repairs |
| --- | --- | ---: | ---: | ---: | ---: |
| Luna | 32, 32, 32 | 3/3 | 32.00 | 2.00 | 0/3 |
| Opus | 29, 31, 32 | 3/3 | 30.67 | 3.00 | 3/3 |

All three Opus packages aligned on every critical and material frozen reference
axis and were reference-bounded equivalent. The scores below 32 reflected
acceptance-coverage gaps, not source-meaning divergence.

This campaign has no paired Opus direct-edit control. It confirms that the
combined mechanism works with a second author model, but it does not estimate
its advantage over direct Opus authoring.

## Mechanism behavior

Opus proposed all 12 posture fields exactly across the three valid runs. Each
run selected `bounded / fresh-internal / implementation-start / brief`, asked
only the empty-day product question, and accepted the author's answer in the
same exchange.

In all three packages, prose and YAML preserved the fixed product values while
JSON Schema initially allowed alternatives. The gate found the same five
missing constants each time:

- metric property;
- dashboard name;
- reporting timezone;
- delivery time; and
- Slack channel.

Opus repaired all five contradictions in one additional turn on every run. The
final schemas, examples, prose, and accepted decision were internally
consistent.

This cross-model repetition strengthens the fixed-claim-gate result. It does not
isolate a posture effect because posture was present in every Opus run.

## Remaining quality variance

The 29-point package under-specified duplicate-report and duplicate-schedule
checks and observable delivery failure in acceptance material. The 31-point
package had a smaller version of the same verification gap. The 32-point
package carried those obligations into acceptance completely.

Semantic fidelity, invented obligations, consequential decisions, question
burden, implementation latitude, and internal consistency scored 4/4 in all
three packages after gate repair.

## Spend

| Spend class | USD |
| --- | ---: |
| Three valid Opus runs | 1.51232825 |
| Quarantined proxy-routing attempt | 0.23378825 |
| **Total** | **1.74611650** |
| **Unused from new $20 ceiling** | **18.25388350** |

The three valid runs used nine author turns and 17,644 output tokens. Provider
telemetry reported 745,047 cached input tokens and 89,963 cache-write input
tokens. Sol judge runs did not emit a metered USD field.

## Infrastructure disposition

The first attempt asked the correct empty-day question but inserted words into
the frozen proxy phrase `no data message`. The proxy router rejected it before
package editing, so the attempt received no semantic grade. Proxy routing now
accepts ordered phrase tokens with intervening words. It remains separate from
package-quality evaluation, which uses blinded frozen-reference axes without
lexical matching.

The replacement used a new immutable plan and run contract. No failed package
or model output was reused.

## Evidence

- Primary plan: `authoring-evals/runs/opus-posture-fixed-combined-0.3.1-plan.json`
- Replacement plan: `authoring-evals/runs/opus-posture-fixed-combined-0.3.1-replacement-plan.json`
- Primary campaign: `~/.cache/seedspec-evals/runs/matrix-plan-464b1daecdec2ee7df7e9ced78e8d6007add10640d4d5be1634132ec928663df/`
- Replacement campaign: `~/.cache/seedspec-evals/runs/matrix-plan-6cb8086316e071454fd39285798a0c2a8c7c91ed3964b9dcb66fe4321a87f67b/`
- Three-grade comparison: `~/.cache/seedspec-evals/runs/matrix-plan-6cb8086316e071454fd39285798a0c2a8c7c91ed3964b9dcb66fe4321a87f67b/comparisons/02-mature-requirements-opus-three.json`

Resolved author model: `claude-opus-4-5-20251101`. Claude Code: `2.0.64`.
