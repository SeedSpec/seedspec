# Initial capability experiment results

Date: 2026-08-11

## Scope

This is a mechanism screen. It tests whether the proposed artifacts and gates
can carry one accepted rubric across lifecycle stages. It does not estimate a
model-treatment effect.

## Implemented

- Source-bound extraction kit with stable section identifiers.
- General capability-bundle validation schema.
- Provider-compatible model-output schema.
- Explicit proposal-to-acceptance transition.
- Digest binding for accepted capability bytes.
- Authoring, composition, implementation, and verification stage gates.
- CLI commands for preparation, acceptance, and checking.
- Pi extension scaffold with bounded repair turns and terminating completion.
- Hashed tool and gate telemetry.
- Adapter from the existing downstream behavioral evaluator to capability
  verification evidence.

## Gate discrimination

The daily-pipeline example uses one accepted capability, six outcomes, and ten
acceptance checks.

| Realization | Existing hidden evaluator | Capability verification gate |
| --- | ---: | --- |
| Reference | 10/10 | pass |
| Known weak | fewer than 5/10 | fail |

The gate rejected missing or failed acceptance evidence and admitted exact
coverage from the reference realization.

This result establishes plumbing and discrimination. It does not show that an
implementation agent responds to the diagnostics or that the Pi harness
improves eventual correctness.

## Extraction runs

One Terra extraction was attempted through the local Codex client.

The first request reached structured-output validation and failed because the
general artifact schema used `oneOf`, which the provider response schema does
not permit. The experiment now emits a separate provider-compatible proposal
schema while retaining the stronger general validation schema.

A second request did not reach model execution. Codex CLI 0.145.0 could not
load its local model cache because cached records lacked a required
`base_instructions` field. No proposal or token-bearing completion was
produced. The cache was not deleted or rewritten.

The first failure receipt is retained beside the example proposal. The runner
now retains sanitized failure receipts automatically.

After the CLI was aligned to 0.147.0, the provider rejected untyped literal
schemas. The proposal schema now gives every `const` and `enum` an explicit
type, with a regression test.

A fresh Terra run then produced a structurally valid proposal without manual
repair. It proposed three capabilities, seven outcomes, and seven acceptance
checks from 36 source sections. The run used 123,254 input tokens, including
91,136 cached tokens, and 2,889 output tokens.

The proposal and sanitized run receipt are retained as
[`model-proposed-terra.yaml`](examples/daily-pipeline/model-proposed-terra.yaml)
and
[`model-proposed-terra.run.json`](examples/daily-pipeline/model-proposed-terra.run.json).

The proposal was semantically useful but coarser than the controller-accepted
ten-check bundle. It combined several retry and resource checks and did not
separate unsafe-link behavior into its own acceptance check. This supports
author review as an authority boundary; extraction is suggestion, not
acceptance.

## Enforcement pilot

Three paired runs used the same accepted bundle and initial instructions. Both
conditions had the same first-pass distribution: 8/10, 8/10, and 10/10.

Instructions alone finished at full conformance in 1/3 runs. Active enforcement
finished at full conformance in 3/3 runs by repairing both incomplete attempts
in one turn each. See [`PILOT-RESULTS.md`](PILOT-RESULTS.md).

This screen supports active observation and repair. It does not establish that
model-authored evidence is trustworthy or that Pi itself creates the effect.

## What the screen supports

- Capability extraction can be made source-bound and schema-constrained.
- Accepted capability meaning can remain distinct from model inference.
- Required integration joins can be checked for completeness without a shared
  domain ontology.
- Implementation and verification evidence can bind exact capability bytes.
- A harness can receive precise missing-check diagnostics and block its normal
  completion path.

## What remains unknown

- Whether authors can reliably detect coarse or missing extracted checks.
- Whether authors can review proposed bundles efficiently.
- Whether agents fabricate evidence when completion is gated.
- Whether Pi reproduces the controller repair result.
- Whether the effect generalizes beyond omission-heavy implementation tasks.

## Next run

1. Repeat with a controlled-revision or authorization-boundary failure class.
2. Add a model-authored evidence condition to measure fabrication.
3. Run the same controller through Pi with a configured provider.
4. Compare controller-owned verification with declared-evidence-only gating.
