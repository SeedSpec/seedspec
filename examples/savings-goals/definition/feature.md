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
