import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArguments(argv) {
  const options = { events: [], finals: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error("Every collect-evidence option requires a value");
    }
    if (name === "--event") options.events.push(value);
    else if (name === "--final") options.finals.push(value);
    else options[name.slice(2)] = value;
    index += 1;
  }
  if (!["codex", "claude"].includes(options.format)) {
    throw new Error("--format must be codex or claude");
  }
  if (!options.output) throw new Error("--output is required");
  if (options.events.length === 0) throw new Error("At least one --event is required");
  return options;
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

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function addUsage(total, source) {
  const aliases = {
    input_tokens: ["input_tokens", "inputTokens"],
    cached_input_tokens: ["cached_input_tokens", "cache_read_input_tokens", "cachedInputTokens"],
    cache_write_input_tokens: [
      "cache_write_input_tokens",
      "cache_creation_input_tokens",
      "cacheCreationInputTokens"
    ],
    output_tokens: ["output_tokens", "outputTokens"],
    reasoning_output_tokens: ["reasoning_output_tokens", "reasoningOutputTokens"]
  };
  for (const [target, candidates] of Object.entries(aliases)) {
    const value = candidates.map((candidate) => source?.[candidate]).find((candidate) => (
      typeof candidate === "number"
    ));
    total[target] += numeric(value);
  }
}

function commandEvents(value, turn, commands) {
  if (Array.isArray(value)) {
    value.forEach((item) => commandEvents(item, turn, commands));
    return;
  }
  if (!isRecord(value)) return;
  if (value.type === "command_execution" && typeof value.command === "string") {
    commands.push({
      turn,
      command: value.command,
      status: value.status ?? null,
      exit_code: value.exit_code ?? null
    });
  }
  if (value.type === "tool_use" && typeof value.name === "string") {
    commands.push({
      turn,
      tool: value.name,
      input: sanitized(value.input ?? null, { count: 0 })
    });
  }
  Object.values(value).forEach((item) => commandEvents(item, turn, commands));
}

const options = parseArguments(process.argv.slice(2));
const outputDirectory = path.resolve(options.output);
await mkdir(outputDirectory, { recursive: true });
const transcript = [];
const commands = [];
const redactions = { count: 0 };
const usage = {
  capture: options.format === "claude" ? "provider-reported" : "runner-reported",
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 0,
  reasoning_output_tokens: 0,
  turns: 0
};
let costUsd = 0;
let costAvailable = false;

for (const [turnIndex, eventPath] of options.events.entries()) {
  const lines = (await readFile(path.resolve(eventPath), "utf8")).split(/\r?\n/u);
  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    const clean = sanitized(event, redactions);
    transcript.push({ turn: turnIndex + 1, event: clean });
    commandEvents(clean, turnIndex + 1, commands);
    if (event.type === "turn.completed") {
      usage.turns += 1;
      addUsage(usage, event.usage);
    }
    if (event.type === "result" || event.subtype === "result") {
      usage.turns += 1;
      addUsage(usage, event.usage);
      if (typeof event.total_cost_usd === "number") {
        costUsd += event.total_cost_usd;
        costAvailable = true;
      }
    }
  }
}
usage.total_tokens = usage.input_tokens + usage.output_tokens + (
  options.format === "claude"
    ? usage.cached_input_tokens + usage.cache_write_input_tokens
    : 0
);
if (costAvailable) usage.cost_usd = costUsd;

const finalMessages = [];
for (const finalPath of options.finals) {
  finalMessages.push((await readFile(path.resolve(finalPath), "utf8")).trim());
}
const finalMessage = finalMessages.at(-1) ?? "Unavailable.";
await Promise.all([
  writeFile(
    path.join(outputDirectory, "transcript.jsonl"),
    `${transcript.map((event) => JSON.stringify(event)).join("\n")}\n`,
    { encoding: "utf8", flag: "wx" }
  ),
  writeFile(
    path.join(outputDirectory, "command-trace.jsonl"),
    `${commands.map((command) => JSON.stringify(command)).join("\n")}\n`,
    { encoding: "utf8", flag: "wx" }
  ),
  writeFile(
    path.join(outputDirectory, "usage.json"),
    `${JSON.stringify(usage, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  ),
  writeFile(path.join(outputDirectory, "final-message.md"), `${finalMessage}\n`, {
    encoding: "utf8",
    flag: "wx"
  })
]);
process.stdout.write(`${JSON.stringify({
  format: options.format,
  turns: usage.turns,
  commands: commands.length,
  reasoning_redactions: redactions.count,
  usage,
  output: outputDirectory
}, null, 2)}\n`);
