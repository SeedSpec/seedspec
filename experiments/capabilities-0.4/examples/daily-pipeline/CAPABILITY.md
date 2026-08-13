---
name: daily-pipeline-briefing
description: Verify that one configured HubSpot metric is reported for the previous local day and delivered safely to Slack.
---

# Daily pipeline briefing

Capability: `org.seedspec.fixtures.daily-pipeline-briefing@0.1.0`

This file is the progressive-disclosure entry point. The accepted structured
bundle is [`accepted.yaml`](accepted.yaml).

## Outcomes

- Required HubSpot resources exist without duplicates.
- The query uses the previous calendar day in the configured timezone.
- One complete message reaches the authorized Slack channel.
- Missing data remains distinct from numeric zero.
- Delivery failures are visible, secret-safe, and retryable.
- Conflicting existing state stops before mutation.

## Integration edges

The capability needs authorized HubSpot and Slack scopes. It offers observable
delivery and failure evidence. A composition agent maps those descriptions to
host-specific packages and records its rationale.

## Verification

The bundle defines ten acceptance checks. Checks may be deterministic or
nondeterministic. Evidence must identify the exact check and accepted bundle
digest. A declared check or script is not proof that it passed.

## Supporting material

- [`proposed.yaml`](proposed.yaml) shows the agent-authored proposal.
- [`model-proposed-terra.yaml`](model-proposed-terra.yaml) records the fresh
  extraction used in the enforcement pilot.
- [`accepted.yaml`](accepted.yaml) records author acceptance and the immutable
  bundle digest.
