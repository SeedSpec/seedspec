# A seed becoming stronger

> **Informative example.** One authoring session, compressed. The domain is
> deliberately not software tooling, and the questions are the kind that
> actually come up.

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

This is a good starting point. It has a real outcome, a real actor, and a
stated constraint. It is also missing several things only this person knows.

## What the conversation surfaced

**Opening exchange.** The agent reflected the direction back:

> This seed says we're making a way for new patients to complete intake before
> they arrive, so front desk staff can review it in advance instead of handling
> paper at check-in. Is that still the direction you want?

> **Manager:** Yes, but "review" is doing a lot of work there. They're not just
> reading it — they're deciding whether the appointment can go ahead.

That answer changed the shape of the package. Review is a decision point with
outcomes, not a passive step.

**A boundary question.** Later, in the same thread:

> When someone's insurance doesn't come back as active, what should happen to
> the appointment?

> **Manager:** It doesn't get cancelled. That's the whole point — we call them.
> The appointment stays, it gets flagged, and someone works it before they show
> up. If we cancelled automatically we'd lose half our new patients.

This is the single most valuable moment in the session. Left unstated, an
implementing agent would very plausibly have auto-cancelled on failed
verification — a reasonable-looking inference that would have been wrong in a
way nobody noticed until patients stopped arriving.

**A question the author declined.** The agent asked which fields were required
for a minor versus an adult. The manager said that varies by state and they did
not want to fix it in the package.

Recorded as `closed`, not as a gap. A declined question creates no
configuration, no future task, and no implied obligation. The package says the
distinction exists without pretending to resolve it.

**A contradiction.** The seed said staff review submissions "before the
appointment." The success material the manager drafted said review happens "the
morning of." The agent showed both lines and asked which held.

> **Manager:** Morning-of is what we actually do. The other one is aspirational.

One of them was wrong, and only the author could say which.

## What it became

```markdown
# Patient Intake

New patients complete intake before arriving, so front desk staff can resolve
problems in advance instead of at the counter.

## Who acts

- **Patient** — completes intake on their own device, usually a phone.
- **Front desk staff** — reviews each submission and decides whether the
  appointment can proceed as scheduled.

## What happens

1. A patient receives an intake request tied to a scheduled appointment.
2. They provide demographics, history, and insurance details. Partial progress
   survives leaving and coming back.
3. Submitted intake becomes visible to staff for review.
4. Staff review the morning of the appointment and mark it cleared, or flag it
   with a reason.

## Boundaries

A flagged intake never cancels or reschedules the appointment. Flagging exists
so a person can resolve the issue before the patient arrives; automatic
cancellation would lose patients the practice intends to keep.

Insurance details are collected and passed to review. This does not verify
coverage with a payer, price a visit, or determine eligibility.

Required fields differ for minors in ways that vary by jurisdiction. The
package does not fix that policy.

## What stays open

Intake content, field-level requirements, retention, and the clinical
significance of any answer are the adopting practice's decisions.
```

`success.md`:

```markdown
1. A patient can complete intake on a phone across more than one sitting
   without losing what they entered.
2. Submitted intake appears for staff review before the appointment.
3. Staff can clear or flag an intake, and a flag records a reason.
4. A flagged intake leaves the appointment scheduled.
5. Intake belonging to one practice is never visible to another.
```

## What actually did the work

The package roughly tripled in length, but length is not the point. Four
specific things changed:

| Before | After | How |
|---|---|---|
| "review" as a vague step | a decision with two named outcomes | the opening question |
| flagging behavior unstated | flagging explicitly does **not** cancel | one boundary question |
| two conflicting review timings | one, matching reality | contradiction surfaced |
| insurance scope ambiguous | collection in, verification out | non-goal made explicit |

None of it came from a checklist. Every item traces to something the author
already had in their head, made explicit by a question about material they had
already written.

Notice what did **not** happen. Nobody added authentication requirements,
accessibility criteria, an audit log, or a notification system — all things a
generic completeness pass would have suggested, and none of which this author
asked for. Absence is not a gap.

## The part that matters downstream

An implementing agent receiving this package knows not to auto-cancel on a
failed insurance check. That single sentence is the difference between a
faithful realization and a plausible, well-built, wrong one — and it exists only
because someone asked one question at the right moment.

## See also

- [Quickstart](quickstart-authoring.md) — do this yourself.
- [Authoring guide](authoring.md) — the full workflow.
- [Why semantic structure matters](semantic-structure.md) — why these
  distinctions survive a handoff.
