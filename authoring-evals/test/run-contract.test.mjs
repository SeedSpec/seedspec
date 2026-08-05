import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testRoot, "../..");
const scriptsRoot = path.join(repositoryRoot, "authoring-evals", "scripts");
const subjectRoot = path.join(
  repositoryRoot,
  "authoring-evals",
  "subjects",
  "conflict-contraction-declined-expansion"
);

async function runScript(name, args, { reject = true } = {}) {
  try {
    const result = await execFileAsync(process.execPath, [path.join(scriptsRoot, name), ...args], {
      cwd: repositoryRoot,
      maxBuffer: 20 * 1024 * 1024
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (reject) throw error;
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

async function prepareRun({ runnerId = "test-runner", runnerVersion = "1.0.0" } = {}) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-authoring-eval-test-"));
  const runDirectory = path.join(temporaryRoot, "run");
  const result = await runScript("prepare-run.mjs", [
    "--subject", subjectRoot,
    "--out", runDirectory,
    "--runner-id", runnerId,
    "--runner-version", runnerVersion,
    "--model-provider", "test-provider",
    "--model-id", "test/model",
    "--model-selector", "test-model",
    "--reasoning-effort", "test",
    "--tool", "filesystem",
    "--tool", "shell",
    "--network", "disabled",
    "--max-duration-ms", "60000",
    "--max-turns", "10",
    "--max-spend-usd", "none",
    "--max-input-tokens", "1000000",
    "--max-output-tokens", "100000",
    "--retention-class", "test-local"
  ]);
  return { runDirectory, prepared: JSON.parse(result.stdout) };
}

test("a prepared run freezes controls without exposing proxy-author answers", async () => {
  const { runDirectory, prepared } = await prepareRun();
  assert.equal(prepared.status, "prepared");
  assert.match(prepared.contract_id, /^run-contract-[a-f0-9]{64}$/u);

  const checked = await runScript("check-run.mjs", ["--run", runDirectory, "--prepared", "--json"]);
  assert.equal(JSON.parse(checked.stdout).ready, true);
  const contract = JSON.parse(await readFile(path.join(runDirectory, "run-contract.json"), "utf8"));
  const handoff = await readFile(path.join(runDirectory, "workspace", "HANDOFF.md"), "utf8");
  const sources = await readFile(path.join(runDirectory, "workspace", "authoring", "sources.yaml"), "utf8");
  assert.equal(contract.subject.id, "conflict-contraction-declined-expansion");
  assert.equal(contract.execution.network, "disabled");
  assert.deepEqual(contract.execution.tools, ["filesystem", "shell"]);
  assert.match(handoff, /Do not read parent directories/u);
  assert.doesNotMatch(handoff, /Use only the authenticated team channel/u);
  assert.match(sources, /approved-product-brief/u);
  assert.match(sources, /approved-security-policy/u);
});

test("changed frozen input fails prepared preflight", async () => {
  const { runDirectory } = await prepareRun();
  const handoffPath = path.join(runDirectory, "workspace", "HANDOFF.md");
  const handoff = await readFile(handoffPath, "utf8");
  await writeFile(handoffPath, `${handoff}\nchanged\n`, "utf8");
  const checked = await runScript(
    "check-run.mjs",
    ["--run", runDirectory, "--prepared", "--json"],
    { reject: false }
  );
  assert.notEqual(checked.code, 0);
  assert.match(checked.stderr, /frozen agent handoff changed/u);
});

test("failed execution retains evidence and becomes quarantined", async () => {
  const { runDirectory } = await prepareRun();
  await runScript("start-run.mjs", ["--run", runDirectory]);
  const transcript = path.join(runDirectory, "runner-transcript.jsonl");
  const commands = path.join(runDirectory, "runner-commands.jsonl");
  const usage = path.join(runDirectory, "runner-usage.json");
  await Promise.all([
    writeFile(transcript, '{"type":"message","text":"failed"}\n', "utf8"),
    writeFile(commands, '{"command":"author review","status":"failed"}\n', "utf8"),
    writeFile(usage, `${JSON.stringify({
      capture: "runner-reported",
      input_tokens: 100,
      output_tokens: 20,
      turns: 1
    })}\n`, "utf8")
  ]);

  const finalized = await runScript("finalize-run.mjs", [
    "--run", runDirectory,
    "--status", "failed",
    "--exit-code", "1",
    "--transcript", transcript,
    "--commands", commands,
    "--usage", usage
  ], { reject: false });
  assert.equal(finalized.code, 1);
  assert.equal(JSON.parse(finalized.stdout).outcome, "quarantined");
  const result = JSON.parse(await readFile(path.join(runDirectory, "run-result.json"), "utf8"));
  const quarantine = JSON.parse(await readFile(path.join(runDirectory, "quarantine.json"), "utf8"));
  assert.equal(result.outcome, "quarantined");
  assert.match(result.evidence.transcript.digest, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(quarantine.reasons, ["Runner ended with status failed."]);
});

test("provider evidence collection redacts reasoning and records commands", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-authoring-capture-test-"));
  const events = path.join(temporaryRoot, "events.jsonl");
  const final = path.join(temporaryRoot, "final.txt");
  const output = path.join(temporaryRoot, "captured");
  await writeFile(events, [
    JSON.stringify({ type: "item.completed", item: { type: "reasoning", text: "hidden" } }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "command_execution", command: "seedspec author review", status: "completed", exit_code: 0 }
    }),
    JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 20, reasoning_output_tokens: 5 }
    })
  ].join("\n"), "utf8");
  await writeFile(final, "Done.\n", "utf8");
  const collected = await runScript("collect-evidence.mjs", [
    "--format", "codex",
    "--event", events,
    "--final", final,
    "--output", output
  ]);
  assert.equal(JSON.parse(collected.stdout).reasoning_redactions, 1);
  const transcript = await readFile(path.join(output, "transcript.jsonl"), "utf8");
  const commands = await readFile(path.join(output, "command-trace.jsonl"), "utf8");
  const usage = JSON.parse(await readFile(path.join(output, "usage.json"), "utf8"));
  assert.doesNotMatch(transcript, /hidden/u);
  assert.match(transcript, /reasoning-redacted/u);
  assert.match(commands, /seedspec author review/u);
  assert.equal(usage.total_tokens, 120);
});

