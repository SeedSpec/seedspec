import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runPath, verifyRunContract } from "./lib/run-contract.mjs";

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!["--run", "--turn", "--prompt", "--executable"].includes(name) || !value) {
      throw new Error(
        "Usage: run-agent-turn.mjs --run <directory> --turn <number> --prompt <file> [--executable <path>]"
      );
    }
    options[name.slice(2)] = value;
  }
  if (!options.run || !options.turn || !options.prompt) {
    throw new Error("--run, --turn, and --prompt are required");
  }
  const turn = Number(options.turn);
  if (!Number.isInteger(turn) || turn <= 0) throw new Error("--turn must be a positive integer");
  return { ...options, turn };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitized(value, redactions) {
  if (Array.isArray(value)) return value.map((item) => sanitized(item, redactions));
  if (!isRecord(value)) return value;
  if (["thinking", "redacted_thinking", "reasoning"].includes(value.type)) {
    redactions.count += 1;
    return { type: "reasoning-redacted" };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitized(item, redactions)])
  );
}

function parseEvents(output, prompt) {
  const events = [{ type: "user.message", text: prompt }];
  const redactions = { count: 0 };
  for (const line of output.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    events.push(sanitized(JSON.parse(line), redactions));
  }
  return { events, redactions: redactions.count };
}

function findString(value, keys) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, keys);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key];
  }
  for (const item of Object.values(value)) {
    const found = findString(item, keys);
    if (found) return found;
  }
  return null;
}

function finalMessage(events, runnerId) {
  if (runnerId === "codex-cli") {
    const messages = events.filter((event) => (
      event.type === "item.completed" && event.item?.type === "agent_message"
    ));
    return messages.at(-1)?.item?.text ?? "Unavailable.";
  }
  const result = [...events].reverse().find((event) => event.type === "result");
  if (typeof result?.result === "string") return result.result;
  if (typeof result?.structured_output === "string") return result.structured_output;
  return "Unavailable.";
}

function sessionId(events, runnerId) {
  if (runnerId === "codex-cli") {
    return events.find((event) => event.type === "thread.started")?.thread_id ?? null;
  }
  return findString(events, ["session_id"]);
}

async function execute(executable, args, { cwd, prompt, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code ?? 1,
        timedOut
      });
    });
    child.stdin.end(prompt);
  });
}

async function previousCost(runDirectory, turn) {
  let total = 0;
  for (let index = 1; index < turn; index += 1) {
    const eventPath = runPath(
      runDirectory,
      `runner/turn-${String(index).padStart(2, "0")}-events.jsonl`
    );
    const source = await readFile(eventPath, "utf8");
    for (const line of source.split(/\r?\n/u)) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (typeof event.total_cost_usd === "number") total += event.total_cost_usd;
    }
  }
  return total;
}

const options = parseArguments(process.argv.slice(2));
const runDirectory = path.resolve(options.run);
const contract = await verifyRunContract(runDirectory);
const state = JSON.parse(await readFile(path.join(runDirectory, "run-state.json"), "utf8"));
if (state.status !== "running") throw new Error(`Run state must be running; received ${state.status}`);
if (options.turn > contract.budget.max_turns) throw new Error("Turn exceeds the frozen run budget");
const expectedTurn = state.turns_completed === undefined ? 1 : state.turns_completed + 1;
if (options.turn !== expectedTurn) throw new Error(`Expected turn ${expectedTurn}, received ${options.turn}`);
const elapsed = Date.now() - Date.parse(state.started_at);
const remainingDuration = contract.budget.max_duration_ms - elapsed;
if (remainingDuration <= 0) throw new Error("The frozen duration budget has expired");

const runnerId = contract.execution.runner.id;
if (!["codex-cli", "claude-code-cli"].includes(runnerId)) {
  throw new Error(`No turn adapter exists for ${runnerId}`);
}
const executable = options.executable ?? (runnerId === "codex-cli" ? "codex" : "claude");
const prompt = await readFile(path.resolve(options.prompt), "utf8");
const sessionPath = path.join(runDirectory, "runner-session.json");
let sessionLedger = null;
if (options.turn > 1) {
  sessionLedger = JSON.parse(await readFile(sessionPath, "utf8"));
  if (sessionLedger.contract_id !== contract.contract_id || sessionLedger.runner !== runnerId) {
    throw new Error("Runner session does not match the frozen contract");
  }
  if (sessionLedger.authoring_eval_runner_session_version !== "2"
      || !Array.isArray(sessionLedger.segments)
      || sessionLedger.segments.length === 0) {
    throw new Error("Runner session lineage is invalid");
  }
}
const startsFresh = options.turn === 1
  || contract.execution.continuation.fresh_turns.includes(options.turn);
const priorSegment = startsFresh ? null : sessionLedger?.segments.at(-1) ?? null;
if (!startsFresh && priorSegment === null) throw new Error("No prior session exists to resume");

