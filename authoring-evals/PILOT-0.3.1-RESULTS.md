# Controlled authoring pilot: CLI 0.3.1

## Result

The pilot produced 21 gradable packages from 24 model-subject cells. Source
meaning, ambiguity handling, recovery, and cross-agent equivalence were not
reliable across the full corpus. Scope discipline and fixed-module preservation
were substantially more consistent.

The CLI regression question remains open. CLI 0.3.1 is frozen as the baseline,
and the candidate lane remains reserved.

## Frozen conditions

| Control | Value |
|---|---|
| Date | 2026-08-05 |
| CLI | 0.3.1 |
| Source commit | `abdeabc50fbafafba7590120b418bf5f11e89508` |
| Source digest | `sha256:1ad7e5c30a8e51efe232f3af653d14082513f0874f68fd9713bf1a8d4611753a` |
| Claude selectors | Sonnet, Opus |
| Resolved Claude models | `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101` |
| Codex models | `gpt-5.6-terra`, `gpt-5.6-luna` |
| Judge | `gpt-5.6-sol`, high reasoning, blinded reference ledger |
| Repetitions | One planned observation per model-subject cell; targeted retries for non-results |

Claude recovery cells used new immutable retry contracts after their initial
per-cell ceilings proved too small. The retry results replace the quarantined
attempts. All attempt costs remain in the spend total.

## Score matrix

Sol scored each completed package on eight dimensions from 0 through 4. The
maximum total is 32.

| Subject | Sonnet | Opus | Terra | Luna | Bounded equivalent |
|---|---:|---:|---:|---:|---|
| Sparse product idea | 27 | 29 | 31 | NC | Yes, three packages |
| Mature requirements | 17 | 27 | 25 | 12 | No |
| Controlled revision | 19 | 21 | 21 | 19 | No |
| Fixed context modules | 26 | 29 | 31 | 30 | Yes, four packages |
| Fresh-context recovery | 16 | 29 | 22 | NC | No |
| Composition conflict | PR | 24 | 32 | 28 | No |

`NC` means the agent did not converge to a gradable package. `PR` means a
provider policy refusal prevented authoring and grading.

Completed-package means are descriptive. Missing results make them unsuitable
for ranking models.

| Model | Graded | No result | Mean total |
|---|---:|---:|---:|
| Claude Sonnet | 5 | 1 | 21.00 |
| Claude Opus | 6 | 0 | 26.50 |
| Codex Terra | 6 | 0 | 27.00 |
| Codex Luna | 4 | 2 | 22.25 |

## Dimension results

Higher is better. The mean covers the 21 completed packages.

| Dimension | Mean |
|---|---:|
| Semantic fidelity | 3.05 |
| Avoidance of invented obligations | 3.81 |
| Recognition of consequential decisions | 3.24 |
| Avoidance of unnecessary questions | 2.57 |
| Preservation of implementation latitude | 3.48 |
| Internal consistency | 2.76 |
| Packaging readiness | 2.67 |
| Usefulness to a fresh agent | 2.95 |

Scope discipline was the strongest dimension. Question burden, consistency,
and packaging readiness were weaker.

## Controlled questions

| Question | Pilot answer | Evidence |
|---|---|---|
| Does authoring preserve source meaning? | Mixed | Mean 3.05. Sparse and fixed-module subjects were aligned. Every controlled-revision package diverged on critical meaning or obligation axes. |
| Does it invent scope? | Usually not | Mean 3.81. Most packages preserved supported obligations and implementation latitude. Sonnet recovery reopened settled decisions and invented a mandatory retry behavior. |
| Does it recognize consequential ambiguity? | Mixed | Sparse packages found the intended product decision. On mature requirements, Opus and Terra aligned while Sonnet and Luna missed the empty-day decision. Controlled revision remained weak across all agents. |
| Does it respect fixed context modules? | Yes in this corpus | All four agents preserved every protected context and skill path exactly. Their packages were bounded equivalent and scored 26 through 31. |
| Can it resume and converge? | Three of four converged | All four crossed the required fresh-session boundary. Sonnet, Opus, and Terra converged. Luna continued after reset but left durable state incomplete. Scores were 16, 29, and 22 for the completed packages. |
| Do agents produce acceptably equivalent packages? | Subject-dependent | Completed packages were equivalent on 2 of 6 subjects. They were not equivalent on mature requirements, controlled revision, recovery, or composition. |
| Do CLI changes cause regressions? | Not tested | No candidate CLI was selected. The 0.3.1 baseline and candidate lane are frozen for the next campaign. |

