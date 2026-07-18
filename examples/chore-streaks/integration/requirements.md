# Chore Streaks integration requirements

Map the portable streak owner to the host actor who owns qualifying assignments. Map the host's final accepted work outcome to `approved`, even when the application uses different terminology.

Before implementation, inspect local documentation and code for renamed or reshaped chore and assignment concepts. Preserve the application's vocabulary. Record a material mapping in `.seedspec/implementation-notes.md`; do not rename the application merely to match this package.

Use a stable occurrence identifier so retries and repeated event delivery count once. Use the host's preserved approval or completion history as the source of truth rather than a manually incremented counter.

When `day_boundary` is `household-local`, the host must establish one stable household time zone. If none exists, add an appropriate household-level choice and record the decision before calculating streaks. Do not silently use each viewer's browser time zone.

For Allowance Tracker, the child is the streak owner, an approved assignment is a qualifying occurrence, and the approval's effective time determines its calendar day.
