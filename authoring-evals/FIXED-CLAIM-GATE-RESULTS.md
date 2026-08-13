# Fixed-claim publish-gate results

Date: 2026-08-05

## Result

A narrow machine-readable publish gate closed the repeated mature-package
consistency failure.

| Lane | Scores | Semantic passes | Mean score | Mean turns |
| --- | --- | ---: | ---: | ---: |
| Plain direct | 25, 27, 25 | 1/3 | 25.67 | 2.00 |
| Direct + fixed-claim gate | 29, 32, 32 | 3/3 | 31.00 | 2.67 |

The gate improved the observed mean by 5.33 points and the pass count by two.
All three gated packages preserved every frozen reference axis.

## Mechanism

The controller held six source-backed fixed claims for the HubSpot object,
metric property, dashboard name, reporting timezone, delivery time, and Slack
channel. Each claim named exact JSON Schema and YAML example targets.

At structural readiness, the gate compared those targets without model
judgment. A mismatch blocked completion and returned target-specific repair
diagnostics. The gate did not ask the author to reconfirm source meaning.

## Intervention behavior

| Observation | Initial gate | Repair turns | Final score |
| --- | --- | ---: | ---: |
| 1 | Five schema constants missing | 1 | 29 |
| 2 | Pass | 0 | 32 |
| 3 | Five schema constants missing | 1 | 32 |

The two interventions matched the earlier direct failure pattern: prose and
examples fixed the values while the schema allowed alternatives. Both repairs
cleared all five diagnostics in one turn.

The 29-point package still omitted a source requirement to explain a new
recurring service or cost before selection. That is outside this gate's
machine-readable fixed-claim scope. The result therefore distinguishes a
targeted consistency control from a general semantic review.

## Process cost

| Lane | Turns | Input tokens | Output tokens |
| --- | ---: | ---: | ---: |
| Plain direct | 6 | 824,486 | 14,521 |
| Direct + fixed-claim gate | 8 | 1,595,144 | 18,340 |

The gate used 93% more runner-reported input and 26% more output. The increase
came from two repair turns and the growing session context they carried. This
is a quality-for-cost tradeoff, unlike injected posture, which improved quality
while reducing observed process cost.

## Product implication

Publish readiness becomes more useful when accepted fixed meaning can compile
to deterministic checks. A bounded implementation would:

1. persist author-approved fixed claims in private authoring state;
2. link each claim to machine-readable package targets;
3. run checks only at readiness boundaries;
4. report exact contradictions;
5. keep implementation choices and permitted variation outside the gate.

This result does not justify a general semantic validator. It supports narrow
compilers for claims with deterministic representations.

The later [combined posture and fixed-claim experiment](POSTURE-FIXED-CLAIM-RESULTS.md)
retained a 3/3 pass rate while completing all three runs in two turns.

## Limits

- One subject and one author model.
- The controller supplied the structured claims from frozen sources.
- Only JSON and YAML targets were checked.
- The direct lane did not receive the gate-awareness handoff sentence.
- A production capture flow must prove claim authority before enforcing it.

## Evidence

- Qualification plan: `authoring-evals/runs/luna-fixed-claim-gate-0.3.1-plan.json`
- Repetition plan: `authoring-evals/runs/luna-fixed-claim-gate-0.3.1-confirm-plan.json`
- Qualification campaign: `~/.cache/seedspec-evals/runs/matrix-plan-89e5b46c264626f084c9214cdf57f810a313251388d9590f146afb9feb9cfc0e/`
- Repetition campaign: `~/.cache/seedspec-evals/runs/matrix-plan-77bd9c39f2b4de94874e4ec6895ad68c505ec2f0f50deaf6d560947676d6226a/`

No Claude calls were made. Recorded Anthropic spend remains `$17.61913180`.
