export function createPipelineBriefing(dependencies) {
  return {
    async setup() {
      await dependencies.resources.create("dashboard", "daily", { name: "Daily Qualified Pipeline" });
    },
    async deliver() {
      await dependencies.slack.send({ channel: "#sales-daily", text: "$0", idempotencyKey: "daily" });
    }
  };
}

