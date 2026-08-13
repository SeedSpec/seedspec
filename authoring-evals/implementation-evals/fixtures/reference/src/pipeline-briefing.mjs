const TIMEZONE = "America/Chicago";
const RESOURCES = [
  ["property", "qualified_pipeline_value", {
    object: "deal",
    ownership: "authorized HubSpot account",
    businessMeaning: "qualified pipeline value"
  }],
  ["report", "daily-qualified-pipeline-report", {
    object: "deal",
    property: "qualified_pipeline_value",
    timezone: TIMEZONE
  }],
  ["dashboard", "daily-qualified-pipeline", {
    name: "Daily Qualified Pipeline",
    report: "daily-qualified-pipeline-report"
  }],
  ["schedule", "daily-qualified-pipeline-0800", {
    time: "08:00",
    timezone: TIMEZONE,
    channel: "#sales-daily"
  }]
];

function equivalent(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function priorDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year").value);
  const month = Number(parts.find((part) => part.type === "month").value);
  const day = Number(parts.find((part) => part.type === "day").value);
  const prior = new Date(Date.UTC(year, month - 1, day - 1));
  return prior.toISOString().slice(0, 10);
}

export function createPipelineBriefing(dependencies) {
  return {
    async setup() {
      for (const [kind, identity, definition] of RESOURCES) {
        const existing = await dependencies.resources.find(kind, identity);
        if (existing && !equivalent(existing.definition, definition)) {
          return { status: "needs-direction", kind, identity };
        }
        if (!existing) await dependencies.resources.create(kind, identity, definition);
      }
      return { status: "ready" };
    },
    async deliver() {
      const date = priorDate(dependencies.clock.now());
      const idempotencyKey = `qualified-pipeline:${date}:${TIMEZONE}`;
      if (await dependencies.slack.hasMessage(idempotencyKey)) return { status: "already-sent" };
      const result = await dependencies.hubspot.qualifiedPipelineValue({
        object: "deal",
        property: "qualified_pipeline_value",
        date,
        timezone: TIMEZONE
      });
      const link = await dependencies.hubspot.dashboardLink("Daily Qualified Pipeline");
      const linkText = link?.stable && link.authorized ? ` ${link.url}` : "";
      const text = result.status === "no-data"
        ? `qualified_pipeline_value for ${date}: no data (${TIMEZONE}).${linkText}`
        : `qualified_pipeline_value for ${date}: ${result.value} (${TIMEZONE}).${linkText}`;
      try {
        await dependencies.slack.send({
          channel: "#sales-daily",
          text,
          idempotencyKey
        });
      } catch {
        await dependencies.operations.recordFailure({
          operation: "daily-qualified-pipeline-delivery",
          date,
          retryable: true
        });
        throw new Error("Daily pipeline delivery failed");
      }
      return { status: "sent" };
    }
  };
}
