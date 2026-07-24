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
