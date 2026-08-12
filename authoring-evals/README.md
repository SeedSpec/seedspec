# SeedSpec authoring evaluations

This private core workspace evaluates `seedspec author` as an external-agent
product. It does not define protocol conformance and is not part of published
runtime packages.

The workspace is separate from `seedspec-evals`. That repository evaluates
broader intervention and implementation outcomes. This workspace measures the
authoring path from supplied idea or requirements to an author-selected package
baseline.

## Current capability

The workspace provides:

- frozen subject packages and source authority;
- fixed proxy-author decisions;
- deterministic expected package and authoring-state outcomes;
- a content-addressed pre-execution run contract;
- an isolated runner-visible workspace;
- exact CLI source, runner, model, tool, budget, and retention identity;
- prepared, running, completed, and quarantined lifecycle states;
- retained transcript, command, usage, package, state, and report evidence;
- a black-box completed-run evaluator;
- a six-subject controlled authoring corpus;
- fresh-agent session-lineage enforcement;
- a frozen four-model pilot matrix;
- a deterministic proxy author;
- blinded semantic grading by `gpt-5.6-sol`;
- a frozen-axis semantic gate without lexical matching;
- selectable SeedSpec and simple-authoring workflows;
- isolated controller-managed and agent-authored mechanism controls;
- reference-bounded package equivalence; and
- repository checks for malformed subjects, schemas, and run behavior.

Model execution requires an explicit confirmation flag. Anthropic cells also
require a frozen aggregate spend ceiling. Preparation and qualification do not
call a model.

## Layout

```text
authoring-evals/
├── subjects/<subject-id>/
│   ├── subject.yaml
│   ├── package/
│   └── sources/
├── schemas/
├── runs/                       ignored local evidence
├── scripts/
└── test/
```

## Check subjects

```sh
npm run authoring-evals:check
```

## Prepare a run

Preparation copies the frozen subject into evaluator-only controls. It creates
the runner-visible workspace and attaches the declared sources.

```sh
node authoring-evals/scripts/prepare-run.mjs \
  --subject authoring-evals/subjects/conflict-contraction-declined-expansion \
  --out authoring-evals/runs/<run-id> \
  --runner-id <runner> \
  --runner-version <version> \
  --model-provider <provider> \
  --model-id <model> \
  --model-selector <selector> \
  --reasoning-effort <effort> \
  --workflow seedspec-authoring \
  --tool filesystem \
  --tool shell \
  --network runner-default \
  --max-duration-ms 3600000 \
  --max-turns 24 \
  --max-spend-usd none \
  --max-input-tokens none \
  --max-output-tokens 100000 \
  --retention-class local-private
```

Read [the run contract](RUN-CONTRACT.md) for the lifecycle and evidence rules.

Use `--workflow simple-authoring` to prepare a direct-edit control. The control
receives the same starter package, sources, proxy answers, CLI build, and
fresh-session schedule. It cannot use `seedspec author`.

The matrix planner can add one isolated mechanism to `simple-authoring`:

```sh
node authoring-evals/scripts/plan-matrix.mjs \
  --workflow simple-authoring \
  --decision-ledger true \
  --final-review false \
  --authoring-posture false \
  --posture-confirmation false \
  --posture-fused-confirmation false \
  --fixed-claim-gate false \
  --conflict-inventory false \
  --decision-contract false \
  --intent-registry false \
  --semantic-change-plan false \
  --acceptance-contract false \
  --out authoring-evals/runs/ledger-plan.json
```

`--decision-ledger true` creates controller-managed durable decision state. It
records only answers that the agent elicited. `--final-review true` forces one
generic source-to-package semantic review after the package first becomes
structurally ready. `--authoring-posture true` supplies a private,
controller-derived ambition, audience, handoff, and collaboration posture.
`--posture-confirmation true` asks the agent to recommend that posture, then
uses a separate author confirmation turn. `--posture-fused-confirmation true`
combines posture confirmation with the first blocking product decision.
`--fixed-claim-gate true` checks source-backed fixed claims at publish
readiness and blocks contradictory machine-readable artifacts.
`--conflict-inventory true` requires a frozen, agent-authored constraint
analysis before package editing. The other pre-edit mechanisms freeze a
decision contract, intent registry, semantic change plan, or acceptance
contract. Enable one isolated mechanism per plan. The planner also permits the
specific `--posture-fused-confirmation true --fixed-claim-gate true` pair.

