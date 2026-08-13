# Daily qualified pipeline briefing

Status: approved by Revenue Operations.

## Outcome

HubSpot remains the system of record for qualified pipeline value. Sales
leaders need a HubSpot dashboard for that metric and one Slack briefing each
morning for the previous calendar day.

## Fixed configuration

- Object: HubSpot deal.
- Property internal name: `qualified_pipeline_value`.
- Dashboard: `Daily Qualified Pipeline`.
- Timezone: `America/Chicago`.
- Delivery time: 08:00 local time.
- Slack channel: `#sales-daily`.

The reporting day follows the configured timezone, including daylight-saving
transitions. A normal retry must not create duplicate properties, reports,
dashboards, schedules, or messages.

## Daily message

The message identifies the metric, previous calendar day, value, and reporting
timezone. Include a dashboard link when a stable authorized link is available.

The only open product choice is an empty reporting day. Either send an explicit
no-data message, or skip delivery and retain an operational record. Never turn
missing data into a numeric zero.

## Implementation boundary

The result can use HubSpot-native automation, an approved automation platform,
or a separately operated scheduled service. Select among them after inspecting
the actual environment. These requirements do not mandate a standalone app,
language, framework, or hosting provider.
