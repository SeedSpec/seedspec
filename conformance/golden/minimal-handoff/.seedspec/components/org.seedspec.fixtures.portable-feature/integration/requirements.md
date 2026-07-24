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
