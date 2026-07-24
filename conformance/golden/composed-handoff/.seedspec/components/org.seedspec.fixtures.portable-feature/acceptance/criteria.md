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
