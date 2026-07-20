# Security constraints

- Do not store HubSpot or Slack credentials, tokens, cookies, private keys, or
  recovery material in this package or its resolved configuration.
- Use only the target accounts, workspace, channel, and scopes explicitly
  authorized by the end user.
- Prefer an approved credential provider or an explicitly authorized
  authenticated session.
- Minimize CRM data in logs, Slack messages, screenshots, and verification
  evidence.
- Resolve ambiguous account or workspace identity before making changes.
- Explain any new recurring cost, externally hosted service, or broadly scoped
  integration before creating it.