## Plan the controlled pilot

The default plan contains six subjects, four models, and one repetition. It
freezes SeedSpec CLI 0.3.1. It reserves the CLI candidate lane.

```sh
node authoring-evals/scripts/plan-matrix.mjs \
  --max-spend-usd <anthropic-total-ceiling> \
  --workflow seedspec-authoring \
  --out authoring-evals/runs/pilot-0.3.1-plan.json
```

The four model selectors are:

- Claude Sonnet: `sonnet`
- Claude Opus: `opus`
- Codex Terra: `gpt-5.6-terra`
- Codex Luna: `gpt-5.6-luna`

The planner divides the aggregate Claude ceiling equally across Claude cells.
It rounds each cell down to whole cents. This prevents aggregate overrun.

## Prepare the full matrix

This command creates all run contracts. It does not call a model.

```sh
node authoring-evals/scripts/run-matrix.mjs \
  --plan authoring-evals/runs/pilot-0.3.1-plan.json \
  --runs-root /absolute/private/eval-runs \
  --prepare-only
```

Use a run root outside the frozen CLI source tree. Model execution rejects a
nested run root. This prevents a runner sandbox from treating evaluation
artifacts and repository source as one writable workspace.

## Execute and grade the matrix

This command runs one cell at a time. It retains failures and continues.

```sh
node authoring-evals/scripts/run-matrix.mjs \
  --plan authoring-evals/runs/pilot-0.3.1-plan.json \
  --runs-root /absolute/private/eval-runs \
  --confirm-model-execution
```

Each completed cell receives deterministic checks and a blinded Sol grade.
Each subject then receives a bounded-equivalence comparison across its
completed packages.

Read [the evaluation design](EVAL-DESIGN.md) for corpus, rubric, and inference
rules. Read [the CLI 0.3.1 pilot results](PILOT-0.3.1-RESULTS.md) for the first
four-model campaign. Read [the workflow ablation](ABLATION-SEEDSPEC-VS-SIMPLE.md)
for the paired Terra comparison. Read [the mechanism ablations](MECHANISM-ABLATION-RESULTS.md)
for the three-run decision-ledger and semantic-review controls. Read [the
Luna-only mechanism screen](LUNA-MECHANISM-SCREEN.md) for five later pre-edit
prototypes and their direct controls. Read [the private authoring-posture
results](AUTHORING-POSTURE-RESULTS.md) for the first isolated mechanism that
improved Luna's direct authoring across three-run comparisons. Read [the
posture-capture qualification](AUTHORING-POSTURE-CAPTURE-RESULTS.md), [the
fused-posture repetitions](AUTHORING-POSTURE-FUSED-RESULTS.md), [the fixed-claim
gate results](FIXED-CLAIM-GATE-RESULTS.md), and [the combined mechanism
results](POSTURE-FIXED-CLAIM-RESULTS.md) for the later Luna-only experiments.
Read [the Opus confirmation](OPUS-POSTURE-FIXED-CLAIM-RESULTS.md) for the
three-run second-model check of the combined mechanism.

## Evaluate a completed run

```sh
node authoring-evals/scripts/evaluate-run.mjs --run authoring-evals/runs/<run-id>
```

The command uses the frozen control subject. It returns a nonzero status when a
deterministic expectation fails.

The deterministic evaluator does not infer package meaning from expected words
or phrases. Evaluate the finalized Sol grade against frozen reference axes:

```sh
node authoring-evals/scripts/evaluate-semantic-grade.mjs \
  --grade <semantic-grade.json>
```

Evaluation failure does not quarantine an otherwise valid completed run.
Quarantine is reserved for execution, evidence, integrity, or budget failures.

## Compare completed runs

```sh
node authoring-evals/scripts/compare-runs.mjs \
  --run authoring-evals/runs/<first-run> \
  --run authoring-evals/runs/<second-run> \
  --output <comparison.json>
```

The comparison is descriptive when runner and model change together. It reports
no winner or causal effect.
