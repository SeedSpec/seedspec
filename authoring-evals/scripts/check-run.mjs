import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyRunContract } from "./lib/run-contract.mjs";

function parseArguments(argv) {
  const options = { prepared: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === "--prepared") options.prepared = true;
    else if (name === "--json") options.json = true;
    else if (name === "--run" && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      options.run = argv[index + 1];
      index += 1;
    } else {
      throw new Error("Usage: check-run.mjs --run <directory> [--prepared] [--json]");
    }
  }
  if (!options.run) throw new Error("--run is required");
  return options;
}

const options = parseArguments(process.argv.slice(2));
const runDirectory = path.resolve(options.run);
const contract = await verifyRunContract(runDirectory, { prepared: options.prepared });
const state = JSON.parse(await readFile(path.join(runDirectory, "run-state.json"), "utf8"));
if (state.contract_id !== contract.contract_id) {
  throw new Error("run-state.json does not match the frozen contract");
}
if (options.prepared && state.status !== "prepared") {
  throw new Error(`Prepared preflight requires prepared state; current status is ${state.status}`);
}
const result = {
  ready: true,
  phase: options.prepared ? "prepared" : state.status,
  run_id: contract.run_id,
  contract_id: contract.contract_id,
  subject: contract.subject.id,
  workspace: path.join(runDirectory, contract.workspace.root)
};
process.stdout.write(options.json
  ? `${JSON.stringify(result, null, 2)}\n`
  : `Authoring evaluation run is ${result.phase}: ${result.run_id}\n`);
