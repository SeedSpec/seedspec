# A seed becoming stronger

> **Informative example.** One authoring session, compressed. Every question
> below is triggered by something the author already wrote, and every line added
> to the package traces to an answer. Nothing arrives from a checklist.

A clinic manager wants to package how their intake process works so other
practices can adopt it. They are not a programmer.

## What they started with

`seed.md`, written in about five minutes:

```markdown
# Patient Intake

New patients fill out forms before their first visit instead of on a clipboard
in the waiting room. Front desk staff review what came in and flag anything
that needs attention before the appointment.

Should work on a phone. Needs to handle insurance info.
```

This is a real seed. It has an outcome, two actors, and a stated constraint.
The session's job is to make what is *already here* unambiguous — not to make it
complete.

## The conversation

Each exchange below names the authored words that triggered it.

**Reflecting the direction back.**

> This seed says we're making a way for new patients to complete intake before
> they arrive, so front desk staff can review it in advance instead of handling
> paper at check-in. Is that still the direction you want?

> **Manager:** Yes, but "review" is doing a lot of work there. They're not just
> reading it — they're deciding whether the appointment can go ahead.

*Triggered by:* the authored word "review". *Result:* review becomes a decision
with named outcomes.

**An ambiguity inside an authored claim.**

The seed says staff "flag anything that needs attention before the
appointment." Flagging is stated; what flagging *does* is not.

> When staff flag an intake, what happens to the appointment itself?

> **Manager:** It doesn't get cancelled. That's the whole point — we call them.
> The appointment stays, it gets flagged, and someone works it before they show
> up. If we cancelled automatically we'd lose half our new patients.

*Triggered by:* the authored word "flag". *Result:* the boundary that flagging
never cancels.

This is the highest-value moment in the session. Left unstated, an implementing
agent could very reasonably auto-cancel on a flagged intake — a plausible
inference that would be wrong in a way nobody notices until patients stop
arriving.

**An incomplete authored option.**

The seed says the package "needs to handle insurance info." Handle is
underspecified, and the range of meanings is wide.

> "Handle insurance info" could mean collecting it, or checking it with the
> payer. Which did you mean?

> **Manager:** Just collecting it. We look at it ourselves. We're not doing
> eligibility checks — that's a whole different system.

*Triggered by:* the authored phrase "handle insurance info". *Result:* a
non-goal that keeps verification out.

**A mismatch between the seed and its success material.**

The seed says review happens "before the appointment." The success material the
manager drafted said "the morning of."

> These two say different things about when review happens. Which one holds?

> **Manager:** Morning-of is what we actually do. The other one is aspirational.

*Triggered by:* two authored claims that cannot both guide the same
realization. *Result:* one timing.

**A declined suggestion.**

The manager mentioned that the phone constraint matters because "people start it
and finish it later." That is authored material, so asking about it is in
bounds:

> You mentioned people start on a phone and finish later. Should the package say
> partial progress is kept?

> **Manager:** I'd rather not pin that down. Different practices will handle it
> differently and I don't want to force it.

Recorded as declined. **The package says nothing about partial progress.** A
declined suggestion creates no wording, no configuration, no open question, and
no future work — it only records that the author considered it and chose not to.

## What it became

```markdown
# Patient Intake

New patients complete intake before arriving, so front desk staff can resolve
problems in advance instead of at the counter.

## Who acts

- **Patient** — completes intake on their own device, including a phone.
- **Front desk staff** — reviews each submission and decides whether the
  appointment can proceed as scheduled.

## What happens

1. A new patient completes intake before a scheduled appointment.
2. They provide their information, including insurance details.
3. Submitted intake becomes visible to staff for review.
4. Staff review the morning of the appointment and either clear it or flag it.

## Boundaries

A flagged intake never cancels or reschedules the appointment. Flagging exists
so a person can resolve the issue before the patient arrives; automatic
cancellation would lose patients the practice intends to keep.

Insurance details are collected and passed to review. Verifying coverage with a
payer is outside this package.
```

`success.md`:

```markdown
1. A patient can complete intake on a phone.
2. Submitted intake appears for staff review before the appointment.
3. Staff can clear or flag an intake.
4. A flagged intake leaves the appointment scheduled.
```

## Tracing every change

| Package statement | Traces to |
|---|---|
| review is a decision with two outcomes | "review what came in" → clarified |
| staff review the morning of | seed/success contradiction → resolved |
| flagging never cancels | "flag anything that needs attention" → clarified |
| insurance collected, not verified | "needs to handle insurance info" → clarified |
| intake on a phone | "should work on a phone" → carried through |

Five questions, five answers, and four changes. The declined suggestion changes
nothing. The package roughly doubled, and every added line points back to
something the author wrote.

## What did not happen

No authentication requirements. No accessibility criteria. No audit log. No
notification system. No retention policy. No data-isolation rule. No
jurisdictional field policy. No partial-save behavior, because the author
declined it.

A generic completeness pass would have suggested most of these, and none of them
were in the seed. **Absence is not a gap.** The package is a starting point for
someone who will make those calls in their own context, not a specification
pretending to have made them already.

## The part that matters downstream

An implementing agent receiving this package knows not to cancel a flagged
appointment. That one sentence is the difference between a faithful realization
and a plausible, well-built, wrong one — and it exists only because someone
asked about a word the author had already written.

## See also

- [Quickstart](quickstart-authoring.md) — do this yourself.
- [Authoring guide](authoring.md) — the full workflow.
- [Why semantic structure matters](semantic-structure.md) — why these
  distinctions survive a handoff.
