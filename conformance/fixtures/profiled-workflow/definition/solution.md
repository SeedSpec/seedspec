# HubSpot Daily Metric

## Purpose

Make one customer-defined sales metric visible in HubSpot and deliver its
previous-day average to a Slack channel every morning. The intended result is a
configured cross-system solution. A standalone application is not required.

## Target systems

- HubSpot is the system of record for the metric and the location of the
  dashboard.
- Slack is the delivery surface for the daily briefing.
- The scheduled calculation and delivery may run in HubSpot, an approved
  automation platform already used by the customer, or a small scheduled
  service. The user selects the direction after the agent inspects the actual
  environment.

Provider specificity is intentional. An end user may direct an agent to adapt
the package to another CRM or communication system, but this package does not
claim that such an adaptation is tested or lossless.

## Actors and authority

- A HubSpot administrator authorizes property, report, dashboard, workflow, and
  app changes in the intended HubSpot account.
- A Slack administrator or channel owner authorizes message delivery to the
  intended workspace and channel.
- Sales leaders view the dashboard and receive the briefing.
- The implementation agent may inspect and change only the accounts and
  resources explicitly placed in scope by the end user.

## Intended state

1. The configured numeric property exists on the selected HubSpot object.
2. A dashboard contains a report showing the configured aggregation over time.
3. A scheduled process calculates the previous calendar day's value in the
   configured timezone.
4. A concise Slack message is delivered at the configured local time.
5. The implementation record identifies the resources created, updated, or
   reused without containing credentials or sensitive customer data.

## Existing-state discovery and idempotency

Before creating anything, inspect the target HubSpot account and Slack
workspace. Reuse an existing property only when its internal name, object,
field type, and business meaning match. Reuse or update an existing report,
dashboard, schedule, or delivery integration only when ownership and purpose
are clear.

Retries must not create duplicate properties, dashboards, reports, schedules,
or Slack messages. When exact reconciliation is unsafe or ambiguous, stop and
ask the end user which existing resource is authoritative.

## Daily workflow

1. At the configured delivery time, calculate the metric for the previous
   calendar day in the configured timezone.
2. Apply the configured empty-day behavior.
3. Format a Slack message containing the metric label, period, value, and a link
   to the HubSpot dashboard when a stable authorized link is available.
4. Deliver the message once to the configured channel.
5. Preserve failure information through the selected execution environment's
   normal logs or alerts without leaking CRM data.

## Failures and edge cases

- Missing HubSpot or Slack authorization prevents consequential changes; it is
  not permission to request or persist credentials in the package.
- A conflicting existing property requires user resolution before mutation.
- Missing or late-arriving data must follow the configured empty-day behavior
  and must not silently report a misleading zero.
- Timezone and daylight-saving transitions use the configured IANA timezone.
- A delivery failure must be visible and safely retryable without duplicate
  messages.
- Platform limitations may justify preferring a different implementation profile,
  but the agent must explain the conflict and obtain user direction before
  changing an explicit choice.

## Implementation freedom

The package defines the intended result, platform context, configuration,
constraints, and evidence. It does not prescribe API calls, browser steps,
hosting, programming language, or orchestration technology unless a recorded
implementation-profile preference, technical preference, or the core outcome
genuinely requires it.
