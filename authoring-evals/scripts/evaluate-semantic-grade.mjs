import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { contentId } from "./lib/run-contract.mjs";
import { semanticGate } from "./lib/semantic-gate.mjs";

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!["--grade", "--out"].includes(name) || !value) {
      throw new Error("Usage: evaluate-semantic-grade.mjs --grade <json> [--out <json>]");
    }
    options[name.slice(2)] = value;
  }
  if (!options.grade) throw new Error("--grade is required");
  return options;
}

const options = parseArguments(process.argv.slice(2));
const grade = JSON.parse(await readFile(path.resolve(options.grade), "utf8"));
if (typeof grade.grade_id !== "string" || grade.semantic_grade_version !== "1") {
  throw new Error("Input is not a finalized semantic grade");
}
const body = {
  semantic_grade_gate_version: "1",
  grade_id: grade.grade_id,
  subject: grade.subject,
  evaluator_id: grade.evaluator_id,
  gate: semanticGate(grade)
};
const report = { ...body, gate_id: contentId("semantic-grade-gate", body) };
const output = `${JSON.stringify(report, null, 2)}\n`;
if (options.out) {
  await writeFile(path.resolve(options.out), output, { encoding: "utf8", flag: "wx" });
}
process.stdout.write(output);
