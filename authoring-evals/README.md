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
- a black-box completed-run evaluator; and
- repository checks for malformed subjects, schemas, and run behavior.

It does not call a model, choose a provider, or grade semantic quality. An
external runner uses the frozen handoff and supplies sanitized evidence during
finalization.

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

## Evaluate a completed run

```sh
node authoring-evals/scripts/evaluate-run.mjs --run authoring-evals/runs/<run-id>
```

The command uses the frozen control subject. It returns a nonzero status when a
deterministic expectation fails.

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
