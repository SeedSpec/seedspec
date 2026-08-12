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

## Extraction run

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

## What the screen supports

- Capability extraction can be made source-bound and schema-constrained.
- Accepted capability meaning can remain distinct from model inference.
- Required integration joins can be checked for completeness without a shared
  domain ontology.
- Implementation and verification evidence can bind exact capability bytes.
- A harness can receive precise missing-check diagnostics and block its normal
  completion path.

## What remains unknown

- Whether a model produces useful capabilities without manual repair.
- Whether authors can review proposed bundles efficiently.
- Whether agents fabricate evidence when completion is gated.
- Whether Pi repair turns reduce escaped defects.
- The additional token, tool-call, and elapsed-time cost.
- Whether the effect generalizes beyond omission-heavy implementation tasks.

## Next run

After the local model client is healthy:

1. Run three fresh instruction-only implementations.
2. Run three fresh Pi-enforced implementations.
3. Use the same accepted bundle and hidden evaluator.
4. Compare first-pass and final conformance.
5. Record repair turns, evidence defects, tokens, tool calls, and elapsed time.
6. Repeat with a controlled-revision or fixed-context failure class.
