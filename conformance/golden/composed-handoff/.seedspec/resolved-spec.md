# Resolved SeedSpec: Comprehensive Application Fixture

> This file records resolved solution intent. It is an input to planning and implementation, not executable instructions or a generated realization.

## Project summary

- Root package: org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1
- Root package digest: sha256:9823e5f458876963b118263ac55871bb43680ca93da8a3a75d047ef1f8f4af90
- Root kind hint: application
- Additions: org.seedspec.fixtures.portable-feature@0.1.0-alpha.1
- Protocol: 0.1
- Applied intent: affirmed

## Applied intent and provenance

Package definitions below are package-author intent. Project-local contributions are end-user intent or explicitly labeled agent proposals; format alone does not determine authority.

- org.seedspec.fixtures.comprehensive-application: as-authored; `org.seedspec.artifact.product-spec` at `intent/allowance-tracker.product-spec.md`
- org.seedspec.fixtures.portable-feature: as-authored; `org.seedspec.intent.native` at `definition/feature.md`

## Solution configuration

### Comprehensive Application Fixture (example)

```yaml
household_mode: multiple-guardians
child_access: child-sign-in
approval_required: true
currency:
  code: USD
  display_name: dollars
  decimal_places: 2
recurring_allowance:
  enabled: true
  cadence: weekly
  weekday: friday
chore_rewards:
  allow_zero_value: true
  allow_negative_adjustments: true
  allow_negative_balances: false
overdue_policy: remain-available
balance_visibility: child-own-balance
transaction_corrections: append-only-adjustments
```

## Root definition

---
spec_format_version: "0.1"
title: "Allowance Tracker"
artifact_type: "prd"
spec_revision: 1
author: "SeedSpec Protocol example"
created_at: "2026-07-16T00:00:00Z"
updated_at: "2026-07-16T00:00:00Z"
---

## Problem

Households rely on memory and informal records to assign chores and track allowance, making expectations and balances difficult for guardians and children to trust.

## Hypothesis

If assignments, approvals, and balance changes share one visible history, households will resolve allowance questions with less ambiguity because each earning has an attributable cause.

## Product Summary

Allowance Tracker helps a household assign work, review completed assignments, and maintain a trustworthy allowance balance derived from an append-only transaction history.

## Scope

```productspec-scope
in:
  - Let guardians define chores and assign distinct occurrences to children.
  - Let eligible work be submitted, approved or rejected, and safely retried.
  - Derive each child's balance from attributable earning and adjustment transactions.
out:
  - Do not process bank transfers or hold real funds.
  - Do not prescribe a framework, data store, hosting provider, or authentication implementation.
cut:
  - Keep savings goals, notifications, and chore streaks as separately composable features.
```

## Acceptance Criteria

```productspec-acceptance-criteria
- id: AC-1
  criterion: Given an available assignment, submitting and approving it creates exactly one earning transaction for the assigned child.
- id: AC-2
  criterion: Retrying submission or approval never creates a duplicate earning transaction.
- id: AC-3
  criterion: A child's displayed balance equals the sum of that child's transactions and preserves the reason for every change.
```

## Success Metrics

```productspec-success-metrics
- id: SM-1
  metric: attributable_balance_change_rate
  target: "100%"
  window: all recorded balance changes
```

## Root acceptance

# Allowance Tracker acceptance criteria

Unless a criterion names a configuration, it applies to every implementation.

## Household and access

1. A guardian can create a household and add a child.
2. A child cannot manage household settings, participants, chores, approvals, or adjustments.
3. An actor cannot access another household's records.
4. In `child-sign-in` mode, a child can see and submit only their own assignments.
5. In `parent-managed` mode, no child sign-in is required to complete the core workflow.

## Chores and assignments

6. A guardian can create a chore and make a one-time assignment to one child.
7. A recurring assignment creates distinct, non-duplicated occurrences.
8. Assigning the same chore to two children creates independent assignments.
9. Editing a chore does not rewrite an already submitted or historical assignment.
10. An archived chore cannot create new assignments and remains recognizable in history.

## Approval and accounting

11. With approval required, submission creates no earning until a guardian approves it.
12. Approval creates exactly one earning transaction for the approved amount.
13. Retrying approval or concurrent approval cannot create a second earning.
14. Rejection requires feedback and permits a later resubmission.
15. With approval disabled, submission and earning creation succeed or fail together.
16. A child's displayed balance equals the sum of that child's transactions.
17. A guardian correction creates a new attributed adjustment rather than editing history.
18. An adjustment that would make the balance negative fails when negative balances are disabled.

## Configuration and failures

19. A zero-value reward follows `allow_zero_value`.
20. An overdue assignment follows the selected overdue policy.
21. Disabling child balance visibility prevents children—but not guardians—from viewing it.
22. If transaction creation fails during approval, the assignment is not approved.
23. Historical transaction amounts and units do not change when prospective configuration changes.

## Addition: Portable Feature Fixture

Package: org.seedspec.fixtures.portable-feature@0.1.0-alpha.1

