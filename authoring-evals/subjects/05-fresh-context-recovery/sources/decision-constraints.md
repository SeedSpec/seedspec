# Decision constraints

- A delivery time must use the configured team timezone.
- One system must remain authoritative for incident state.
- Chat can enrich prose but cannot silently become authoritative state.
- Retry behavior must prevent a second delivered briefing for the same team and
  local calendar date.

The author can select the exact schedule, authoritative system, and retry
identity within these constraints.
