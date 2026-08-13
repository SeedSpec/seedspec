# Downstream implementation eval results

Date: 2026-08-11

## Question

Does a SeedSpec-authored package lead a fresh implementation agent to produce
more operationally correct behavior than a direct-edit package?

## Design

- Implementer: `gpt-5.6-luna`, medium reasoning
- Sessions: one fresh, blinded session per package
- Inputs: one authored package and a common integration adapter contract
- Hidden evaluation: ten deterministic behavioral checks
- Controls: reference implementation 10/10; weak implementation under 5/10
- Original sources and authoring transcripts: unavailable to the implementer

The checks cover resource provisioning, setup and message idempotency, the
previous Chicago calendar day across a DST boundary, value and no-data
messages, link authorization, visible secret-safe retry, and conflicting
resource handling.

Frozen plan:
`implementation-plan-4b5805c9fc7da9ad3f9753c054de285b87f1033d1446e4326a0a33ffca8932b1`

## Results

| Package | Package grade | Implementation checks | Failed behavior |
|---|---:|---:|---|
| Opus authored A | 29/32 | 9/10 | Report resource omitted |
| Opus authored B | 31/32 | 9/10 | Raw provider error leaked a fixture token into the failure record |
| Opus authored C | 32/32 | 9/10 | Report resource omitted |
| Luna authored | 32/32 | 10/10 | None |
| Direct-edit Luna | 27/32 | 9/10 | Raw provider error leaked a fixture token into the failure record |

All model runs exited normally. Every implementation passed date handling,
message idempotency, no-data delivery, allowed-link behavior, and conflicting
resource handling.

## Finding

This screen does not establish a general SeedSpec advantage over direct editing.
The four SeedSpec packages averaged 9.25/10; the direct control scored 9/10.
With one implementation per package, that difference is not decision-grade.

It does expose a narrower mechanism:

- Each implementation failure corresponds to an obligation absent from that
  package's acceptance criteria.
- The obligation still appeared in the package's solution prose.
- The only package with complete acceptance coverage passed 10/10.

The two missing-report implementations came from packages whose solution prose
named reports, but whose acceptance criteria omitted them. The two secret leaks
came from packages whose solution prose prohibited secrets in logs or evidence,
but whose acceptance criteria did not test secret-safe failure records.

This supports acceptance criteria as an implementation checklist. It does not
yet show that the rest of the SeedSpec authoring workflow adds value.

## Limitations

- One implementation sample per package; model variance is not estimated.
- Package author and package structure are confounded.
- The adapter is a controlled in-memory profile, not live HubSpot or Slack.
- Ten checks cover one mature-requirements subject, not the six-subject corpus.
- Package judge scores do not predict downstream correctness at this sample
  size: three differently graded Opus packages all scored 9/10.

Three earlier partial campaigns are excluded. They identified and corrected
controller defects: literal resource-kind matching, an unstated asynchronous
adapter rule, and a lexical metric-name matcher. No scored campaign mixes
harness versions.

## Next discriminating test

Hold the solution prose constant and vary only acceptance coverage:

1. Critical obligations appear only in solution prose.
2. Critical obligations are mirrored manually into acceptance criteria.
3. A publish gate verifies that every critical obligation has an acceptance
   check.

Run at least three fresh Luna implementations per condition. This isolates the
acceptance-coverage mechanism from author model and prose-quality differences.

Completed on 2026-08-11. See
[the acceptance coverage ablation](ACCEPTANCE-COVERAGE-ABLATION-RESULTS.md).
