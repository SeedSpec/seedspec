import { readFile } from "node:fs/promises";
import path from "node:path";
import { sha256 } from "./run-contract.mjs";

function within(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (
    !path.isAbsolute(relative)
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
  );
}

export async function evaluateAcceptanceCoverage(contract, packagePath) {
  if (contract?.acceptance_coverage_contract_version !== "1") {
    throw new Error("Unsupported acceptance coverage contract");
  }
  if (!Array.isArray(contract.critical_obligations) || contract.critical_obligations.length === 0) {
    throw new Error("critical_obligations must not be empty");
  }
  if (!Array.isArray(contract.coverage)) throw new Error("coverage must be an array");

  const issues = [];
  const coverageById = new Map(contract.coverage.map((entry) => [entry.obligation_id, entry]));
  for (const obligation of contract.critical_obligations) {
    const evidence = coverageById.get(obligation.id);
    if (!evidence) {
      issues.push({
        obligation_id: obligation.id,
        problem: "critical obligation has no acceptance evidence"
      });
      continue;
    }
    const evidencePath = path.resolve(packagePath, evidence.path);
    if (!within(evidencePath, packagePath)) {
      issues.push({ obligation_id: obligation.id, problem: "evidence path escapes package" });
      continue;
    }
    try {
      const source = await readFile(evidencePath);
      if (sha256(source) !== evidence.file_digest) {
        issues.push({ obligation_id: obligation.id, problem: "acceptance evidence changed" });
      }
    } catch (error) {
      issues.push({
        obligation_id: obligation.id,
        problem: `cannot read acceptance evidence: ${error.message}`
      });
    }
  }
  return issues;
}

