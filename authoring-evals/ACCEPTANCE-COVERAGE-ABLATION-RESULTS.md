# Acceptance coverage ablation results

Date: 2026-08-11

## Question

Does mirroring critical solution obligations into acceptance criteria make a
fresh implementation agent more reliable? Does an active publish gate add
value beyond a correct manual checklist?

## Design

- Implementer: `gpt-5.6-luna`, medium reasoning
- Repetitions: three fresh, blinded sessions per condition
- Subject: daily qualified-pipeline briefing
- Solution, configuration, schema, and scaffold: identical across conditions
- Hidden evaluation: the same ten deterministic implementation checks

The conditions were:

1. **Solution-only:** Acceptance omitted report provisioning and secret-safe
   failure evidence. Both obligations remained in solution prose.
2. **Manual-complete:** Acceptance explicitly included both obligations.
3. **Gated-complete:** Byte-identical to manual-complete. A controller-held
   coverage gate admitted it only after all frozen critical obligation IDs had
   acceptance evidence.

Only `acceptance/criteria.md` differed between solution-only and complete.
Manual-complete and gated-complete had the same package digest.

Frozen implementation plan:
`implementation-plan-3e5c2fd20c6f82af73910e596681e79c8ce1c2fd7d0abe3280cc09b938a90688`

## Results

| Condition | Runs | Scores | Fully correct | Mean checks |
|---|---:|---|---:|---:|
| Solution-only | 3 | 8, 8, 10 | 1/3 | 8.67/10 |
| Manual-complete | 3 | 10, 10, 10 | 3/3 | 10/10 |
| Gated-complete | 3 | 10, 10, 10 | 3/3 | 10/10 |
| Complete acceptance, pooled | 6 | all 10 | 6/6 | 10/10 |

The two incomplete runs failed exactly the withheld obligations:

- Report provisioning: failed in 2/3 solution-only runs; passed in 6/6
  complete-acceptance runs.
- Secret-safe failure evidence: failed in 2/3 solution-only runs; passed in
  6/6 complete-acceptance runs.

The third solution-only run recovered both obligations from solution prose.
Acceptance omission therefore increased failure risk but did not determine the
implementation.

## Gate behavior

The controller gate rejected solution-only for two uncovered critical
obligations:

- `resource-provisioning`
- `secret-safe-failure`

It admitted gated-complete with no issues. The gate uses frozen obligation IDs
and content-addressed acceptance evidence. It does not use lexical matching.

Manual-complete and gated-complete produced the same downstream result because
their packages were identical. The gate adds preventive control, not additional
implementation guidance: it prevents publication of the condition that failed
in 2/3 runs.

## Interpretation

This is evidence for one bounded SeedSpec feature:

> Require every critical source-backed obligation to have acceptance evidence
> before publication.

It is not evidence for retaining the broader authoring workflow. A correct
manual checklist performed as well as a gated checklist. The agent can author
the package directly; the tool's useful role is checking a specific invariant
at publication.

The observed fully-correct rate was 1/3 with incomplete acceptance and 6/6 with
complete acceptance. The sample remains small. A one-sided Fisher exact test on
those run-level outcomes is `p = 0.083`, so this is a mechanism screen rather
than a final effect estimate.

## Operational load

| Condition | Input tokens | Output tokens |
|---|---:|---:|
| Solution-only | 520,558 | 15,997 |
| Manual-complete | 514,575 | 16,667 |
| Gated-complete | 546,270 | 15,984 |

Runner input totals include cached context. The byte-identical complete
conditions show no meaningful downstream cost difference.

No Claude calls were made. Recorded Anthropic spend remains `$17.61913180`,
leaving `$2.38086820` under the `$20` ceiling. The Codex runner does not expose
a metered dollar amount.

## Product implication

Keep the mechanism small:

- Maintain a controller-owned ledger of critical source and accepted-decision
  obligations.
- Require acceptance evidence for every critical obligation at publish time.
- Block publication when coverage is missing or the cited evidence changes.
- Do not add the coverage ledger to the implementation package unless another
  eval shows that implementers benefit from seeing it.

Before shipping, repeat this ablation on two different failure types and
subjects. This tests whether the effect generalizes beyond report provisioning
and failure sanitization.

An active paired repair follow-up is complete. See
[the gate repair results](ACTIVE-GATE-REPAIR-RESULTS.md).
