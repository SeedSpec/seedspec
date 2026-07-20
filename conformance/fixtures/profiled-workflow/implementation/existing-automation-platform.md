# Existing automation platform implementation profile

Prefer an automation platform that the organization already approves and
operates. Reuse its established credential management, connection ownership,
monitoring, alerting, retry, and audit practices.

Inspect actual HubSpot and Slack connectors rather than assuming their actions
or data models. Record the automation identifier and connection ownership
without copying secrets into the project. Ensure retries do not deliver a
duplicate daily message.

If the platform cannot calculate the metric faithfully or its data handling is
not approved, present the constraint and ask the user whether to choose another
profile.
