import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import seedspecCheckHarness from "../extensions/seedspec-capabilities.js";

const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(harnessRoot, "../../..");
const packagePath = path.join(repositoryRoot, "examples/daily-pipeline/package");
const evaluatorPath = path.join(repositoryRoot, "examples/daily-pipeline/evaluator/evaluate.mjs");
const fixtureRoot = path.join(repositoryRoot, "examples/daily-pipeline/fixtures");
const cliPath = path.join(repositoryRoot, "packages/cli/bin/seedspec.js");

function execute(executable, args, { cwd, signal, timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      signal,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), timeout);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

test("Pi extension blocks a weak workspace and completes after trusted evaluation", async (t) => {
  const workspace = await mkdtemp(path.join(tmpdir(), "seedspec-pi-check-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await cp(packagePath, path.join(workspace, "spec"), { recursive: true });
  await cp(path.join(fixtureRoot, "weak"), workspace, { recursive: true });
  await mkdir(path.join(workspace, ".seedspec"));
  await writeFile(path.join(workspace, ".seedspec/check-harness.json"), `${JSON.stringify({
    package: "spec",
    evaluate: evaluatorPath,
    workspace: ".",
    cli: [process.execPath, cliPath],
    maxRepairTurns: 1,
    telemetry: ".seedspec/check-trace.jsonl"
  }, null, 2)}\n`);

  const handlers = new Map();
  const tools = new Map();
  const messages = [];
  const pi = {
    on(event, handler) {
      handlers.set(event, handler);
    },
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
    exec: execute,
    sendMessage(message, options) {
      messages.push({ message, options });
    }
  };
  seedspecCheckHarness(pi);
  const ctx = { cwd: workspace };
  await handlers.get("session_start")({}, ctx);
  assert.deepEqual([...tools.keys()].sort(), ["seedspec_check", "seedspec_complete"]);
  const injection = await handlers.get("before_agent_start")({
    prompt: "implement",
    systemPrompt: "system"
  }, ctx);
  assert.match(injection.systemPrompt, /check enforcement is active/u);

  const completion = tools.get("seedspec_complete");
  const blocked = await completion.execute(
    "call-1",
    { summary: "done" },
    new globalThis.AbortController().signal,
    () => {},
    ctx
  );
  assert.equal(blocked.details.passed, false);
  assert.equal(blocked.terminate, undefined);
  await handlers.get("agent_settled")({}, ctx);
  assert.equal(messages.length, 1);
  assert.match(messages[0].message.content, /not complete/u);

  await cp(path.join(fixtureRoot, "reference/src/pipeline-briefing.mjs"), path.join(workspace, "src/pipeline-briefing.mjs"));
  const completed = await completion.execute(
    "call-2",
    { summary: "verified" },
    new globalThis.AbortController().signal,
    () => {},
    ctx
  );
  assert.equal(completed.details.passed, true);
  assert.equal(completed.terminate, true);

  const telemetry = (await readFile(
    path.join(workspace, ".seedspec/check-trace.jsonl"),
    "utf8"
  )).trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(telemetry.some((event) => event.event === "gate" && event.passed === false));
  assert.ok(telemetry.some((event) => event.event === "gate" && event.passed === true));
  assert.ok(telemetry.some((event) => event.event === "complete"));
});
