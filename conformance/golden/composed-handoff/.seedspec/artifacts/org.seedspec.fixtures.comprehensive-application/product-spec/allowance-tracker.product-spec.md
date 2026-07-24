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
