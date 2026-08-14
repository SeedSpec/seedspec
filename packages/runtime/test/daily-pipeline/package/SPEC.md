---
id: daily-pipeline-briefing
name: Daily pipeline briefing
kind: workflow
version: "1.0.0"
target_protocol: "0.4"
description: A configured HubSpot metric is reported for the previous local calendar day and delivered once to an authorized Slack channel.
configuration:
  variables:
    - id: timezone
      type: string
      description: IANA timezone for the reporting day.
      required: true
      default: America/Chicago
    - id: slack-channel
      type: string
      description: Slack channel that receives the briefing.
      required: true
      default: "#sales-daily"
success:
  criteria:
    - id: contract
      description: The implementation exposes setup and deliver operations.
    - id: setup-resources
      description: Setup provisions the metric property, report, dashboard, and schedule with the configured identity and meaning.
    - id: setup-idempotency
      description: An ordinary setup retry creates no duplicate resources.
    - id: reporting-query
      description: Delivery queries the configured object and property for the previous calendar day in America/Chicago, including DST boundaries.
    - id: value-message
      description: The authorized channel receives the metric, previous date, value, timezone, and a stable authorized dashboard link when available.
    - id: message-idempotency
      description: Retrying the same reporting period sends no duplicate message.
    - id: unsafe-link
      description: Unstable or unauthorized dashboard links are omitted without suppressing the required message.
    - id: no-data
      description: A day without data sends an explicit no-data message and never reports numeric zero as observed data.
    - id: visible-retry
      description: A delivery failure is visible, excludes secrets, and remains retryable.
    - id: conflict-safety
      description: A conflicting existing property stops setup without reuse, overwrite, or duplication.
capabilities:
  items:
    - id: daily-briefing
      name: Daily briefing
      description: Reports qualified pipeline value for the previous local day and delivers it once to Slack.
      outcomes:
        - id: resources-exist
          description: Required HubSpot resources exist without duplicates.
        - id: previous-day-is-queried
          description: The query uses the previous calendar day in the configured timezone.
        - id: one-message
          description: One complete message reaches the authorized Slack channel.
        - id: missing-data-is-distinct
          description: Missing data remains distinct from numeric zero.
        - id: failure-is-safe
          description: Delivery failures are visible, secret-safe, and retryable.
        - id: conflicts-stop
          description: Conflicting existing state stops before mutation.
      success_criteria:
        - contract
        - setup-resources
        - setup-idempotency
        - reporting-query
        - value-message
        - message-idempotency
        - unsafe-link
        - no-data
        - visible-retry
        - conflict-safety
tasks:
  items:
    - id: implement-adapter
      instruction: Implement setup and deliver against the supplied integration adapter without expanding the intended surface.
      capabilities: [daily-briefing]
      success_criteria:
        - contract
        - setup-resources
        - setup-idempotency
        - reporting-query
        - value-message
        - message-idempotency
        - unsafe-link
        - no-data
        - visible-retry
        - conflict-safety
context_modules:
  - id: pipeline-evaluation
    type: evaluation
    description: Hidden-evaluator checks for the daily pipeline briefing.
    path: context-modules/pipeline-evaluation/EVAL.md
    applies_to:
      stages: [verification]
      capabilities: [daily-briefing]
      success_criteria:
        - contract
        - setup-resources
        - setup-idempotency
        - reporting-query
        - value-message
        - message-idempotency
        - unsafe-link
        - no-data
        - visible-retry
        - conflict-safety
  - id: spec-first-implementation
    type: skill
    description: Implement from the package claims and refuse self-certification.
    path: context-modules/spec-first-implementation/SKILL.md
    applies_to:
      stages: [implementation]
      capabilities: [daily-briefing]
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

## Setup [success:contract] [success:setup-resources] [success:setup-idempotency]

Provision the metric property, report, dashboard, and schedule. A normal retry
must not create duplicates. If an existing property has incompatible ownership
or meaning, stop and ask for direction.

## Query [success:reporting-query]

Calculate the configured metric for the previous calendar day in
`America/Chicago`.

## Delivery [success:value-message] [success:message-idempotency] [success:unsafe-link]

Send one message to `#sales-daily` with the metric, previous calendar day,
value, and reporting timezone. Include a dashboard link only when it is stable
and authorized. Retrying the same period must not send a second message.

## Missing data [success:no-data]

A day without data sends an explicit no-data message. Never turn missing data
into a numeric zero.

## Failure [success:visible-retry]

A delivery failure is visible, excludes credentials and sensitive CRM data, and
permits a later retry without duplicate delivery.

## Conflicts [success:conflict-safety]

A conflicting existing property is not reused, overwritten, or duplicated.
