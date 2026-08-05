# Authoring evaluation run contract

## Purpose

The run contract freezes one authoring attempt before model execution. It binds
the subject, prompt, workspace, CLI source, runner, model, tools, limits, and
retention policy.

The contract does not invoke a model. A runner adapter or operator performs the
external conversation.

## Directory boundary

```text
<run>/
├── run-contract.json            immutable requested run
├── run-state.json               mutable lifecycle state
├── control/
│   ├── subject/                 evaluator-only frozen subject
│   └── manifests/               content manifests
├── workspace/
│   ├── HANDOFF.md               runner-visible prompt
│   ├── seedspec/                mutable package
│   ├── authoring/               mutable authoring state
│   └── sources/                 visible declared sources
└── evidence/                    retained sanitized evidence
```

The runner works only in `workspace/`. It must not read `control/`.

Proxy-author decisions and expected outcomes remain in `control/subject/`.
They do not enter `HANDOFF.md`.

## Frozen identity

`run-contract.json` records:

- the subject snapshot and format version;
- the exact author prompt and coaching mode;
- the runner and requested model identity;
- the declared tool and network surface;
- the CLI version, protocol release, commit, dirty state, and source digest;
- the starter package and authoring-state digests;
- the duration, turn, token, and spend limits; and
- the retention, redaction, and failure policy.

The contract ID covers the canonical contract body. Referenced manifests cover
the complete file lists without expanding the contract.

## Lifecycle

### 1. Prepare the run

Run `prepare-run.mjs` with all execution settings.

The command creates a new directory. It never reuses an existing directory.

### 2. Check the frozen inputs

```sh
node authoring-evals/scripts/check-run.mjs --run <run> --prepared
```

The check fails when a frozen input or the CLI source changed.

### 3. Start the run

```sh
node authoring-evals/scripts/start-run.mjs --run <run>
```

The command repeats prepared preflight. It then marks the run as `running`.

Give the external runner `workspace/HANDOFF.md`. Set its working directory to
`workspace/`.

The local Codex and Claude adapters can capture one conversational turn:

```sh
node authoring-evals/scripts/run-agent-turn.mjs \
  --run <run> \
  --turn 1 \
  --prompt <prompt-file>
```

Use the same command for each later turn. Increment `--turn` each time.

The adapter enforces the frozen runner version, turn count, duration, and
available spend. It stores sanitized provider events and the session identity.

### 4. Finalize the run

Provide sanitized transcript, command trace, and usage files.

Provider JSONL can be normalized before finalization:

```sh
node authoring-evals/scripts/collect-evidence.mjs \
  --format codex \
  --event <turn-events.jsonl> \
  --final <turn-final.txt> \
  --output <captured-evidence>
```

Repeat `--event` and `--final` in conversation order. The collector removes
reasoning blocks and records command metadata.

```sh
node authoring-evals/scripts/finalize-run.mjs \
  --run <run> \
  --status succeeded \
  --exit-code 0 \
  --transcript <sanitized-transcript.jsonl> \
  --commands <command-trace.jsonl> \
  --usage <usage.json> \
  --final-message <final-message.md>
```

The usage file must declare one capture mode:

```json
{
  "capture": "provider-reported",
  "input_tokens": 1000,
  "output_tokens": 200,
  "turns": 4,
  "cost_usd": 0.12
}
```

Use `runner-reported` when the runner calculates usage. Use `unavailable` when
no reliable telemetry exists.

## Completion and quarantine

A completed run requires:

- valid frozen contract inputs;
- a prior `running` state;
- successful runner status and exit code zero;
- required transcript, command, and usage evidence;
- declared limits not exceeded; and
- a valid deterministic evaluation report.

All other terminal runs enter quarantine. Finalization still retains available
evidence, final package bytes, authoring state, reasons, and content identities.

A completed run can receive a failed assessment. Completion describes evidence
integrity. Assessment describes how the result matched frozen expectations.

One contract permits one attempt. A retry requires a new contract and run ID.

## Web-tool boundary

These JSON contracts define the first reusable backend boundary for a local web
tool. A web process can prepare, preflight, start, inspect, and finalize runs
without changing SeedSpec package semantics.

The web tool must not copy evaluator-only controls into the agent workspace.
It must show quarantine as an outcome, not as an execution error to hide.
