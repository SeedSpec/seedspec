# `org.seedspec.engagement.chore-streaks` 1.0.0

A provider supplies a derived current streak and longest streak for an eligible actor, backed by distinct qualifying work occurrences assigned to stable calendar days.

Consumers may rely on these behaviors:

- one occurrence contributes at most once;
- multiple qualifying occurrences on one day produce one qualifying day;
- current streak handling does not treat an unfinished current day as missed;
- streaks can be rebuilt deterministically from retained qualifying history;
- visibility follows the host's authority boundary for the streak owner;
- correction of qualifying history is reflected without erasing the host's audit history.

Local vocabulary, persistence, presentation, and calculation architecture remain host choices.
