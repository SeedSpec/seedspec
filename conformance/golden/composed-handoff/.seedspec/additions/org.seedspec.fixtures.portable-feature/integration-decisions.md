# Portable Feature Fixture integration decisions

Source: org.seedspec.fixtures.portable-feature@0.1.0

Digest: sha256:9adb6b0695ad5341842e9ec661288f8e216db50c8bb094e9897900e39dd5093c

Capability, compatibility, and conflict declarations are integration evidence, not installation gates or observations of the actual realization. Solution configuration and answered decisions are recorded in `resolved-config.yaml`.

## Capability review

- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.actors@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.
- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.balances@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.
- **NO DECLARED CONCERN** org.seedspec.fixtures.portable-feature expects org.seedspec.core.transactions@1.0.0; declared candidates: org.seedspec.fixtures.comprehensive-application@1.0.0 (tested revision); issues: none.

## Composition review records

No declared composition concern names this addition.

## Source integration requirements

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

## Unresolved decisions

None declared by this package.
