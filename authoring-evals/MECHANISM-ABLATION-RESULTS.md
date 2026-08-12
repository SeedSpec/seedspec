# SeedSpec authoring mechanism ablations

## Result

Three small controls identify a simpler explanation for most of the useful
behavior observed in the full SeedSpec workflow.

- A controller-managed decision ledger improved fresh-context recovery from 1/3
  semantic passes to 2/3. It also used fewer turns and tokens than plain direct
  editing. The failed run stopped after eliciting only one of three decisions.
- One generic semantic review improved composition from 0/3 passes to 1/3. It
  also introduced de facto control precedence in one run. The review was not a
  stable substitute for structured conflict handling.
- Full SeedSpec authoring passed composition 2/3 times, compared with 0/3 for
  plain direct editing. This signal was not explained by an extra review turn.
- An agent-authored conflict inventory also passed composition 2/3 times. It
  matched full SeedSpec's pass rate, slightly exceeded its mean score, and
  matched plain direct editing's turn and token cost.

These are descriptive three-run results. They identify mechanisms worth
isolating; they do not estimate population-level model effects.

## Controls

| Control | Value |
|---|---|
| Date | 2026-08-05 |
| Author model | `gpt-5.6-terra`, medium reasoning |
| Judge | `gpt-5.6-sol`, high reasoning |
| CLI | 0.3.1 |
| CLI source commit | `abdeabc50fbafafba7590120b418bf5f11e89508` |
| CLI source digest | `sha256:1ad7e5c30a8e51efe232f3af653d14082513f0874f68fd9713bf1a8d4611753a` |
| Repetitions | Three per workflow and subject |
| Semantic gate | Frozen reference axes; no lexical matching |

Every lane received the same starter package, source material, proxy-author
answers, model settings, CLI build, and judge. No Claude calls were made.
Claude spend remains `$17.61913180` total, with `$2.38086820` unused.

## Treatments

### Decision ledger

The direct-edit recovery lane received a controller-managed JSON ledger. The
controller added an exact proxy-author answer only after the agent elicited it.
The agent read the ledger after each turn and after the forced fresh session.
The ledger did not expose unanswered reference decisions.

### Generic semantic review

The direct-edit composition lane received exactly one extra turn after its
package first became structurally ready. The prompt asked the agent to compare
the package with the sources and correct semantic omissions, inventions,
unresolved decisions, and internal contradictions. It supplied no reference
answer or source-derived checklist.

### Conflict inventory

The direct-edit composition lane spent its first turn reading every source and
recording governing controls, conflicts, authority boundaries, unresolved
decisions, and candidate compatibility. The controller verified that the
package remained unchanged, then froze the inventory before direct editing.
The controller supplied no source-derived entries or reference answers.

## Results

`Pass` means no critical or material frozen reference axis diverged and every
permitted-variability bound was respected.

| Subject | Workflow | Scores | Passes | Turns | Runner-reported tokens |
|---|---|---:|---:|---:|---:|
| Recovery | Full SeedSpec | 22, 26, 9 | 1/3 | 18 | 9,304,018 |
| Recovery | Plain direct | 27, 31, 23 | 1/3 | 14 | 2,558,164 |
| Recovery | Direct + ledger | 26, 26, 20 | 2/3 | 11 | 1,600,903 |
| Composition | Full SeedSpec | 32, 26, 32 | 2/3 | 14 | 11,324,077 |
| Composition | Plain direct | 28, 30, 27 | 0/3 | 6 | 1,369,005 |
| Composition | Direct + review | 28, 32, 19 | 1/3 | 9 | 3,498,570 |
| Composition | Direct + conflict inventory | 32, 28, 32 | 2/3 | 6 | 1,362,208 |

| Subject and workflow | Mean score | Mean turns | Mean tokens |
|---|---:|---:|---:|
| Recovery — full SeedSpec | 19.0 | 6.0 | 3,101,339 |
| Recovery — plain direct | 27.0 | 4.7 | 852,721 |
| Recovery — direct + ledger | 24.0 | 3.7 | 533,634 |
| Composition — full SeedSpec | 30.0 | 4.7 | 3,774,692 |
| Composition — plain direct | 28.3 | 2.0 | 456,335 |
| Composition — direct + review | 26.3 | 3.0 | 1,166,190 |
| Composition — direct + conflict inventory | 30.7 | 2.0 | 454,069 |