## Deterministic gates

All 21 completed packages were protocol-valid, lint-clean, publish-ready,
review-complete, and free of open questions or candidates.

The first report also required exact lexical proxies and proposal paths. Only 3
of 21 passed that historical rule, with 83 lexical mismatches and 9 proposal-path
mismatches. That rule is retired because it confounded wording and document
placement with meaning.

Applying the replacement semantic gate to the same finalized Sol grades yields
11 passes from 21 packages. The gate requires alignment on every critical and
material frozen reference axis and respect for permitted variability. It does
not use lexical matching. Protected-path checks passed for all four fixed-module
packages.

## Non-results and retries

- Luna, sparse idea: stopped after three continuation prompts with a material
  authoring-depth question still open.
- Luna, recovery: crossed the context reset, then stopped after three
  continuation prompts with review state incomplete.
- Sonnet, composition: Anthropic refused the subject under its usage policy on
  the primary attempt and a fresh retry. No semantic score was assigned.
- Sonnet and Opus, recovery: initial attempts were quarantined under the smaller
  equal cell allocation. New $2-per-cell contracts completed at turns 9 and 10.

The Luna outcomes are convergence failures. Their final messages claimed the
packages were ready, but the frozen CLI reported incomplete durable state.

## Spend

The $20 ceiling applied to externally metered Claude spend across all attempts.

| Spend class | USD |
|---|---:|
| Qualification and discarded pre-clean attempts | 2.22656855 |
| Clean primary Claude campaign | 12.13332350 |
| Recovery retries | 3.14782645 |
| Composition refusal retry | 0.11141330 |
| **Total** | **17.61913180** |
| **Unused ceiling** | **2.38086820** |

Codex author and Sol judge runs used the Codex runner and emitted no USD cost
field. No additional metered amount is reported.

## Equivalence details

Cross-provider comparisons used the frozen reference axes, not score proximity
or package digests.

- Sparse product idea: no critical or material divergence across Sonnet, Opus,
  and Terra.
- Mature requirements: Sonnet missed empty-day behavior. Luna diverged on 13
  axes, including prior-day calculation, credentials, idempotency, and failure
  observability.
- Controlled revision: every agent diverged. Shared pressure points included
  appointment preservation, late submissions, card-image removal, and the
  Monday case.
- Fixed context modules: no critical or material divergence across all four
  agents.
- Recovery: Opus aligned. Sonnet reopened settled decisions. Terra weakened the
  one-briefing-per-day meaning.
- Composition: Opus and Luna failed to surface both controlling constraints.
  Terra aligned on every frozen axis.

## Evidence

Primary campaign summaries:

- `~/.cache/seedspec-evals/runs/matrix-plan-f93ff156c5a17edab3be051302966b32e2dc12e991b52bdbd0c0a430ba6a376d/campaign-summary.json`
- `~/.cache/seedspec-evals/runs/matrix-plan-e749271977c7c554b98c644e4a6d7a99d24cff06c874c7ea8b49b8840a12c9ee/campaign-summary.json`
- `~/.cache/seedspec-evals/runs/matrix-plan-ae379d0856c11416fda79f1231c06fa1e0f359af567b7791b3c347c7a62d98bd/campaign-summary.json`
- `~/.cache/seedspec-evals/runs/matrix-plan-5d6e21ef03037e8f1c05874144f0f6655b92c68560e309383ee15647f3d4c4a9/campaign-summary.json`

Cross-provider comparisons are under:

`~/.cache/seedspec-evals/final-comparisons/`

Replacement frozen-axis gate reports for all 21 finalized grades are under:

`~/.cache/seedspec-evals/semantic-gates-frozen-axis/`

## Limits on inference

- One repetition does not estimate model variance.
- One judge can create correlated grading error.
- Provider aliases can resolve to different snapshots later.
- Runner and model changes are confounded across providers.
- Three missing packages censor the model means.
- The claims are bounded to six subjects and their frozen reference axes.

Before using this as a release gate, add at least one repeat for boundary cells,
calibrate the semantic judge, and run the reserved candidate lane without
changing the corpus or proxy-author decisions.
