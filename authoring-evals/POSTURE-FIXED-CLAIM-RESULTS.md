# Fused posture and fixed-claim gate results

Date: 2026-08-05

## Result

The combined Luna workflow produced three semantically complete mature
packages. Each received 32/32 from the blinded Sol judge and passed every
frozen reference axis.

| Mature lane | Scores | Semantic passes | Mean score | Turns |
| --- | --- | ---: | ---: | ---: |
| Plain direct | 25, 27, 25 | 1/3 | 25.67 | 6 |
| Fused posture only | 32, 22, 22 | 1/3 | 25.33 | 6 |
| Fixed-claim gate only | 29, 32, 32 | 3/3 | 31.00 | 8 |
| Fused posture + fixed-claim gate | 32, 32, 32 | 3/3 | 32.00 | 6 |

This is the strongest observed condition on the mature subject. The evidence
is descriptive: one author model, one subject, three observations, and one
judge.

## Mechanism behavior

All three runs:

- proposed posture before package editing;
- combined confirmation with the empty-day decision;
- accepted or corrected posture in one author response;
- completed the package in the second turn; and
- passed the fixed-claim gate without a repair turn.

Luna proposed 11 of 12 posture fields as hand-labeled. One run proposed a
planning handoff instead of implementation start. The proxy author corrected
that field while answering the product decision. Accepted posture was exact in
all three runs.

The gate made no repairs. It still supplied a deterministic completion
boundary: a recurrence of the permissive-schema defect would have blocked
publication, as it did in two of three gate-only runs.

## Cost

| Mature lane | Input tokens | Output tokens | Mean turns |
| --- | ---: | ---: | ---: |
| Plain direct | 824,486 | 14,521 | 2.00 |
| Fused posture only | 1,023,057 | 18,213 | 2.00 |
| Fixed-claim gate only | 1,595,144 | 18,340 | 2.67 |
| Combined | 1,377,550 | 20,889 | 2.00 |

Relative to the gate-only lane, the combined flow used 14% less input and two
fewer turns because no repairs were necessary. It used 67% more input and 44%
more output than plain direct editing. Token counts are runner telemetry, not
billing estimates.

## What the result supports

The tested product shape has two separate controls:

1. **Private authoring posture:** defines ambition, reader, handoff, and
   collaboration depth. It tells the agent what earns a place in the package
   and when to stop.
2. **Compiled readiness claims:** translate accepted fixed meaning into narrow
   deterministic checks wherever the package has a machine-readable target.

The fused interaction removes a separate posture exchange. The readiness gate
blocks a known class of cross-artifact contradiction without asking the author
to restate source facts.

## Inference boundary

The combined condition does not identify why Luna authored three clean schemas.
Possible causes include posture guidance, the gate-awareness instruction, run
variance, or their interaction. Because the gate did not intervene, the three
perfect packages do not prove that posture prevented the defect. The earlier
gate-only repairs do prove that the gate catches the declared defect when it
occurs.

The next decision-relevant tests are:

1. use a held-out subject with different fixed claims and artifact targets;
2. test fresh-context recovery with accepted posture persisted privately;
3. remove posture fields individually after broader evidence; and
4. compare gate awareness with silent enforcement to measure prompt priming.

## Opus confirmation

A later three-run Opus campaign scored 29, 31, and 32, with 3/3 semantic
passes. Unlike Luna, Opus initially omitted five fixed JSON Schema constants in
every run. The gate blocked completion and Opus repaired all five in one turn
each. Read [the Opus results](OPUS-POSTURE-FIXED-CLAIM-RESULTS.md).

## Evidence

- Qualification plan: `authoring-evals/runs/luna-posture-fixed-combined-0.3.1-plan.json`
- Repetition plan: `authoring-evals/runs/luna-posture-fixed-combined-0.3.1-confirm-plan.json`
- Qualification campaign: `~/.cache/seedspec-evals/runs/matrix-plan-7d10457d41215a1cbd8c2f8ff05d28fbc29d02551424456f76d36604adbd5773/`
- Repetition campaign: `~/.cache/seedspec-evals/runs/matrix-plan-9d1c602120a70390f65d65ab97d1926efb57b9a1e5b9829cc6e198ff1cc8cfde/`

The Luna campaign made no Claude calls. The later Opus confirmation used a new,
independent `$20` ceiling and spent `$1.74611650`, including one quarantined
proxy-routing attempt.
