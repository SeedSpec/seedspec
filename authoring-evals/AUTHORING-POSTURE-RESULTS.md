# Private authoring posture results

Date: 2026-08-05

## Result

A small private authoring posture improved Luna's direct package authoring on
both tested subjects.

| Subject | Direct scores | Direct passes | Posture scores | Posture passes | Mean delta |
| --- | --- | ---: | --- | ---: | ---: |
| Sparse product idea | 31, 31, 19 | 2/3 | 32, 32, 32 | 3/3 | +5.0 |
| Mature requirements | 25, 27, 25 | 1/3 | 31, 28, 24 | 2/3 | +2.0 |
| Combined | — | 3/6 | — | 5/6 | +3.5 |

This is the first isolated mechanism in these campaigns that improved both
pass rate and mean score over direct editing. It is still descriptive evidence:
one author model, one judge, two subjects, and three observations per lane.

## Mechanism

The author supplies four private authoring choices:

1. **Ambition:** small, bounded, or broad.
2. **Audience:** close internal, fresh internal, or external.
3. **Handoff:** continued exploration, planning, or implementation start.
4. **Collaboration:** brief, standard, or intensive.

The controller derives short guidance from those choices and stores it in the
authoring workspace. It does not add the posture to the SeedSpec package and
does not treat it as product intent.

The operative add/remove rule is:

> Add material only when it preserves supplied meaning, records an accepted
> product decision or explicit delegation, marks a product boundary, or makes
> stated success observable for the selected handoff. Omit or remove material
> with no such role.

The handoff selection supplies the stopping rule. For example, a planning
handoff stops when a fresh planner can plan without guessing product behavior,
while implementation choices remain delegated.

## Controlled conditions

- Author: Codex Luna, medium reasoning.
- Judge: Codex Sol, high reasoning.
- Workflow: direct package editing, with or without the posture.
- CLI: SeedSpec 0.3.1.
- Semantic gate: blinded frozen-reference axes; no lexical matching.
- Repetitions: three per subject and lane.
- Package sources, proxy-author answers, CLI, and runner remained paired.

The sparse posture was `small / fresh-internal / planning / brief`. The mature
posture was `bounded / fresh-internal / implementation-start / brief`.

## Quality dimensions

Mean scores across all six results per lane:

| Dimension | Direct | Posture | Delta |
| --- | ---: | ---: | ---: |
| Semantic fidelity | 2.83 | 3.67 | +0.84 |
| Avoid invented obligations | 3.83 | 3.83 | 0.00 |
| Capture consequential decisions | 3.67 | 4.00 | +0.33 |
| Avoid unnecessary questions | 3.33 | 3.83 | +0.50 |
| Preserve implementation latitude | 3.67 | 4.00 | +0.33 |
| Internal consistency | 3.00 | 3.33 | +0.33 |
| Packaging readiness | 2.83 | 3.50 | +0.67 |
| Fresh-agent usefulness | 3.17 | 3.67 | +0.50 |

The posture did not trade fewer inventions for a larger package. Mean final
package size was 3,517 bytes for direct and 3,535 bytes for posture, a 0.5%
difference. It changed what Luna attended to rather than consistently adding or
removing content.

## Process cost

| Lane | Turns | Input tokens | Output tokens |
| --- | ---: | ---: | ---: |
| Direct | 14 | 2,078,394 | 30,325 |
| Posture | 13 | 1,639,652 | 25,588 |

The posture used 21% fewer runner-reported input tokens and 16% fewer output
tokens. Input totals include cached context, so they are relative operational
load rather than provider billing.

## What changed

On the sparse subject, every posture run asked and resolved the one blocking
product choice. One direct run stopped without asking it and failed three
reference axes. The other two direct runs repeated the necessary question,
which reduced their question-burden scores. All three posture packages scored
32/32.

On mature requirements, both lanes consistently asked the open empty-day
question. The remaining variance was package consistency. Direct passed once;
posture passed twice. Passing posture runs kept fixed time, timezone, channel,
and reporting behavior coherent across prose and configuration.

## Remaining failure boundary

The final mature posture run failed the same three axes as two direct runs. Its
narrative fixed 08:00, America/Chicago, and `#sales-daily`, but its configuration
schema permitted other values.

Posture can tell an agent how far to author and what kind of material earns a
place. It cannot reliably detect every contradiction across package artifacts.
A separate semantic consistency check should cover that boundary. That check
should compare fixed claims across prose, configuration, and acceptance; it
should not introduce another agent-authored summary.

## Product implication

The guided flow can ask for one posture confirmation instead of exposing four
independent questions:

> I am treating this as a small planning handoff for a capable internal reader,
> with brief collaboration. I will resolve only product choices a planner would
> otherwise have to guess and will avoid adjacent scope. Should I change that
> posture?

The agent can recommend the posture from the starting request. The author only
confirms or corrects it. The accepted posture persists in authoring state and
stays outside the package. The agent then chooses question depth and document
detail within those bounds.

## Follow-up

Posture recommendation and the fixed-claim pairing were tested after this
campaign. Separate posture confirmation added an exchange without reproducing
the injected-posture advantage. Fused confirmation avoided that exchange, but
did not outperform direct editing on repeated mature runs. The fixed-claim
gate closed the repeated schema inconsistency. See [the capture
qualification](AUTHORING-POSTURE-CAPTURE-RESULTS.md), [the fused
repetitions](AUTHORING-POSTURE-FUSED-RESULTS.md), and [the combined
results](POSTURE-FIXED-CLAIM-RESULTS.md).

Remaining tests:

1. Test a fresh-context subject to determine whether the private posture helps
   an unfamiliar agent resume at the intended depth.
2. Test an external-audience subject and a close-internal subject.
3. Ablate fields after broader evidence. The handoff and ambition fields may be
   sufficient; audience and collaboration might not add independent value.

## Budget

No Claude calls were made. Recorded Anthropic spend remains `$17.61913180`,
leaving `$2.38086820` under the `$20` total ceiling. The Luna and Sol runners do
not emit a metered USD field.