let args;
let requestedSessionId = null;
if (runnerId === "codex-cli") {
  const shared = [
    "--json",
    "--model", contract.execution.model.selector,
    "-c", `model_reasoning_effort=${JSON.stringify(contract.execution.settings.reasoning_effort)}`,
    "-c", "sandbox_mode=\"workspace-write\"",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules"
  ];
  args = startsFresh
    ? ["exec", ...shared, "--sandbox", "workspace-write", "--cd", runPath(runDirectory, contract.workspace.root), "-"]
    : ["exec", "resume", ...shared, priorSegment.session_id, "-"];
} else {
  const allowedTools = contract.execution.tools.join(",");
  const shared = [
    "--print",
    "--input-format", "text",
    "--output-format", "stream-json",
    "--verbose",
    "--model", contract.execution.model.selector,
    "--tools", allowedTools,
    "--allowedTools", allowedTools,
    "--permission-mode", "acceptEdits",
    "--setting-sources", "",
    "--strict-mcp-config",
    "--mcp-config", "{\"mcpServers\":{}}",
    "--disable-slash-commands"
  ];
  const spendLimit = contract.budget.max_spend_usd;
  if (spendLimit !== null) {
    const remainingSpend = spendLimit - await previousCost(runDirectory, options.turn);
    if (remainingSpend <= 0) throw new Error("The frozen spend budget has expired");
    shared.push("--max-budget-usd", String(remainingSpend));
  }
  requestedSessionId = startsFresh ? randomUUID() : null;
  args = startsFresh
    ? [...shared, "--session-id", requestedSessionId]
    : [...shared, "--resume", priorSegment.session_id];
}

const versionExecution = await execute(executable, ["--version"], {
  cwd: runPath(runDirectory, contract.workspace.root),
  prompt: "",
  timeoutMs: Math.min(remainingDuration, 30000)
});
const actualVersion = versionExecution.stdout.trim();
if (versionExecution.exitCode !== 0 || actualVersion !== contract.execution.runner.version) {
  throw new Error(
    `Runner version changed: expected ${contract.execution.runner.version}, received ${actualVersion || "unavailable"}`
  );
}

const execution = await execute(executable, args, {
  cwd: runPath(runDirectory, contract.workspace.root),
  prompt,
  timeoutMs: remainingDuration
});
const parsed = parseEvents(execution.stdout, prompt);
const observedSessionId = sessionId(parsed.events, runnerId);
if (!startsFresh && observedSessionId !== null && observedSessionId !== priorSegment.session_id) {
  throw new Error("Resumed runner returned a different session identity");
}
const currentSessionId = priorSegment?.session_id
  ?? observedSessionId
  ?? requestedSessionId;
if (!currentSessionId) throw new Error("Runner returned no session identity");
const turnPrefix = `runner/turn-${String(options.turn).padStart(2, "0")}`;
const eventsContent = `${parsed.events.map((event) => JSON.stringify(event)).join("\n")}\n`;
const message = finalMessage(parsed.events, runnerId);
await mkdir(path.join(runDirectory, "runner"), { recursive: true });
await Promise.all([
  writeFile(runPath(runDirectory, `${turnPrefix}-events.jsonl`), eventsContent, {
    encoding: "utf8",
    flag: "wx"
  }),
  writeFile(runPath(runDirectory, `${turnPrefix}-stderr.log`), execution.stderr, {
    encoding: "utf8",
    flag: "wx"
  }),
  writeFile(runPath(runDirectory, `${turnPrefix}-final.txt`), `${message}\n`, {
    encoding: "utf8",
    flag: "wx"
  })
]);
if (startsFresh) {
  const nextLedger = {
    authoring_eval_runner_session_version: "2",
    contract_id: contract.contract_id,
    runner: runnerId,
    segments: [
      ...(sessionLedger?.segments ?? []),
      { started_turn: options.turn, session_id: currentSessionId }
    ]
  };
  await writeFile(sessionPath, `${JSON.stringify(nextLedger, null, 2)}\n`, {
    encoding: "utf8",
    flag: options.turn === 1 ? "wx" : "w"
  });
}
await writeFile(path.join(runDirectory, "run-state.json"), `${JSON.stringify({
  ...state,
  turns_completed: options.turn,
  last_runner_exit_code: execution.exitCode,
  last_runner_timed_out: execution.timedOut
}, null, 2)}\n`, { encoding: "utf8", flag: "w" });
process.stdout.write(`${JSON.stringify({
  run_id: contract.run_id,
  turn: options.turn,
  session_id: currentSessionId,
  continuation: {
    fresh: startsFresh,
    segment_started_turn: startsFresh ? options.turn : sessionLedger.segments.at(-1).started_turn
  },
  exit_code: execution.exitCode,
  timed_out: execution.timedOut,
  reasoning_redactions: parsed.redactions,
  final_message: message,
  events: runPath(runDirectory, `${turnPrefix}-events.jsonl`),
  final: runPath(runDirectory, `${turnPrefix}-final.txt`)
}, null, 2)}\n`);
if (execution.exitCode !== 0 || execution.timedOut) process.exitCode = 1;
