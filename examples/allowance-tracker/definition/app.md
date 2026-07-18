# Allowance Tracker

## Purpose

Allowance Tracker helps a household make expectations visible, recognize completed work, and maintain a balance that children and guardians can trust. It replaces ad hoc memory and spreadsheets with a clear record of assignments, approvals, earnings, and adjustments.

The product tracks allowance units. A unit may represent money or another household reward, but every household uses one configured currency or unit label consistently. The SeedSpec does not prescribe payment processing or custody of real funds.

## Intended users and outcomes

### Guardians

Guardians establish the household, manage participating children, define chores and assignments, approve or reject submitted work, and make explicit balance adjustments. They need a reliable answer to what is due, what awaits review, and why a child's balance changed.

### Children

Children see their own assignments and balance. When child access is enabled, they can mark work complete, review feedback, and inspect their own transaction history. In parent-managed mode, a guardian performs those actions with the child.

## Domain concepts

- **Household** — the boundary for actors, chores, assignments, and one allowance unit.
- **Actor** — a guardian or child participating in a household.
- **Chore** — a reusable description of work, with an optional suggested reward and instructions.
- **Assignment** — one occurrence of a chore assigned to one child, either one-time or produced from a recurring schedule.
- **Approval** — a guardian's decision on a submitted assignment.
- **Balance** — the sum of immutable transactions for one child.
- **Transaction** — an earning or adjustment with an amount, reason, actor, and related assignment when applicable.

## Permissions

| Action | Guardian | Child |
| --- | --- | --- |
| Manage household settings and participants | Yes | No |
| Create, edit, archive chores | Yes | No |
| Create and change assignments before submission | Yes | No |
| Submit assigned work | Yes | Own assignments when child access is enabled |
| Approve or reject submitted work | Yes | No |
| View balance and history | Any child in household | Own only |
| Create balance adjustments | Yes | No |

An actor never reads or changes another household's data. Archived participants retain historical attribution but cannot receive new assignments or act in the product.

## Core workflows

### Establish a household

1. A guardian creates a household and selects its unit or currency.
2. The guardian adds at least one child.
3. If child access is enabled, each child receives a distinct identity; otherwise guardians operate the child workflow in parent-managed mode.
4. A guardian may invite another guardian when household policy permits multiple guardians.

The first guardian cannot remove their own final guardian access while active children or unsettled records remain.

### Define and assign a chore

1. A guardian creates a chore with a title, optional instructions, and non-negative suggested reward.
2. The guardian assigns it to one child as a one-time assignment or defines a recurring schedule.
3. Each recurring occurrence becomes a distinct assignment with its own due date and lifecycle.
4. Editing a chore changes future assignments; it does not rewrite submitted, approved, rejected, or previously generated historical assignments.

Two children assigned the same chore receive separate assignments. Completing one never completes the other.

### Complete and review work

1. An available assignment is marked complete and becomes submitted.
2. When approval is required, no earning is created until a guardian approves it.
3. A guardian may approve the submitted reward amount or enter a different non-negative amount with a reason.
4. Approval creates exactly one earning transaction linked to the assignment and makes the assignment approved.
5. A rejection requires feedback and returns the assignment to rejected. The child or guardian may resubmit it unless the assignment was cancelled.

When approval is disabled, submission atomically creates one earning transaction and marks the assignment approved. Retrying a submission must never create a duplicate earning.

### Review allowance accounting

The displayed balance is derived from transactions, not edited directly. History shows newest activity first and includes amount, reason, effective date, acting guardian or system, and the related assignment when present.

A guardian corrects an error by adding a compensating adjustment. Approved earning transactions are not silently edited or deleted. Adjustments may be positive or negative when configuration permits, and every adjustment requires a reason.

## State models

### Assignment states

```text
available -> submitted -> approved
    ^            |
    |            v
    +--------- rejected

available -> cancelled
rejected  -> cancelled
```

- Only available or rejected assignments can be submitted.
- Only submitted assignments can be approved or rejected.
- Approved assignments are historical and cannot return to an earlier state.
- Cancelling an assignment creates no earning and preserves an audit record.

### Participant states

Participants are active or archived. Archiving blocks new activity but preserves names on historical assignments, approvals, and transactions.

## Business rules

1. All amounts use the household's configured unit and precision.
2. A balance equals the sum of that child's transactions.
3. One assignment can produce at most one earning transaction.
4. Transaction history is append-only from the product user's perspective.
5. A submitted assignment captures the chore title and proposed reward used for that occurrence.
6. Recurrence generation is idempotent: retrying it does not create duplicate occurrences.
7. An assignment belongs to exactly one household and one child.
8. Guardians can act only within households where they are active guardians.
9. Children can act only on their own eligible assignments.
10. Currency or unit changes do not reinterpret existing amounts; changing units after transactions exist requires an explicit migration outside the core workflow.

## Configuration behavior

- `household_mode` decides whether a household may have multiple active guardians.
- `child_access` decides whether children sign in or a guardian manages their workflow.
- `approval_required` decides whether submission waits for review or earns immediately.
- `recurring_allowance` can add a scheduled base allowance independent of chores.
- `overdue_policy` decides whether an overdue assignment stays actionable or expires.
- `balance_visibility` decides whether children can see their own balance.
- correction and negative-balance settings constrain guardian adjustments.

Configuration changes apply prospectively. Existing transactions and completed assignment decisions remain historical facts.

## Edge and failure behavior

- A repeated approval or submission request is safe and does not duplicate money.
- If a transaction cannot be recorded, the assignment does not become approved.
- An archived chore remains visible on history but cannot create new assignments.
- Archiving a child cancels future unsubmitted occurrences but preserves submitted and historical records for guardian review.
- When the overdue policy expires work, expiration produces no earning and cannot be reversed by a child.
- A negative adjustment that would cross zero fails unless negative balances are enabled.
- A reward amount of zero is valid only when zero-value chores are enabled.
- Simultaneous guardian decisions on one submission result in one accepted decision; the other receives the current state.

## Out of scope for the core application

Savings goals, bank transfers, debit cards, tax treatment, marketplace payments, notifications, chore streaks, and printable charts are optional features. Authentication mechanics, storage, framework, hosting, and visual design are implementation choices.

## Conformance

A faithful implementation satisfies the observable criteria in `acceptance/criteria.md` for the selected configuration. Navigation and technical architecture may vary.
