# SeedSpec authoring versus direct authoring

## Result

These paired Terra observations do not establish that the SeedSpec authoring
workflow outperforms direct package authoring.

Across nine pairs, both workflows passed the semantic gate six times. Direct
authoring scored 268 of 288, compared with 245 of 288 for SeedSpec. Direct
authoring used 23 turns instead of 48 and 4.57 million runner-reported tokens
instead of 30.66 million.

The quality evidence is mixed and subject-dependent. Direct authoring was more
consistent on controlled revision. SeedSpec had the only composition pass, but
that result did not repeat. Neither workflow was consistent on recovery.

## Controls

| Control | Value |
|---|---|
| Date | 2026-08-05 |
| SeedSpec workflow | `seedspec-authoring` |
| Comparator | `simple-authoring` |
| Author model | `gpt-5.6-terra`, medium reasoning |
| Judge | `gpt-5.6-sol`, high reasoning |
| CLI | 0.3.1 |
| CLI source commit | `abdeabc50fbafafba7590120b418bf5f11e89508` |
| CLI source digest | `sha256:1ad7e5c30a8e51efe232f3af653d14082513f0874f68fd9713bf1a8d4611753a` |
| Repetitions | One for all subjects; one additional repetition for revision, recovery, and composition |

Both workflows received the same starter package, sources, proxy-author
answers, model settings, fresh-session boundary, package protocol, CLI build,
and blinded semantic judge. The direct workflow edited package files without
authoring state, review passes, candidates, proposals, or `seedspec author`.

## Paired results

`Pass` means no critical or material frozen reference axis diverged and every
permitted-variability bound was respected.

| Subject | Observation | SeedSpec | Direct | Score advantage |
|---|---:|---:|---:|---:|
| Sparse product idea | 1 | 31, Pass | 32, Pass | +1 direct |
| Mature requirements | 1 | 25, Pass | 26, Pass | +1 direct |
| Controlled revision | 1 | 21, Fail | 32, Pass | +11 direct |
| Controlled revision | 2 | 31, Pass | 30, Pass | +1 SeedSpec |
| Fixed context modules | 1 | 31, Pass | 32, Pass | +1 direct |
| Fresh-context recovery | 1 | 22, Fail | 27, Fail | +5 direct |
| Fresh-context recovery | 2 | 26, Pass | 31, Pass | +5 direct |
| Composition conflict | 1 | 32, Pass | 28, Fail | +4 SeedSpec |
| Composition conflict | 2 | 26, Fail | 30, Fail | +4 direct |
| **Total** | **9 pairs** | **245; 6 Pass** | **268; 6 Pass** | **+23 direct** |

Direct authoring had the higher score in seven pairs; SeedSpec had the higher
score in two. Semantic-gate outcomes were discordant in only two pairs: direct
won controlled revision observation 1, and SeedSpec won composition observation
1. The other seven pairs had matching gate outcomes.

## Subject consistency

| Subject | SeedSpec passes | Direct passes | Current interpretation |
|---|---:|---:|---|
| Sparse product idea | 1/1 | 1/1 | Equivalent in the observed pair |
| Mature requirements | 1/1 | 1/1 | Equivalent in the observed pair |
| Controlled revision | 1/2 | 2/2 | Evidence leans toward direct authoring |
| Fixed context modules | 1/1 | 1/1 | Explicit protection sufficed in both workflows |
| Fresh-context recovery | 1/2 | 1/2 | No observed workflow advantage |
| Composition conflict | 1/2 | 0/2 | Weak SeedSpec signal; not stable |

## Dimension means

Each dimension ranges from 0 through 4.

| Dimension | SeedSpec | Direct | Direct delta |
|---|---:|---:|---:|
| Semantic fidelity | 3.33 | 3.33 | 0.00 |
| Avoidance of invented obligations | 3.89 | 4.00 | +0.11 |
| Recognition of consequential decisions | 3.78 | 4.00 | +0.22 |
| Avoidance of unnecessary questions | 3.00 | 3.56 | +0.56 |
| Preservation of implementation latitude | 3.89 | 4.00 | +0.11 |
| Internal consistency | 3.11 | 3.78 | +0.67 |
| Packaging readiness | 2.89 | 3.33 | +0.44 |
| Usefulness to a fresh agent | 3.33 | 3.78 | +0.44 |

Aggregate scores do not override the semantic gate. Both direct composition
packages scored at least 28 but omitted the same critical obligation. The
first direct recovery package scored 27 but reopened a settled decision after
the fresh turn.

## Feature evidence

