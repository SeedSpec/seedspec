# Capability experiment decision frame

## Expected effect

Working estimates before paired testing:

| Claim | Probability |
| --- | ---: |
| A different capability format alone materially improves implementations | 20% |
| Source-bound extraction plus active coverage gates reduces critical omissions | 65% |
| Harness enforcement outperforms prompt and CLI instructions on eventual conformance | 60% |
| The effect remains large across models and product domains | 30% |

These are priors, not measurements.

## After the first pilot

Working estimates after three paired runs and three self-attestation audits:

| Claim | Probability |
| --- | ---: |
| Capability formatting alone materially improves implementations | 15% |
| Trusted observation plus active repair reduces critical omissions on similar tasks | 80% |
| Active enforcement outperforms instructions on eventual conformance across a second failure class | 55% |
| Pi reproduces the provider-independent controller behavior | 70% |
| Implementing-agent self-attestation is sufficient verification | 10% |
| The effect remains large across models and product domains | 30% |

The pilot changed confidence in the enforcement mechanism, not in capability
formatting. First-attempt correctness was identical across conditions. The
effect appeared only after trusted checks blocked completion and supplied a
repair target.

These remain judgment estimates. One package does not establish portability.

## Why an effect is plausible

The 0.3 evaluations found one bounded mechanism:

- incomplete acceptance produced 1/3 fully correct implementations;
- complete acceptance produced 6/6; and
- an active repair gate produced 3/3 versus 2/3 after generic review.

The samples are small. They suggest that critical obligation coverage matters
more than document format.

The 0.4 experiment converts that mechanism into a portable contract:

- extraction records source-backed outcomes;
- author acceptance establishes authority;
- composition preserves required joins;
- implementation evidence prevents silent omission; and
- verification evidence blocks unsupported completion.

## Failure modes

- The extractor reproduces prose without improving coverage.
- Authors accept a large rubric without reviewing it.
- Agents fabricate or weakly cite evidence.
- Nondeterministic checks create false confidence.
- Harness repair loops increase cost without reducing escaped defects.
- Capability bundles duplicate acceptance material and drift.
- Integration edge descriptions are too vague for reliable composition.

## Stop conditions

Do not advance the format because the gate rejects a known weak fixture. Advance
only if paired runs show fewer critical escapes at acceptable additional cost.

Stop or simplify when:

- enforcement does not improve final conformance across two failure classes;
- evidence fabrication becomes the dominant failure;
- the author review burden exceeds the avoided implementation burden; or
- ordinary acceptance criteria plus one coverage gate perform equally well.
