# `org.seedspec.finance.goal-allocations` 1.0.0

A provider supplies auditable, idempotent allocations and withdrawals between an actor's available balance and an owned savings goal.

Accepted operations are atomic with host transaction recording. In reserved mode, the same units cannot be spent or allocated concurrently elsewhere.