test("the turn adapter captures a resumable sanitized runner turn", async () => {
  const { runDirectory } = await prepareRun({
    runnerId: "codex-cli",
    runnerVersion: "fake-codex 1.0.0"
  });
  await runScript("start-run.mjs", ["--run", runDirectory]);
  const fakeRunner = path.join(runDirectory, "fake-codex.mjs");
  const prompt = path.join(runDirectory, "prompt.txt");
  await writeFile(fakeRunner, `#!/usr/bin/env node
if (process.argv.includes("--version")) {
  process.stdout.write("fake-codex 1.0.0\\n");
} else {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "thread-test" }) + "\\n");
    process.stdout.write(JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "Question for the author?" }
    }) + "\\n");
    process.stdout.write(JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: input.length, cached_input_tokens: 0, output_tokens: 5 }
    }) + "\\n");
  });
}
`, "utf8");
  await chmod(fakeRunner, 0o755);
  await writeFile(prompt, "Start from HANDOFF.md.\n", "utf8");
  const turn = await runScript("run-agent-turn.mjs", [
    "--run", runDirectory,
    "--turn", "1",
    "--prompt", prompt,
    "--executable", fakeRunner
  ]);
  const result = JSON.parse(turn.stdout);
  assert.equal(result.session_id, "thread-test");
  assert.equal(result.final_message, "Question for the author?");
  const events = await readFile(result.events, "utf8");
  const state = JSON.parse(await readFile(path.join(runDirectory, "run-state.json"), "utf8"));
  assert.match(events, /user\.message/u);
  assert.match(events, /Start from HANDOFF/u);
  assert.equal(state.turns_completed, 1);
});
