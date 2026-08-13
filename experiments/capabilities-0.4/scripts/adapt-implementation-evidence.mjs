import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export function adaptImplementationEvidence(bundle, behavioralResult, {
  resultReference = "behavioral-result.json"
} = {}) {
  if (bundle?.authorship?.status !== "accepted" || !bundle.bundle_digest) {
    throw new Error("An accepted capability bundle is required");
  }
  if (!Array.isArray(behavioralResult?.checks)) {
    throw new Error("Behavioral result requires checks");
  }
  const observed = new Map(behavioralResult.checks.map((check) => [check.id, check]));
  const records = [];
  for (const capability of bundle.capabilities) {
    for (const outcome of capability.outcomes) {
      for (const check of outcome.acceptance) {
        const result = observed.get(check.id);
        if (!result) throw new Error(`Behavioral result omits capability check: ${check.id}`);
        records.push({
          capability: capability.id,
          outcome: outcome.id,
          check: check.id,
          status: result.passed ? "pass" : "fail",
          evidence: [{
            source: "tool",
            reference: `${resultReference}#${check.id}`,
            description: result.passed
              ? result.description
              : `${result.description}: ${result.error ?? "failed"}`
          }]
        });
      }
    }
  }
  return {
    capability_evidence_version: "0.4-experimental",
    bundle_digest: bundle.bundle_digest,
    stage: "verification",
    records
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${name}`);
    if (name === "--bundle") options.bundle = value;
    else if (name === "--behavioral-result") options.behavioralResult = value;
    else if (name === "--out") options.out = value;
    else throw new Error(`Unknown option: ${name}`);
  }
  if (!options.bundle || !options.behavioralResult || !options.out) {
    throw new Error(
      "Usage: adapt-implementation-evidence.mjs --bundle <yaml> "
      + "--behavioral-result <json> --out <yaml>"
    );
  }
  return options;
}

async function main(argv) {
  const options = parseArguments(argv);
  const bundle = parseYaml(await readFile(path.resolve(options.bundle), "utf8"));
  const behavioralResult = JSON.parse(
    await readFile(path.resolve(options.behavioralResult), "utf8")
  );
  const evidence = adaptImplementationEvidence(bundle, behavioralResult, {
    resultReference: path.basename(options.behavioralResult)
  });
  await writeFile(path.resolve(options.out), stringifyYaml(evidence), { flag: "wx" });
  process.stdout.write(`${path.resolve(options.out)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
