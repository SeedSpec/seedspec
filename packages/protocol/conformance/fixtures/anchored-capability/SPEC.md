---
id: anchored-capability
name: Anchored capability
kind: feature
version: "1.0.0"
target_protocol: "0.4"
success:
  criteria:
    - id: configured-destination
      description: The report is delivered to the configured destination.
capabilities:
  items:
    - id: daily-summary
      name: Daily summary
      description: Produces and delivers a daily operational summary.
      outcomes:
        - id: delivery
          description: Delivers the report to the configured destination.
      success_criteria: [configured-destination]
tasks:
  items:
    - id: implement-summary
      instruction: Implement the daily summary.
      capabilities: [daily-summary]
      success_criteria: [configured-destination]
context_modules:
  - id: delivery-evaluation
    type: evaluation
    description: Evaluates delivery to the configured destination.
    path: context-modules/delivery-evaluation/EVAL.md
    applies_to:
      stages: [verification]
      success_criteria: [configured-destination]
---
# Delivery [success:configured-destination]

Send the completed report to the configured destination.