Digest: sha256:8bff1cef80420badeb8fb7ab144c3ffa235c10fc62f58e37487f9af2268a82f6

### Addition configuration (example)

```yaml
allocation_mode: reserved
allocation_approval: owner
withdrawal_approval: authority-required
max_active_goals: 5
allow_overfunding: false
completion_behavior: mark-reached
completion_funds: keep-reserved
deletion_funds: return-available
```

### Addition definition

# Savings Goals

## Outcome

Savings Goals lets a balance-owning actor name a target, allocate units from an existing balance, and see progress without depending on a particular banking, allowance, rewards, or fundraising implementation.

## Required host concepts

- **Actors** with an owner identity and an authority that can administer or approve actions when required.
- **Balances** expressed in one unit with an available amount for an actor.
- **Transactions** that can preserve attributed, auditable allocation changes.

The host decides its names for these concepts. The feature does not require households, children, chores, dollars, accounts, or a specific screen layout.

## New concepts

- **Savings goal** — a name, positive target value, owner, status, and current allocated value.
- **Goal allocation** — an auditable movement into or out of a goal, attributed to an actor.
- **Goal progress** — allocated value divided by target value, capped at complete for presentation while preserving any allowed excess value.

## Permissions

The balance owner can view their own goals and progress. Creation, renaming, allocation, withdrawal, completion, and deletion follow the host's authority model plus the configured approval rules. One owner cannot view or change another owner's goals unless the host grants that actor administrative authority.

## Workflows

### Create a goal

1. An authorized actor supplies a non-empty name and a positive target in the balance's unit.
2. The feature checks the active-goal limit.
3. The goal becomes active with zero allocated value.

Goal names need not be unique. Identity is stable even when a goal is renamed.

### Allocate value

1. An authorized actor selects an active goal and a positive amount.
2. If allocation approval is configured, the request waits for the host authority's decision and changes no balances yet.
3. Acceptance records one allocation transaction.
4. In `reserved` mode, allocated value becomes unavailable for other spending or allocation. In `tracked` mode, the feature reports intent without reducing spendable value.
5. Progress updates from recorded allocations.

Allocation is idempotent. Retrying the same accepted request cannot allocate twice.

### Reach and complete a goal

When allocated value reaches or exceeds the target, the goal becomes reached. Depending on configuration, reaching the target either leaves the goal visibly reached until an authorized actor closes it or automatically closes it.

Closing a reached goal follows `completion_funds`: keep funds reserved, return them to available balance, or create a host-recognized spending transaction. Spending requires the host to support that transaction behavior; otherwise it remains an explicit unresolved integration decision.

### Withdraw or delete

Withdrawal records a reversing goal-allocation transaction and follows configured approval. In reserved mode, withdrawn value becomes available again.

An empty active goal may be deleted. A goal with allocation history is archived rather than erased. Remaining allocated value follows `deletion_funds`, and the decision is recorded.

## State model

```text
active -> reached -> closed
   |          |
   +----------+-> archived
```

Archived and closed goals keep their allocation history. A target increase may move a reached but not closed goal back to active; a closed goal is immutable except for administrative annotation.

## Business rules

1. Target and allocation values use the owner's balance unit and precision.
2. Targets are positive; allocations and withdrawals are positive requests represented by directional transactions.
3. In reserved mode, total reserved value cannot exceed available value unless the host explicitly supports overdrafts.
4. Goal totals are derived from allocation transactions.
5. Authorization is checked at the time a change is accepted, not only when requested.
6. History is preserved when goals are renamed, closed, or archived.
7. Concurrent allocations cannot consume the same available units twice.

## Failure behavior

- If the host transaction cannot be recorded, allocation state and availability do not change.
- A request against an archived or closed goal fails without creating a transaction.
- A stale request receives the current goal and balance state.
- Configuration that requests a host transaction behavior the host cannot provide becomes an unresolved integration decision; it is never silently approximated.

## Portability boundary

The feature may be used in household allowance, personal budgeting, classroom rewards, fundraising, or virtual-point products. Host-specific names, routes, components, storage, notifications, and authentication remain integration choices.

### Integration requirements

# Savings Goals integration requirements

Map the portable `owner` to the host actor that owns a balance. Map `authority` to the host actor allowed to approve or administer that owner when configuration requires it.

The host must provide:

- an authoritative current balance and unit precision;
- an atomic way to record an attributed transaction and update availability;
- stable actor identities and authorization checks;
- idempotency for retried allocation operations.

In `reserved` mode, the host's spendable balance must exclude active reserved allocations. The ledger may represent reservations as dedicated transaction types, sub-balances, or another faithful mechanism.

If `completion_funds` is `record-spending`, the integration must define the host transaction type and payee or reason requirements. If it cannot, record an unresolved decision before implementation.

For Allowance Tracker, the child is the owner, a guardian is the authority, and all goal activity belongs to the same household boundary as the child's balance.

### Feature acceptance

# Savings Goals acceptance criteria

