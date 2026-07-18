# Configuration guide

The example favors a collaborative household: multiple guardians, child sign-in, guardian approval, and visible child balances.

- Choose `parent-managed` when children should not have identities in the product.
- Disable `approval_required` only when completing a chore should immediately create an earning.
- `recurring_allowance` is a base allowance independent of chore earnings; disabling it leaves chores as the only automatic source of earnings.
- `expire` makes overdue work ineligible. `remain-available` lets the household complete it late.
- Negative adjustments can model spending or corrections. Negative balances are a separate decision and default to disallowed.
- `append-only-adjustments` is fixed in protocol 0.1 because trustworthy history is a core invariant rather than a product option.
