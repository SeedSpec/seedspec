import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPackage, createLock, verifyLock } from "../packages/runtime/src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const example = path.join(root, "examples/daily-pipeline");
const structured = path.join(example, "package");
const markdown = path.join(example, "package-markdown");
const evaluator = path.join(example, "evaluator/evaluate.mjs");
const reference = path.join(example, "fixtures/reference");
const weak = path.join(example, "fixtures/weak");

function execute(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

const markdownCoverage = await checkPackage(markdown);
const structuredCoverage = await checkPackage(structured);
const referenceCheck = await checkPackage(structured, {
  evaluate: evaluator,
  workspace: reference
});
const weakCheck = await checkPackage(structured, {
  evaluate: evaluator,
  workspace: weak
});
const selfAttested = await checkPackage(structured, {
  evidence: {
    package_id: structuredCoverage.package.id,
    package_digest: structuredCoverage.package.digest,
    runner: { id: "implementer", kind: "implementing-agent" },
    checks: structuredCoverage.coverage.criteria.map(({ id }) => ({ id, passed: true }))
  }
});
const lock = await createLock([structured]);
const lockReport = await verifyLock(lock);

const rows = [
  ["markdown-only coverage", markdownCoverage.status, String(markdownCoverage.coverage.criteria.length), "no structured claims"],
  ["structured coverage", structuredCoverage.status, `${structuredCoverage.coverage.criteria.length - structuredCoverage.coverage.unenforceable_criteria.length}/${structuredCoverage.coverage.criteria.length} enforceable`, "hooks present"],
  ["structured + reference evaluator", referenceCheck.status, `${referenceCheck.verification.passed}/${referenceCheck.verification.required}`, "trusted evidence"],
  ["structured + weak evaluator", weakCheck.status, `${weakCheck.verification.passed}/${weakCheck.verification.required}`, "trusted evidence, known weak"],
  ["structured + self-attestation", selfAttested.status, "untrusted runner", "implementing-agent rejected"],
  ["lockfile digest", lockReport.status, lock.packages[0].digest.slice(0, 18), "content identity"]
];

process.stdout.write(`Daily-pipeline 0.4 bakeoff
Package digest: ${structuredCoverage.package.digest}

`);
for (const [name, status, detail, note] of rows) {
  process.stdout.write(`${status.toUpperCase().padEnd(8)} ${name.padEnd(36)} ${detail}  (${note})\n`);
}

const cli = path.join(root, "packages/cli/bin/seedspec.js");
const cliCheck = await execute([cli, "check", structured, "--evaluate", evaluator, "--workspace", reference, "--json"]);
const cliReport = JSON.parse(cliCheck.stdout);
if (cliReport.status !== "pass") {
  throw new Error(`CLI check of the reference workspace failed: ${cliCheck.stderr || cliCheck.stdout}`);
}

const failed = referenceCheck.status !== "pass"
  || weakCheck.status !== "fail"
  || selfAttested.status !== "fail"
  || structuredCoverage.status !== "pass"
  || markdownCoverage.status !== "review"
  || lockReport.status !== "pass";
if (failed) {
  process.stderr.write("\nBakeoff did not match the expected 0.4 gate behavior.\n");
  process.exitCode = 1;
} else {
  process.stdout.write(`
Expected pattern held:
- Markdown-only is review, not enforceable.
- Structured 0.4 coverage is complete.
- Independent evaluation passes the reference and fails the weak fixture.
- Implementing-agent evidence cannot certify verification.
`);
}
