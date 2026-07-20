# Daily Metric Briefing capability 0.1.0

## Contract

The solution provides a recurring briefing for one configured numeric metric.
Consumers may rely on:

- a clearly identified source metric and aggregation period;
- timezone-correct previous-calendar-day calculation;
- one scheduled delivery per period under normal operation;
- explicit handling of missing data;
- a stable destination selected by the end user; and
- observable delivery or failure evidence.

The capability does not require a particular CRM, messaging platform,
orchestration tool, programming language, or hosting provider. This package's
definition and configuration intentionally bind one realization to HubSpot and
Slack.
