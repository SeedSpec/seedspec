---
id: daily-pipeline-briefing-markdown
name: Daily pipeline briefing
kind: workflow
version: "1.0.0"
target_protocol: "0.4"
---
# Daily pipeline briefing

HubSpot remains the system of record for qualified pipeline value. Sales
leaders need a HubSpot dashboard for that metric and one Slack briefing each
morning for the previous calendar day.

## Fixed configuration

- Object: HubSpot deal
- Property internal name: `qualified_pipeline_value`
- Dashboard: `Daily Qualified Pipeline`
- Timezone: `America/Chicago`
- Delivery time: 08:00 local time
- Slack channel: `#sales-daily`

The reporting day follows the configured timezone, including daylight-saving
transitions.

## Setup

Provision the metric property, report, dashboard, and schedule. A normal retry
must not create duplicates. If an existing property has incompatible ownership
or meaning, stop and ask for direction.

## Query

Calculate the configured metric for the previous calendar day in
`America/Chicago`.

## Delivery

Send one message to `#sales-daily` with the metric, previous calendar day,
value, and reporting timezone. Include a dashboard link only when it is stable
and authorized. Retrying the same period must not send a second message.

## Missing data

A day without data sends an explicit no-data message. Never turn missing data
into a numeric zero.

## Failure

A delivery failure is visible, excludes credentials and sensitive CRM data, and
permits a later retry without duplicate delivery.

## Conflicts

A conflicting existing property is not reused, overwritten, or duplicated.
