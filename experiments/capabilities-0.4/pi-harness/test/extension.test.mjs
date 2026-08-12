import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { adaptImplementationEvidence } from "../../scripts/adapt-implementation-evidence.mjs";
import seedspecCapabilityHarness from "../extensions/seedspec-capabilities.js";

const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const experimentRoot = path.resolve(harnessRoot, "..");
const repositoryRoot = path.resolve(experimentRoot, "../..");
const packagePath = path.join(repositoryRoot, "conformance/fixtures/profiled-workflow");
const bundlePath = path.join(experimentRoot, "examples/daily-pipeline/accepted.yaml");
const evaluatorPath = path.join(
  repositoryRoot,
  "authoring-evals/implementation-evals/hidden/evaluate.mjs"
);
const fixtureRoot = path.join(
  repositoryRoot,
  "authoring-evals/implementation-evals/fixtures"
);
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

async function behavioralResult(fixture) {
  const result = await execute(process.execPath, [
    evaluatorPath,
    path.join(fixtureRoot, fixture)
  ]);
  assert.equal(result.code, 0);
  return JSON.parse(result.stdout);
}

test("Pi extension blocks failure, requests repair, and terminates after trusted evidence", async (t) => {
  const workspace = await mkdtemp(path.join(tmpdir(), "seedspec-pi-harness-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await cp(packagePath, path.join(workspace, "spec"), { recursive: true });
  await cp(bundlePath, path.join(workspace, "CAPABILITY.yaml"));
  await mkdir(path.join(workspace, ".seedspec"));
  const evidencePath = path.join(workspace, ".seedspec/evidence.yaml");
  const bundle = parseYaml(await readFile(bundlePath, "utf8"));
  await writeFile(
    evidencePath,
    stringifyYaml(adaptImplementationEvidence(bundle, await behavioralResult("weak"))),
    "utf8"
  );
  await writeFile(path.join(workspace, ".seedspec/capability-harness.json"), `${JSON.stringify({
    package: "spec",
    bundle: "CAPABILITY.yaml",
    stage: "verification",
    evidence: ".seedspec/evidence.yaml",
    cli: [process.execPath, cliPath],
    maxRepairTurns: 1,
    telemetry: ".seedspec/capability-trace.jsonl"
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
  seedspecCapabilityHarness(pi);
  const ctx = { cwd: workspace };
  await handlers.get("session_start")({}, ctx);
  assert.deepEqual([...tools.keys()].sort(), [
    "seedspec_capability_check",
    "seedspec_capability_complete"
  ]);
  const injection = await handlers.get("before_agent_start")({
    prompt: "implement",
    systemPrompt: "system"
  }, ctx);
  assert.match(injection.systemPrompt, /capability enforcement is active/u);

  const completion = tools.get("seedspec_capability_complete");
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
  assert.equal(messages[0].options.triggerTurn, true);

  await writeFile(
    evidencePath,
    stringifyYaml(adaptImplementationEvidence(bundle, await behavioralResult("reference"))),
    "utf8"
  );
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
    path.join(workspace, ".seedspec/capability-trace.jsonl"),
    "utf8"
  )).trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(telemetry.some((event) => event.event === "gate" && event.passed === false));
  assert.ok(telemetry.some((event) => event.event === "gate" && event.passed === true));
  assert.ok(telemetry.some((event) => event.event === "complete"));
  assert.ok(telemetry.every((event) => !Object.hasOwn(event, "prompt")));
});
