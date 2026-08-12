# Security and operating constraints

Status: approved by Security and Sales Operations.

- Use only the HubSpot account, Slack workspace, and channel authorized for the
  implementation.
- Do not put credentials, tokens, cookies, private keys, or customer records in
  the package, configuration, logs, or evidence.
- Inspect existing resources before creation. Reuse only when identity,
  ownership, type, and business meaning match.
- Stop for user direction when an existing property or destination is
  ambiguous. Do not overwrite a conflicting resource.
- Make delivery failure visible and safely retryable.
- Keep implementation records to stable resource identifiers. Do not record
  secrets or sensitive customer data.
- Explain a new recurring service or cost before the user selects it.
