# Allowance Tracker

## Problem

Households rely on memory and informal records to assign chores and track
allowance. Guardians and children cannot reliably inspect expectations,
decisions, and balances.

## Intended outcome

Allowance Tracker lets a household assign work, review completed assignments,
and maintain a trustworthy allowance balance derived from an append-only
transaction history.

If assignments, approvals, and balance changes share one visible history,
households can resolve allowance questions with less ambiguity because each
earning has an attributable cause.

## Scope

The application must:

- let guardians define chores and assign distinct occurrences to children;
- let eligible work be submitted, approved or rejected, and safely retried;
- derive each child's balance from attributable earning and adjustment
  transactions; and
- preserve enough history to explain every balance change.

The application does not process bank transfers or hold real funds. It does not
prescribe a framework, data store, hosting provider, or authentication
implementation. Savings goals, notifications, and chore streaks remain
separately composable features.

## Acceptance summary

1. Submitting and approving an available assignment creates exactly one
   earning transaction for the assigned child.
2. Retrying submission or approval never creates a duplicate earning
   transaction.
3. A child's displayed balance equals the sum of that child's transactions and
   preserves the reason for every change.

The complete observable criteria remain in `acceptance/criteria.md`.