| SeedSpec feature claim | Paired observations |
|---|---|
| Preserve source meaning | No aggregate advantage. Mean semantic fidelity and total semantic pass count were equal. |
| Avoid invented scope | No demonstrated advantage. Direct authoring scored slightly higher and respected all permitted variability. |
| Recognize ambiguity with fewer questions | No demonstrated advantage. Direct authoring scored 0.56 higher on question burden. |
| Protect fixed modules | Both preserved every protected path and passed semantically. The explicit constraint was sufficient in this pair. |
| Resume and converge | No demonstrated advantage. Each workflow passed one of two recovery observations. Both SeedSpec runs used seven turns; direct used five and four. |
| Reconcile controlled revisions | Evidence leans against the current SeedSpec workflow. Direct passed twice; SeedSpec passed once. The first large gap did not repeat. |
| Compose conflicting capabilities | Weak evidence for SeedSpec. It produced the only pass, but failed the second run on the same axis as direct authoring. |
| Improve package readiness | No demonstrated advantage. Direct authoring averaged 3.33 versus 2.89. |

## Process cost

| Measure | SeedSpec | Direct | Change |
|---|---:|---:|---:|
| Author turns | 48 | 23 | 52% fewer |
| Runner-reported total tokens | 30,658,051 | 4,569,524 | 85.1% fewer |
| Runner-reported output tokens | 308,252 | 55,918 | 81.9% fewer |
| Accepted proxy decisions | 15 | 12 | 3 fewer |
| Repeated settled questions | 2 | 1 | 1 fewer |
| Unmatched controller classifications | 13 | 1 | 12 fewer |

Direct authoring used fewer turns in eight pairs and tied once. It used fewer
runner-reported tokens in every pair. Token totals include cached input as
reported by the same Codex runner. They are paired process telemetry, not
provider billing estimates.

## What this establishes

- The current SeedSpec feature bundle has not shown a semantic-quality advantage
  over direct authoring for Terra on this corpus.
- Direct authoring has a descriptive score advantage of 2.56 points per package.
- Semantic pass rates are equal at 6 of 9.
- SeedSpec adds consistent interaction and token overhead.
- The first-run revision and composition differences were not stable under one
  independent repetition.
- Controlled revision remains the clearest direct-authoring advantage.
- Composition remains the only subject with any observed SeedSpec-only pass.
- The initial two recovery observations did not show a state advantage. A
  subsequent isolated ledger control passed 2/3 runs, compared with 1/3 for
  both benchmark workflows.

## Next tests

Broad workflow repetitions now have diminishing diagnostic value. Isolate the
mechanisms on the three discriminating subjects:

1. Compare direct edits with proposal application on controlled revision.
2. Test durable decision retrieval after a forced fresh session.
3. Test whether candidate and conflict handling surfaces both composition
   controls before package editing.

Use at least three observations per mechanism. Record an intermediate mechanism
outcome and the final semantic outcome. Repeat the reduced corpus with Opus only
after a mechanism shows a stable Terra effect. Do not spend the remaining Claude
ceiling before then.

The recovery ledger and generic composition-review tests are complete. Read
[the mechanism ablations](MECHANISM-ABLATION-RESULTS.md). An agent-authored
conflict inventory subsequently matched full SeedSpec's 2/3 composition pass
rate at plain direct-edit cost. The next test must use a held-out conflict
subject.

## Evidence

Initial SeedSpec campaign:

`~/.cache/seedspec-evals/runs/matrix-plan-e749271977c7c554b98c644e4a6d7a99d24cff06c874c7ea8b49b8840a12c9ee/campaign-summary.json`

Initial direct-authoring campaign:

`~/.cache/seedspec-evals/runs/matrix-plan-9daa15cc2317a46d4fad4021051379673f13b8f63341d6e73f8ce56e90150b7b/campaign-summary.json`

Repeated SeedSpec boundary campaign:

`~/.cache/seedspec-evals/runs/matrix-plan-b880d6fbbba42549282f95f95d587ac0bff789d11b705627b93136a19fd52c0b/campaign-summary.json`

Repeated direct-authoring boundary campaign:

`~/.cache/seedspec-evals/runs/matrix-plan-7c068c82504e749128b8639a15224e43195205e944e798352a51ebcb3ce2c3e8/campaign-summary.json`

Pairwise frozen-axis comparisons:

- `~/.cache/seedspec-evals/ablation-comparisons/`
- `~/.cache/seedspec-evals/ablation-comparisons-repetition-2/`

## Limits on inference

- One observation remains for sparse, mature, and fixed-module subjects.
- Two observations do not estimate the full variance of boundary subjects.
- One judge can create correlated grading error.
- The direct control still used the SeedSpec package format and validation CLI.
- The treatment prompt necessarily exposed workflow concepts unavailable to the
  direct control.
- Runner-reported token accounting includes cached context.
- Claims are bounded to Terra, CLI 0.3.1, and the six frozen subjects.