Token totals include cached input reported by the Codex runner. They are
process telemetry, not billing estimates.

## Failure analysis

### Recovery

- The two ledger passes retained all three elicited decisions across the fresh
  session.
- The ledger failure retained its sole elicited answer, but the agent stopped
  before asking for schedule and retry behavior.
- Plain direct editing failed twice by losing or reopening settled meaning after
  the fresh session.
- Full SeedSpec's third run omitted all three required decisions despite its
  larger state and interaction machinery.

The ledger addresses decision retention. It does not ensure ambiguity discovery
or convergence. A compact state artifact may be sufficient for retention, but
it needs a separate unresolved-decision check.

### Composition

- All three plain direct packages omitted the same requirement to surface both
  governing controls.
- The generic review corrected the full conflict once.
- One reviewed package still omitted both controls.
- One reviewed package made the records control unconditional, which gave it
  de facto precedence over the unresolved room-only control.
- Full SeedSpec passed twice and omitted both controls once.
- The conflict inventory surfaced both controls in all three packages and
  passed twice.
- Its failed package preserved the conflict but omitted bounded decision
  options for choosing a governing control or approving a provider-specific
  exception.

The composition signal is explained more narrowly by explicit pre-edit
constraint, conflict, decision, and candidate reasoning. A generic second look
is not enough. The failed inventory run also shows that unresolved decisions
need explicit outcome bounds, not only a question and resolver.

## Product implications

- Keep the package substrate and structural validation. Every successful lane
  used them.
- Do not justify a semantic review tool from this result. A generic review turn
  was costly and unstable.
- Treat a compact decision ledger as promising, not proven. It improved the
  observed recovery rate while reducing process cost, but did not force complete
  elicitation.
- Preserve structured conflict and decision reasoning as a workflow concept.
  The agent-only inventory reproduced the full workflow's 2/3 composition rate
  at direct-edit cost.
- This campaign does not demonstrate that dedicated conflict, candidate, or
  review tooling is necessary. A constrained prompt and frozen scratch artifact
  were sufficient on the tested subject.
- Do not infer semantic value from publish readiness. The deterministic checks
  established structure and evidence integrity, not source fidelity.

## Next isolation

Add explicit source-grounded outcome options to the inventory's unresolved
decision entries. Validate that refinement on a held-out conflict subject before
changing product tooling. Reusing only this subject would tune the mechanism to
its frozen reference ledger.

If the result generalizes, prefer a small authoring brief with:

1. a durable ledger of elicited decisions;
2. a pre-edit constraint and conflict inventory;
3. explicit unresolved-decision options and blocked actions; and
4. structural package validation at completion.

The current evidence does not support generic semantic-review, candidate, or
proposal machinery as separate product features.

## Evidence

- Ledger campaign:
  `~/.cache/seedspec-evals/runs/matrix-plan-8d2bcb79623d01730c58ac2fef28a9d5028bfacf5ac671852048a2b37d1de23f/`
- Generic-review campaign:
  `~/.cache/seedspec-evals/runs/matrix-plan-efa21c641a3ddfc92caf8ed1e187a5b116b29707e7a01870230774d1473a43ee/`
- Third plain-direct observations:
  `~/.cache/seedspec-evals/runs/matrix-plan-6eee027c1207ac321c4823c620310954b025a628b95769d8c4ff01f739bc6ee3/`
- Third full-SeedSpec observations:
  `~/.cache/seedspec-evals/runs/matrix-plan-16761555c3bbcde0a7316190a6675a674815cfa10365558221ad4f0f7192e0fa/`
- Conflict-inventory campaign:
  `~/.cache/seedspec-evals/runs/matrix-plan-b7cca6c6426dfef9050a1d7947f4d9d8d3eab40d63e0470e304ff130b40ae985/`

The first two observations per benchmark lane are linked from
[the workflow ablation](ABLATION-SEEDSPEC-VS-SIMPLE.md).

## Limits on inference

- Three runs are enough to expose instability, not estimate a stable rate.
- One author model and one judge can create model-specific and correlated error.
- The controls isolate behaviors through prompts and controller artifacts, not
  production implementations.
- Two pre-campaign conflict-inventory qualifications were quarantined because
  the evaluator overconstrained JSON representation. They received no semantic
  grades and are excluded from the three-run result.
- The direct control still used the SeedSpec package format and validation CLI.
- Claims are bounded to CLI 0.3.1 and the two frozen subjects.
