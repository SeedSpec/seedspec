import { spawnSync } from "node:child_process";

const major = Number(process.versions.node.split(".")[0]);
if (major < 22) {
  process.stdout.write(`Skipping Pi harness on Node ${process.version} (requires 22+)\n`);
  process.exit(0);
}

const prefix = "experiments/capabilities-0.4/pi-harness";
for (const args of [["ci", "--prefix", prefix], ["test", "--prefix", prefix]]) {
  const result = spawnSync("npm", args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
