# Luna-only authoring mechanism screen

Date: 2026-08-05

## Result

None of the five prototype mechanisms improved on direct package editing in its
qualification pair. No mechanism advanced to three-run confirmation.

A subsequent private authoring-posture control did improve Luna across two
three-run comparisons. See [the posture results](AUTHORING-POSTURE-RESULTS.md).

- Semantic change plan: tied direct at 32/32.
- Intent registry: tied direct at 32/32.
- Conflict inventory: fell from 32/32 to 25/32.
- Decision contract: fell from 24/32 to 17/32 and failed its completeness gate.
- Acceptance contract: fell from 20/32 to 19/32.

The screen does not show that structured authoring artifacts are always
harmful. It shows that these passive, agent-authored artifacts did not add
enough control to improve Luna's package. Where direct editing was already
correct, they added work without changing the result. Where direct editing
failed, they did not repair the failure and sometimes anchored new divergence.

## Method

- Author model: Codex Luna, medium reasoning.
- Judge: Codex Sol, high reasoning.
- CLI baseline: SeedSpec 0.3.1.
- Workflow control: direct package editing.
- Semantic gate: blinded frozen-reference axes; no lexical matching.
- Qualification: one intervention result against one direct result.
- Advancement: semantic pass when direct failed, or a material semantic
  improvement without new divergence.
- Confirmation: three observations only after qualification.

The funnel intentionally avoided repeat spend after every prototype failed to
qualify. These are screening observations, not stable effect estimates.

## Qualification results

| Subject | Prototype | Direct | Prototype | Delta | Direct turns | Prototype turns | Decision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Mature requirements | Acceptance contract | 20 fail | 19 fail | -1 | 2 | 3 | Stop |
| Controlled revision | Semantic change plan | 32 pass | 32 pass | 0 | 2 | 2 | Stop; cost-only tie |
| Fresh-context recovery | Decision contract | 24 fail | 17 fail | -7 | 3 | 3 | Stop |
| Composition conflict | Intent registry | 32 pass | 32 pass | 0 | 2 | 2 | Stop; cost-only tie |
| Composition conflict | Conflict inventory | 32 pass | 25 fail | -7 | 2 | 2 | Stop |

A semantic pass requires no critical or material reference-axis divergence. A
high rubric score alone does not override that gate.

## Efficiency

| Pair | Direct input / output tokens | Prototype input / output tokens | Effect |
| --- | ---: | ---: | --- |
| Acceptance contract | 340,131 / 5,001 | 714,670 / 19,663 | Worse result; more work |
| Semantic change plan | 306,321 / 4,775 | 393,063 / 12,259 | Same result; more work |
| Decision contract | 310,374 / 4,740 | 491,741 / 9,276 | Worse result; more work |
| Intent registry | 412,190 / 5,606 | 470,078 / 13,198 | Same result; more work |
| Conflict inventory | 412,190 / 5,606 | 544,949 / 10,082 | Worse result; more work |

Runner-reported input totals include cached context. Use them as relative
operational load, not provider billing.

The nine included results used 21 Luna turns, 3,983,517 reported input tokens,
and 84,600 output tokens. Three one-turn qualification attempts were excluded
after the harness rejected valid but differently shaped JSON fields. They used
287,541 input tokens and 10,645 output tokens. The validators were relaxed, and
fresh contracts produced the included decision and acceptance results.

## Failure analysis

### Passive artifacts do not enforce convergence

The decision contract identified all three consequential recovery decisions.
Luna asked only one question, edited the package, and stopped. The deterministic
gate caught the incomplete sequence after authoring, but the artifact did not
make the sequence complete.

The missing behavior is controller enforcement: do not permit package editing
or completion until every blocking decision has a durable accepted answer.

### Agent-authored summaries can become new authority

The conflict inventory preserved the main conflict but omitted an authorized
provider-specific exception. The final package then narrowed the steering
group's permitted decision outcomes.

The acceptance contract retained an unresolved empty-day branch, omitted the
required environment-driven realization choice, and weakened implementation
latitude. Its structured scenarios made the package more detailed without
making it more faithful.

Both failures share an authority problem. The intermediate artifact was frozen
for integrity, but its claims were not verified before Luna used it as an
authoritative editing guide.

### Extra analysis has low value on easy subjects

Direct Luna already produced perfect packages for controlled revision and
composition. The semantic change plan and intent registry also scored 32/32,
but increased token use. These mechanisms need a demonstrated failure mode;
applying them universally creates overhead without observed benefit.

## Next mechanisms to test

1. **Controller-enforced decision state machine.** Extract blocking decisions,
   ask them in order, record accepted answers, and block editing until all
   required decisions are resolved.
2. **Authority-typed claim compiler.** Mark every intermediate claim as source,
   author decision, bounded inference, or unresolved. Reject unsupported
   promotion into obligations before package editing.
3. **Semantic publish-delta gate.** Compare the candidate package with frozen
   sources and accepted decisions. Block publication when a decision
   disappears, a permitted outcome is removed, or implementation latitude
   becomes a requirement.

These are active controls. They intervene at the failure boundary instead of
adding another passive document for the same agent to interpret.

## Budget

This screen made no Claude calls. Recorded Anthropic spend remains
`$17.61913180`, leaving `$2.38086820` under the `$20` total ceiling. The harness
does not expose a metered dollar amount for the Luna and Sol runs.