1. An authorized actor can create an active goal with a positive target.
2. A target of zero or less is rejected.
3. An owner can view their own goals but not another owner's goals without host authority.
4. An accepted allocation records exactly one attributed transaction and updates progress.
5. Retrying an allocation cannot allocate twice.
6. In `reserved` mode, accepted allocation reduces spendable availability by the same amount.
7. In `tracked` mode, allocation does not reduce spendable availability.
8. Allocation exceeding available value fails in reserved mode when the host does not support overdrafts.
9. Allocation and withdrawal follow their configured approval rules.
10. Reaching the target follows the configured completion behavior.
11. Overfunding follows `allow_overfunding`.
12. Closing a reached goal follows `completion_funds` without losing history.
13. Deleting or archiving a funded goal follows `deletion_funds` and preserves its allocation history.
14. Concurrent requests cannot reserve the same available units twice.
15. A transaction failure leaves goal allocation and available balance unchanged.
16. Changes to closed or archived goals are rejected except for permitted administrative annotation.

## Implementation profile state

No implementation profiles were declared. Execution remains open to the implementing agent under end-user direction.

## Completion scope

Review required. No completion scope covers: org.seedspec.fixtures.comprehensive-application, org.seedspec.fixtures.portable-feature.

## Technical preferences

No technical preferences were supplied. The execution engine retains implementation freedom.

## Package-authored task sequences

These are ordered implementation reminders, not product requirements or conformance evidence. Resolved reference paths point to copied package context.

### org.seedspec.fixtures.comprehensive-application

- `inspect-current-state`: Inspect the existing solution and identify the local concepts, behavior, and constraints that overlap this package before making changes.
  - References: `task-references/org.seedspec.fixtures.comprehensive-application/intent/allowance-tracker.product-spec.md`
- `review-author-context`: Review the supplied reference context and note where the existing solution requires an adaptation rather than a direct translation.
  - References: `task-references/org.seedspec.fixtures.comprehensive-application/reference/capabilities/chores-1.0.0.md`
- `realize-package`: Realize the affirmed package intent using the existing architecture and record material deviations or terminology mappings.
- `verify-realization`: Run the applicable package verification and investigate every failure before claiming completion.
  - References: `task-references/org.seedspec.fixtures.comprehensive-application/acceptance/criteria.md`, `task-references/org.seedspec.fixtures.comprehensive-application/capabilities/conformance/chores.suite.yaml`, `task-references/org.seedspec.fixtures.comprehensive-application/capabilities/conformance/chores.schema.json`, `task-references/org.seedspec.fixtures.comprehensive-application/capabilities/conformance/chores.scenarios.yaml`


## Preserved components

- org.seedspec.fixtures.comprehensive-application/acceptance: components/org.seedspec.fixtures.comprehensive-application/acceptance/ — review before-completion-claim
- org.seedspec.fixtures.comprehensive-application/reference: components/org.seedspec.fixtures.comprehensive-application/reference/ — review before-planning
- org.seedspec.fixtures.portable-feature/acceptance: components/org.seedspec.fixtures.portable-feature/acceptance/ — review before-completion-claim
- org.seedspec.fixtures.portable-feature/integration: components/org.seedspec.fixtures.portable-feature/integration/ — review before-integration

## Discovered artifacts

These artifacts are preserved inputs, not automatically activated workflows:

- org.seedspec.fixtures.comprehensive-application/product-spec: org.seedspec.artifact.product-spec — artifacts/org.seedspec.fixtures.comprehensive-application/product-spec/allowance-tracker.product-spec.md — disposition selected; review before-planning

## Author-declared implementation resources

No selected package declares an implementation resource.

## Resolved decisions

No declared decisions were answered during resolution.

## Declared capabilities

- org.seedspec.core.actors@1.0.0 — org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1
- org.seedspec.core.approvals@1.0.0 — org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1
- org.seedspec.core.assignments@1.0.0 — org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1
- org.seedspec.core.balances@1.0.0 — org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1
- org.seedspec.core.chores@1.1.0 — org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1; conformance suite: `capabilities/conformance/chores.suite.yaml`; 1 structured revision transition(s)
- org.seedspec.core.households@1.0.0 — org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1
- org.seedspec.core.transactions@1.0.0 — org.seedspec.fixtures.comprehensive-application@0.1.0-alpha.1
- org.seedspec.finance.goal-allocations@1.0.0 — org.seedspec.fixtures.portable-feature@0.1.0-alpha.1
- org.seedspec.finance.goal-progress@1.0.0 — org.seedspec.fixtures.portable-feature@0.1.0-alpha.1
- org.seedspec.finance.savings-goals@1.0.0 — org.seedspec.fixtures.portable-feature@0.1.0-alpha.1

## Capability and composition declaration review

- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.actors@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.
- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.balances@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.
- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.transactions@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.

### Composition review records

No concern is visible from package declarations. This does not establish implementation compatibility.

## Unresolved solution decisions

No package-declared decisions remain unresolved. An implementing agent must still surface any new semantic conflict it discovers.
