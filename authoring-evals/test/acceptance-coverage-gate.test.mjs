import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { evaluateAcceptanceCoverage } from "../scripts/lib/acceptance-coverage-gate.mjs";
import { sha256 } from "../scripts/lib/run-contract.mjs";

test("acceptance coverage gate rejects missing critical evidence", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "seedspec-acceptance-coverage-"));
  await mkdir(path.join(root, "acceptance"));
  const acceptance = "# Acceptance\n\n- Check A.\n";
  await writeFile(path.join(root, "acceptance/criteria.md"), acceptance);
  const contract = {
    acceptance_coverage_contract_version: "1",
    critical_obligations: [{ id: "a" }, { id: "b" }],
    coverage: [{
      obligation_id: "a",
      path: "acceptance/criteria.md",
      file_digest: sha256(acceptance)
    }]
  };
  const issues = await evaluateAcceptanceCoverage(contract, root);
  assert.deepEqual(issues, [{
    obligation_id: "b",
    problem: "critical obligation has no acceptance evidence"
  }]);
});

test("acceptance coverage gate admits frozen complete evidence", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "seedspec-acceptance-coverage-"));
  await mkdir(path.join(root, "acceptance"));
  const acceptance = "# Acceptance\n\n- Check A.\n- Check B.\n";
  await writeFile(path.join(root, "acceptance/criteria.md"), acceptance);
  const evidence = (id) => ({
    obligation_id: id,
    path: "acceptance/criteria.md",
    file_digest: sha256(acceptance)
  });
  const contract = {
    acceptance_coverage_contract_version: "1",
    critical_obligations: [{ id: "a" }, { id: "b" }],
    coverage: [evidence("a"), evidence("b")]
  };
  assert.deepEqual(await evaluateAcceptanceCoverage(contract, root), []);
});

