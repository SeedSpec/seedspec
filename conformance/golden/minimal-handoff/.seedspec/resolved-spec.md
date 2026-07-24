# Resolved SeedSpec: Portable Feature Fixture

> This file records resolved solution intent. It is an input to planning and implementation, not executable instructions or a generated realization.

## Project summary

- Root package: org.seedspec.fixtures.portable-feature@0.1.0
- Root package digest: sha256:9adb6b0695ad5341842e9ec661288f8e216db50c8bb094e9897900e39dd5093c
- Root kind hint: feature
- Additions: none
- Protocol: 0.2
- Applied intent: affirmed

## Applied intent and provenance

Package definitions below are package-author intent. Project-local contributions are end-user intent or explicitly labeled agent proposals; format alone does not determine authority.

- org.seedspec.fixtures.portable-feature: as-authored; `org.seedspec.intent.native` at `definition/feature.md`

## Solution configuration

### Portable Feature Fixture (example)

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

## Root definition

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

## Root acceptance

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

Review required. No completion scope covers: org.seedspec.fixtures.portable-feature.

## Technical preferences

No technical preferences were supplied. The execution engine retains implementation freedom.

## Package-authored task sequences

No selected package declares an implementation task sequence.

## Preserved components

- org.seedspec.fixtures.portable-feature/acceptance: components/org.seedspec.fixtures.portable-feature/acceptance/ — review before-completion-claim
- org.seedspec.fixtures.portable-feature/integration: components/org.seedspec.fixtures.portable-feature/integration/ — review before-integration

## Discovered artifacts

No selected package declares optional artifacts.

## Author-declared implementation resources

No selected package declares an implementation resource.

## Resolved decisions

No declared decisions were answered during resolution.

## Declared capabilities

- org.seedspec.finance.goal-allocations@1.0.0 — org.seedspec.fixtures.portable-feature@0.1.0
- org.seedspec.finance.goal-progress@1.0.0 — org.seedspec.fixtures.portable-feature@0.1.0
- org.seedspec.finance.savings-goals@1.0.0 — org.seedspec.fixtures.portable-feature@0.1.0

## Capability and composition declaration review

- **REVIEW** org.seedspec.fixtures.portable-feature expects org.seedspec.core.actors@1.0.0; declared candidates: no selected package declares a provider; issues: no-declared-provider.
- **REVIEW** org.seedspec.fixtures.portable-feature expects org.seedspec.core.balances@1.0.0; declared candidates: no selected package declares a provider; issues: no-declared-provider.
- **REVIEW** org.seedspec.fixtures.portable-feature expects org.seedspec.core.transactions@1.0.0; declared candidates: no selected package declares a provider; issues: no-declared-provider.

### Composition review records

- **HIGH / no-declared-provider** — packages: org.seedspec.fixtures.portable-feature; capability: org.seedspec.core.actors
- **HIGH / no-declared-provider** — packages: org.seedspec.fixtures.portable-feature; capability: org.seedspec.core.balances
- **HIGH / no-declared-provider** — packages: org.seedspec.fixtures.portable-feature; capability: org.seedspec.core.transactions

## Unresolved solution decisions

No package-declared decisions remain unresolved. An implementing agent must still surface any new semantic conflict it discovers.
