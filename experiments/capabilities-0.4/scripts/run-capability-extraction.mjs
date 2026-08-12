import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { validateCapabilityBundle } from "../../../packages/runtime/src/index.js";

function parseArguments(argv) {
  const options = {
    model: "gpt-5.6-terra",
    reasoning: "medium",
    confirm: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--confirm-model-execution") {
      options.confirm = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${name}`);
    if (name === "--package") options.package = value;
    else if (name === "--kit") options.kit = value;
    else if (name === "--out") options.out = value;
    else if (name === "--model") options.model = value;
    else if (name === "--reasoning") options.reasoning = value;
    else throw new Error(`Unknown option: ${name}`);
    index += 1;
  }
  if (!options.package || !options.kit || !options.out) {
    throw new Error(
      "Usage: run-capability-extraction.mjs --package <path> --kit <directory> "
      + "--out <proposal.yaml> [--model <selector>] [--reasoning <effort>] "
      + "--confirm-model-execution"
    );
  }
  if (!options.confirm) throw new Error("Model execution requires --confirm-model-execution");
  return options;
}

function execute(executable, args, { cwd, input, timeoutMs = 900000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"]
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
        exitCode: code ?? 1,
        timedOut,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
    child.stdin.end(input);
  });
}

function sanitizedEvents(jsonl) {
  const events = [];
  for (const line of jsonl.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "turn.completed") {
        events.push({ type: event.type, usage: event.usage ?? null });
      } else if (event.type === "turn.failed") {
        events.push({ type: event.type, error: event.error?.message ?? "failed" });
      } else {
        events.push({ type: event.type, item_type: event.item?.type ?? null });
      }
    } catch {
      events.push({ type: "unparsed-output" });
    }
  }
  return events;
}

function removeNulls(value) {
  if (Array.isArray(value)) return value.map(removeNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== null)
      .map(([key, item]) => [key, removeNulls(item)])
  );
}

const options = parseArguments(process.argv.slice(2));
const packagePath = path.resolve(options.package);
const kitPath = path.resolve(options.kit);
const outputPath = path.resolve(options.out);
const temporary = await mkdtemp(path.join(tmpdir(), "seedspec-capability-extraction-"));
await mkdir(path.dirname(outputPath), { recursive: true });

try {
  const kit = JSON.parse(await readFile(path.join(kitPath, "extraction-kit.json"), "utf8"));
  const prompt = await readFile(path.join(kitPath, "PROMPT.md"), "utf8");
  const resultPath = path.join(temporary, "model-output.json");
  const execution = await execute("codex", [
    "exec",
    "--json",
    "--ephemeral",
    "--model", options.model,
    "-c", `model_reasoning_effort=${JSON.stringify(options.reasoning)}`,
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--sandbox", "read-only",
    "--cd", kitPath,
    "--output-schema", path.join(kitPath, kit.output_schema),
    "--output-last-message", resultPath,
    "-"
  ], {
    cwd: kitPath,
    input: `${prompt}\n\nRead extraction-kit.json. Return only the proposed bundle object as JSON.\n`
  });
  if (execution.exitCode !== 0 || execution.timedOut) {
    const failure = {
      capability_extraction_failure_version: "0.4-experimental",
      model: options.model,
      reasoning: options.reasoning,
      package: kit.package,
      exit_code: execution.exitCode,
      timed_out: execution.timedOut,
      diagnostic: execution.stderr.slice(0, 8000),
      events: sanitizedEvents(execution.stdout)
    };
    await writeFile(
      `${outputPath}.failed.json`,
      `${JSON.stringify(failure, null, 2)}\n`,
      { flag: "wx" }
    ).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    throw new Error(
      `Capability extraction failed${execution.timedOut ? " after timeout" : ""}: ${execution.stderr}`
    );
  }
  const proposal = removeNulls(JSON.parse(await readFile(resultPath, "utf8")));
  if (JSON.stringify(proposal.package) !== JSON.stringify(kit.package)) {
    throw new Error("Model output changed the frozen package binding");
  }
  const validationPath = path.join(temporary, "proposal.yaml");
  await writeFile(validationPath, stringifyYaml(proposal), "utf8");
  await validateCapabilityBundle(packagePath, validationPath);
  await writeFile(outputPath, stringifyYaml(proposal), { flag: "wx" });
  const receipt = {
    capability_extraction_run_version: "0.4-experimental",
    model: options.model,
    reasoning: options.reasoning,
    package: kit.package,
    proposal: outputPath,
    events: sanitizedEvents(execution.stdout)
  };
  await writeFile(`${outputPath}.run.json`, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${outputPath}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
