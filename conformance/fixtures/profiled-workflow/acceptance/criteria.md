# Acceptance criteria

1. The intended HubSpot account contains exactly one applicable numeric
   property with the configured object, internal name, label, and business
   meaning.
2. The configured dashboard contains a report that calculates the intended
   daily average, and a known-data check produces the expected result.
3. The selected execution approach calculates the previous calendar day using
   the configured IANA timezone, including across a daylight-saving boundary.
4. A test delivery reaches the resolved Slack workspace and channel with the
   metric label, reporting period, formatted value or explicit no-data state,
   and dashboard link when available.
5. A retry does not create duplicate HubSpot resources, schedules, integrations,
   or Slack messages.
6. A conflicting existing property or ambiguous target account stops before a
   destructive change and is surfaced to the end user.
7. Delivery failures are observable and safely retryable without exposing CRM
   data or credentials.
8. Implementation notes record stable identifiers for created, updated, or
   reused HubSpot, Slack, and scheduling resources without recording secrets or
   sensitive customer data.
