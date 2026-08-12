# Capability enforcement pilot

Date: 2026-08-12

## Question

Does active capability enforcement improve eventual implementation conformance
over the same accepted capability bundle and completion instructions?

This pilot tests the enforcement mechanism. It does not test Pi itself.

## Controls

- Model: `gpt-5.6-terra`, medium reasoning.
- Package, scaffold, accepted bundle, initial prompt, and hidden evaluator: frozen.
- Evaluator: outside the agent workspace.
- Initial prompt: identical across conditions.
- Condition order: alternated by repetition.
- Enforced feedback: failed capability check identifiers and statuses only.
- Maximum repair turns: three.

The controller derived evidence from the hidden evaluator. The model did not
author the evidence and could not inspect evaluator code or assertion details.

## Results

| Condition | Runs | First full | Final full | Mean first checks | Mean final checks | Repair turns |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Instructions only | 3 | 1/3 | 1/3 | 8.67/10 | 8.67/10 | 0 |
| Actively enforced | 3 | 1/3 | 3/3 | 8.67/10 | 10/10 | 2 |

The two incomplete first attempts in each condition failed the same capability
checks: `value-message` and `no-data`. Both failures omitted the previous local
date from rendered messages.

The enforced controller repaired both incomplete attempts in one turn. No
enforced run exhausted its repair limit. No runner or gate failure occurred.

## Cost

| Condition | Mean elapsed | Mean input tokens | Mean cached input | Mean output tokens |
| --- | ---: | ---: | ---: | ---: |
| Instructions only | 131 s | 284,625 | 256,000 | 6,093 |
| Actively enforced | 148 s | 473,153 | 385,365 | 10,629 |

Across these samples, enforcement increased mean elapsed time by 13%, input
tokens by 66%, and output tokens by 74%. Two of three enforced runs needed a
repair turn. The third passed immediately and incurred no repair turn.

Token counts are Codex client usage totals across agent-tool interactions. They
are useful for within-campaign comparison, not provider billing estimates.

## Interpretation

The capability bundle did not change first-attempt correctness. Both conditions
had the same first-pass distribution: 8/10, 8/10, and 10/10.

Active feedback changed eventual correctness in this omission-heavy task. It
converted two escaped defects into passing implementations. This is consistent
with the hypothesis that tooling enforcement, not capability formatting alone,
creates the effect.

The pilot also narrows the harness requirement. A useful harness must own an
observation-to-evidence adapter or trusted verification tool. A gate over
model-authored declarations alone was not tested and should not be assumed to
produce this result.

## Limits

- Three runs per condition are a mechanism screen, not an effect estimate.
- One package exercises one failure class.
- Controller-derived evidence excludes evidence-fabrication risk.
- Resumed Codex sessions approximate a harness repair loop but do not test Pi's
  extension lifecycle or provider routing.
- Nondeterministic review checks remain untested.

## Next test

Repeat the paired design on one controlled-revision or authorization-boundary
task. Then run the same controller through Pi after provider authentication is
available. Preserve the controller-only evaluator boundary in both tests.
