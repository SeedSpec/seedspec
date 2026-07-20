# Configuration guide

- `hubspot_object` identifies the standard HubSpot object that owns the metric.
- `property_internal_name` is the stable HubSpot internal name. Changing it may
  create a distinct property and requires existing-state review.
- `property_label` is the human-readable metric name used in HubSpot and Slack.
- `dashboard_name` identifies the intended HubSpot dashboard. An existing
  dashboard may be reused when its ownership and purpose match.
- `timezone` is an IANA timezone used to define the previous calendar day and
  the scheduled delivery time.
- `delivery_time` is local 24-hour time in the configured timezone.
- `slack_channel` is the authorized target channel name. The implementation
  must still resolve the actual Slack workspace and channel identity.
- `empty_day_behavior` either sends an explicit no-data message or records that
  the scheduled delivery was intentionally skipped. It must not substitute zero
  for missing data.
