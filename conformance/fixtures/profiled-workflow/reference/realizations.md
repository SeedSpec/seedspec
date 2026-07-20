# Candidate realizations

These approaches are represented as implementation profiles in the package
manifest. Listing them does not activate tools or authorize external changes.

## HubSpot-native

Prefer when the customer's HubSpot edition and enabled capabilities can perform
the calculation, schedule, and Slack delivery faithfully. This minimizes
external infrastructure but may be constrained by native reporting and workflow
behavior.

## Existing automation platform

Prefer when the customer already operates an approved automation system with
HubSpot and Slack access, monitoring, credential management, and ownership.
Reuse established operational controls rather than creating a new service.

## Scheduled service

Prefer when the calculation, formatting, observability, or delivery behavior
cannot be represented faithfully in existing platforms. The agent remains free
to select architecture, language, and hosting subject to the end user's
technical preferences and security requirements.

## Comparing the paths

The implementation agent should inspect the actual customer environment,
explain material tradeoffs, and follow the preferred implementation profile
recorded with `-i` or `--implementation`. If no preference is recorded while
multiple profiles are available, the agent must explain the choices and ask the
end user which direction to prefer. If the preferred path cannot satisfy the
intended outcome, the agent should present evidence and ask the end user to
reconsider rather than silently switching approaches.
