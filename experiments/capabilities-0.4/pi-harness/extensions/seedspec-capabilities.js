import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const CONFIG_PATH = ".seedspec/check-harness.json";

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveInside(root, value, label) {
  const resolved = path.resolve(root, value);
  if (!inside(root, resolved)) throw new Error(`${label} must remain inside the project`);
  return resolved;
}

async function readConfig(cwd) {
  const configPath = path.join(cwd, CONFIG_PATH);
  let config;
  try {
    config = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Invalid ${CONFIG_PATH}: ${error.message}`, { cause: error });
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`${CONFIG_PATH} must contain a JSON object`);
  }
  for (const field of ["package", "evaluate", "workspace"]) {
    if (typeof config[field] !== "string" || !config[field]) {
      throw new Error(`${CONFIG_PATH} requires ${field}`);
    }
  }
  if (!Array.isArray(config.cli) || config.cli.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`${CONFIG_PATH} requires a non-empty cli string array`);
  }
  return {
    ...config,
    maxRepairTurns: Number.isInteger(config.maxRepairTurns) && config.maxRepairTurns >= 0
      ? config.maxRepairTurns
      : 3,
    telemetry: config.telemetry ?? ".seedspec/check-trace.jsonl"
  };
}

function hash(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function checkArguments(config) {
  return [
    ...config.cli.slice(1),
    "check",
    config.package,
    "--evaluate",
    config.evaluate,
    "--workspace",
    config.workspace,
    "--json"
  ];
}

async function appendTelemetry(cwd, config, event) {
  const destination = resolveInside(cwd, config.telemetry, "telemetry path");
  await mkdir(path.dirname(destination), { recursive: true });
  await appendFile(destination, `${JSON.stringify({
    trace_version: "0.4",
    recorded_at: new Date().toISOString(),
    ...event
  })}\n`, "utf8");
}

async function runGate(pi, cwd, config, signal) {
  const result = await pi.exec(config.cli[0], checkArguments(config), {
    cwd,
    signal,
    timeout: 120000
  });
  let report = null;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    // Preserve the process output as the diagnostic when JSON is unavailable.
  }
  const passed = result.code === 0 && report?.status === "pass";
  await appendTelemetry(cwd, config, {
    event: "gate",
    passed,
    exit_code: result.code,
    report_digest: report ? hash(report) : null
  });
  return {
    passed,
    report,
    diagnostic: report
      ? JSON.stringify(report, null, 2)
      : [result.stderr, result.stdout].filter(Boolean).join("\n")
  };
}

const checkTool = (state) => defineTool({
  name: "seedspec_check",
  label: "Check SeedSpec claims",
  description: "Run the configured SeedSpec check against independent evaluator evidence.",
  promptSnippet: "Check the configured SeedSpec package",
  promptGuidelines: [
    "Use seedspec_check after material implementation changes and repair every failed criterion."
  ],
  parameters: Type.Object({}),
  async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
    const result = await runGate(state.pi, ctx.cwd, state.config, signal);
    return {
      content: [{
        type: "text",
        text: result.passed ? "SeedSpec check passed." : `SeedSpec check failed.\n${result.diagnostic}`
      }],
      details: result
    };
  }
});

const completionTool = (state) => defineTool({
  name: "seedspec_complete",
  label: "Complete after SeedSpec check",
  description: "Finish the task only when the configured SeedSpec check passes.",
  promptSnippet: "Terminate only after every enforceable criterion passes",
  promptGuidelines: [
    "Use seedspec_complete as the final action. It terminates only when the SeedSpec check passes."
  ],
  parameters: Type.Object({
    summary: Type.String({ description: "Concise implementation summary." })
  }),
  async execute(_toolCallId, params, signal, _onUpdate, ctx) {
    state.completionAttempts += 1;
    const result = await runGate(state.pi, ctx.cwd, state.config, signal);
    if (!result.passed) {
      return {
        content: [{ type: "text", text: `Completion blocked.\n${result.diagnostic}` }],
        details: { ...result, completionAttempts: state.completionAttempts }
      };
    }
    state.completed = true;
    await appendTelemetry(ctx.cwd, state.config, {
      event: "complete",
      summary_digest: hash(params.summary),
      completion_attempts: state.completionAttempts
    });
    return {
      content: [{ type: "text", text: `SeedSpec check passed. ${params.summary}` }],
      details: { ...result, summary: params.summary },
      terminate: true
    };
  }
});

export default function seedspecCheckHarness(pi) {
  const state = {
    pi,
    config: null,
    completed: false,
    completionAttempts: 0,
    repairTurns: 0
  };

  pi.on("session_start", async (_event, ctx) => {
    state.config = await readConfig(ctx.cwd);
    if (!state.config) return;
    pi.registerTool(checkTool(state));
    pi.registerTool(completionTool(state));
    await appendTelemetry(ctx.cwd, state.config, { event: "session-start" });
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!state.config) return undefined;
    await appendTelemetry(ctx.cwd, state.config, {
      event: "agent-start",
      prompt_digest: hash(event.prompt)
    });
    return {
      systemPrompt: `${event.systemPrompt}\n\nSeedSpec check enforcement is active. Read SPEC.md and the declared evaluation module. Implement the success criteria. Call seedspec_check after material changes. Call seedspec_complete as the final action. A normal final response does not complete this task. Implementing-agent judgment is not verification.`
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!state.config) return undefined;
    await appendTelemetry(ctx.cwd, state.config, {
      event: "tool-call",
      tool: event.toolName,
      input_digest: hash(event.input)
    });
    return undefined;
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (!state.config || state.completed || state.repairTurns >= state.config.maxRepairTurns) return;
    const result = await runGate(pi, ctx.cwd, state.config);
    if (result.passed) {
      pi.sendMessage({
        customType: "seedspec-check-enforcement",
        content: "The SeedSpec check passes. Call seedspec_complete with the final summary.",
        display: true
      }, { deliverAs: "followUp", triggerTurn: true });
      return;
    }
    state.repairTurns += 1;
    pi.sendMessage({
      customType: "seedspec-check-enforcement",
      content: `The task is not complete. Repair the failed criteria below, then recheck.\n${result.diagnostic}`,
      display: true
    }, { deliverAs: "followUp", triggerTurn: true });
  });
}
