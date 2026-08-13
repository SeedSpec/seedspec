/**
 * Think agent for SeedSpec check enforcement.
 *
 * Workers cannot spawn the Node evaluator. Point CHECK_URL at a local
 * `seedspec preview` server (or any host that exposes GET /api/check) and let
 * Think refuse completion unless that report status is pass.
 */
import { Think } from "@cloudflare/think";

export class SeedSpecAgent extends Think {
  getSystemPrompt() {
    return [
      "You implement SeedSpec packages.",
      "Read SPEC.md. Treat success criteria as the work list.",
      "Do not expand the intended capability surface.",
      "Call seedspec_check after material changes.",
      "Call seedspec_complete only as the final action.",
      "Your own judgment is not verification."
    ].join(" ");
  }

  getTools() {
    const checkUrl = this.env.CHECK_URL;
    return {
      seedspec_check: {
        description: "Run the configured SeedSpec check.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => {
          const report = await fetchCheck(checkUrl);
          return report.status === "pass"
            ? "SeedSpec check passed."
            : `SeedSpec check failed.\n${JSON.stringify(report, null, 2)}`;
        }
      },
      seedspec_complete: {
        description: "Finish only when the SeedSpec check passes.",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["summary"],
          properties: {
            summary: { type: "string" }
          }
        },
        execute: async ({ summary }) => {
          const report = await fetchCheck(checkUrl);
          if (report.status !== "pass") {
            return `Completion blocked.\n${JSON.stringify(report, null, 2)}`;
          }
          return `SeedSpec check passed. ${summary}`;
        }
      }
    };
  }
}

async function fetchCheck(checkUrl) {
  if (!checkUrl) throw new Error("CHECK_URL is not configured");
  const response = await fetch(new URL("/api/check", checkUrl));
  if (!response.ok) throw new Error(`Check endpoint failed: ${response.status}`);
  return response.json();
}
