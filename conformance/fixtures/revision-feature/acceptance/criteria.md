# Chore Streaks acceptance criteria

1. One approved qualifying assignment produces one qualifying day for its assigned owner.
2. Retrying or replaying the same approval does not count the assignment twice.
3. Several qualifying assignments on one calendar day increase the day's count but produce only one qualifying day.
4. A day qualifies only after its distinct qualifying assignment count reaches `daily_target`.
5. Consecutive qualifying calendar days increase the current streak.
6. An unfinished current day does not break a streak that qualified yesterday.
7. A completed non-qualifying day breaks the current streak.
8. The longest streak never decreases merely because the current streak breaks.
9. Rejected, cancelled, and submitted assignments do not qualify.
10. Zero-reward assignments follow `include_zero_reward`.
11. An owner cannot view another owner's streak without host authority.
12. Rebuilding from the same retained history produces the same current and longest streak values.
13. A historical correction updates the derived streak without deleting assignment or approval history.
14. Household-local day boundaries use one stable household time zone rather than the viewer's time zone.
