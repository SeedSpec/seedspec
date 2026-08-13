# Active acceptance gate repair results

Date: 2026-08-11

## Question

Starting from the same incomplete package, does an active coverage gate produce
a better repaired package and downstream implementation than one generic manual
self-review?

## Design

Each repetition began from the same package. Solution prose contained two
critical obligations missing from acceptance:

- provision the report resource;
- keep secrets and sensitive records out of failure evidence.

The paired paths were:

1. **Manual repair:** One fresh Luna turn reviewed solution against acceptance
   and repaired consequential omissions it found.
2. **Gated repair:** One fresh Luna turn received the two source-backed missing
   obligation diagnostics and repaired them.

Only `acceptance/criteria.md` was writable by contract. Each repaired package
then went to a separate fresh Luna implementation session and the same ten
hidden behavioral checks.

- Repair plan:
  `acceptance-repair-plan-b5ea1b065f72f6fbf1989c3bc9448ec47bc72b29c1eb50020a308da03372c3ad`
- Implementation plan:
  `implementation-plan-d3277751f5b74a9f49c856c92ae918312f0bd3853f192537a299dd351e60384b`

## Results

| Path | Repair boundary | Implementation scores | Fully correct | Mean |
|---|---:|---|---:|---:|
| Manual repair | 3/3 preserved | 9, 10, 10 | 2/3 | 9.67/10 |
| Gated repair | 3/3 preserved | 10, 10, 10 | 3/3 | 10/10 |

The manual failure omitted report provisioning. Its acceptance repair added
report retry idempotency but did not require report creation. The other manual
implementations recovered the remaining meaning from solution prose.

All three gated repairs included both diagnosed critical obligations and all
three downstream implementations passed every check.

## Interpretation

This is the first comparison in which the gated and manual packages genuinely
differed because the gate intervened before publication. The direction favors
the active gate, but the measured effect is small: one avoided failure across
three pairs. A one-sided Fisher exact test on full implementation correctness
is `p = 0.5`.

Together with the prior acceptance ablation, the evidence supports this
mechanism hypothesis:

> Source-backed diagnostics make critical acceptance coverage more reliable;
> complete acceptance then reduces downstream omission risk.

It does not yet establish a stable gate effect across subjects or models.

## Operational load

| Stage and path | Input tokens | Output tokens |
|---|---:|---:|
| Manual repair | 356,620 | 6,252 |
| Gated repair | 311,355 | 4,355 |
| Manual downstream implementation | 647,778 | 17,594 |
| Gated downstream implementation | 553,736 | 15,535 |

Runner input totals include cached context. The gated path used fewer reported
tokens in this sample, but the sample is too small for an efficiency claim.

## Claude decision

No Claude calls were made. The paired Luna result differs by one run and does
not justify spending the remaining `$2.38086820` on a single underpowered
cross-model pair. Reserve that budget until the gate reproduces a downstream
benefit on a second subject or failure type, then use Sonnet for bounded
cross-model qualification.

## Next test

Repeat the paired gate-and-repair design on one subject where acceptance loss
causes a different failure class, such as:

- controlled revision: a forbidden baseline change escapes acceptance;
- fixed context modules: an immutable module constraint is omitted;
- fresh-context recovery: a resolved decision is absent from acceptance.

Use three Luna pairs. Advance to one Sonnet qualification pair only if the gate
again reduces critical defect escape.

