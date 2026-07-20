# Chore Streaks

## Outcome

Chore Streaks gives a child and their guardian a lightweight view of consistency: the child's current run of qualifying days and their longest historical run. It recognizes completed work without changing chore rewards, approvals, balances, or assignment history.

The host may use different words for chores, children, assignments, or approvals. Integration depends on the observable concepts, not those display names.

## Required host concepts

- A stable actor corresponding to the person whose work contributes to a streak.
- Reusable work definitions and occurrence-level assignments.
- A trustworthy approval or completion outcome for each qualifying occurrence.
- A stable event time that can be assigned to one calendar day under the selected day boundary.
- Historical qualifying events sufficient to rebuild streaks.

## New concepts

- **Qualifying day** — a local calendar day on which the owner reaches the configured number of distinct qualifying assignments.
- **Current streak** — consecutive qualifying days ending today, or ending yesterday when today is still in progress.
- **Longest streak** — the greatest number of consecutive qualifying days in retained history.

Streak values are derived from qualifying events. They are not user-editable counters.

## Visibility and authority

An owner may view their own streak wherever the host allows them to view their assignments. A host authority, such as a guardian, may view the streaks of actors they are authorized to administer. The feature does not broaden access to assignments or approval history.

## Workflows

### Qualify a day

1. A distinct assignment reaches the configured qualifying outcome.
2. The feature assigns the event to a day using the configured day boundary.
3. When the day's distinct qualifying assignment count reaches `daily_target`, the day qualifies.
4. Current and longest streak views reflect the new qualifying day.

Retries or repeated approval delivery for one assignment count once.

### Correct historical work

When a host-authorized correction changes whether an assignment qualifies or changes its effective completion day, streaks are rebuilt from the corrected historical facts. The correction does not erase the host's audit history.

## Business rules

1. One assignment contributes at most once.
2. Several qualifying assignments on one day produce one qualifying day.
3. Calendar days follow one stable household-level time zone when `day_boundary` is `household-local`.
4. A streak is based on calendar adjacency, not elapsed 24-hour windows.
5. Today does not break a current streak until its local day has ended.
6. Archived actors retain historical streak evidence but do not accumulate new qualifying events.
7. Zero-reward work follows `include_zero_reward`.
8. Rejected, cancelled, or merely submitted work does not qualify when `qualification` is `approved`.

## Failure and history

- If the host cannot establish a stable event time, the assignment does not affect streak calculations until the time is known.
- Reprocessing the same history produces the same streak values.
- Temporary calculation failure does not change assignment, approval, or accounting state.
- Removing the feature may remove the derived presentation but must not remove host assignment or approval history.

## Portability boundary

The host controls terminology, storage, screens, notifications, scheduling, and authentication. The feature defines streak meaning and evidence only. It does not prescribe a counter column, event processor, background job, or interface layout.
