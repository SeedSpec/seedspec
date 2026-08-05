import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyRunContract } from "./lib/run-contract.mjs";

function runArgument(argv) {
  if (argv.length !== 2 || argv[0] !== "--run" || !argv[1]) {
    throw new Error("Usage: start-run.mjs --run <directory>");
  }
  return path.resolve(argv[1]);
}

const runDirectory = runArgument(process.argv.slice(2));
const contract = await verifyRunContract(runDirectory, { prepared: true });
const statePath = path.join(runDirectory, "run-state.json");
const state = JSON.parse(await readFile(statePath, "utf8"));
if (state.contract_id !== contract.contract_id) {
  throw new Error("run-state.json does not match the frozen contract");
}
if (state.status !== "prepared") {
  throw new Error(`Only a prepared run can start; current status is ${state.status}`);
}
const startedAt = new Date().toISOString();
const started = { ...state, status: "running", started_at: startedAt };
await writeFile(statePath, `${JSON.stringify(started, null, 2)}\n`, {
  encoding: "utf8",
  flag: "w"
});
process.stdout.write(`${JSON.stringify({
  run_id: contract.run_id,
  contract_id: contract.contract_id,
  status: "running",
  started_at: startedAt,
  workspace: path.join(runDirectory, contract.workspace.root),
  handoff: path.join(runDirectory, contract.authoring.handoff.path)
}, null, 2)}\n`);
