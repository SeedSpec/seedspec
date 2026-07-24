import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import {
  protocolRelease,
  protocolReleaseDigest
} from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { validatePackage } from "./validate.js";

export const AUTHOR_EVAL_FORMAT = "1";

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative));
}

function instructions(request) {
  return `# Independent SeedSpec handoff evaluation

This workspace helps an author learn from an agent's attempt to use one exact
package. It is an evaluation harness, not a certification.

## Bound subject

- Package: \`${request.package.id}@${request.package.version}\`
- Package digest: \`${request.package.digest}\`
- Protocol release: \`${request.protocol_release.id}\`

If the package digest changes, create a new evaluation workspace. Do not carry a
result forward to different bytes.

## Agent procedure

1. Start in a fresh target workspace without the authoring conversation.
2. Inspect the package with \`seedspec begin <package-path>\`.
3. Record any information you must request before implementation separately
   from choices the package deliberately delegates to you.
4. Attempt only the scoped realization the author asked you to evaluate. Do not
   invent product requirements to make the attempt succeed.
5. Record observable results, blockers, deviations, and the evidence subject in
   \`eval-result.yaml\`.
6. Classify each suggested package improvement as an ambiguity, missing
   obligation, missing boundary, missing acceptance observation, misplaced
   implementation detail, or handoff problem.
7. Distinguish a package problem from an agent limitation, environment
   constraint, tool failure, or intentionally open implementation choice.
8. Return proposed package improvements to the author. Do not edit the package
   silently and do not claim that one successful run proves general quality.

## Author procedure

Review every proposed improvement, accept only those that reflect intended
product meaning, revise the package through \`seedspec prepare\`, and create a
new evaluation workspace for the new digest. Compare runs as evidence about
specific handoff questions, not as a universal score.
`;
}

export async function createAuthorEvaluation(inputPath, {
  outputDirectory,
  toolVersion = "unknown"
} = {}) {
  const record = await validatePackage(inputPath);
  const destination = path.resolve(outputDirectory ?? `${record.root}.eval`);
  if (isWithin(record.root, destination)) {
    throw new SeedSpecError("Evaluation state must remain outside the SeedSpec package", {
      code: "EVAL_OUTPUT_INSIDE_PACKAGE",
      details: [`package: ${record.root}`, `output: ${destination}`]
    });
  }
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await mkdir(destination, { recursive: false });
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new SeedSpecError("Evaluation output already exists", {
        code: "EVAL_OUTPUT_EXISTS",
        details: [destination]
      });
    }
    throw error;
  }

  const request = {
    eval_harness_version: AUTHOR_EVAL_FORMAT,
    protocol_release: {
      id: protocolRelease.release_id,
      digest: protocolReleaseDigest
    },
    tool: {
      name: "@seedspec/cli",
      version: toolVersion
    },
    package: {
      path: path.relative(destination, record.root),
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    instructions: "agent-instructions.md",
    result: "eval-result.yaml"
  };
  const result = {
    eval_result_version: AUTHOR_EVAL_FORMAT,
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest
    },
    evaluator: {
      agent: "",
      model: "",
      tools: []
    },
    outcome: "not-run",
    scope: "",
    observations: [],
    blockers: [],
    deviations: [],
    evidence: [],
    package_improvements: [],
    limitations: []
  };

  await Promise.all([
    writeFile(
      path.join(destination, "eval-request.json"),
      `${JSON.stringify(request, null, 2)}\n`,
      "utf8"
    ),
    writeFile(path.join(destination, request.instructions), instructions(request), "utf8"),
    writeFile(path.join(destination, request.result), stringifyYaml(result), "utf8")
  ]);

  return {
    ...request,
    output: destination,
    paths: {
      request: path.join(destination, "eval-request.json"),
      instructions: path.join(destination, request.instructions),
      result: path.join(destination, request.result)
    }
  };
}

export function formatAuthorEvaluation(result) {
  return [
    `Created independent handoff evaluation for ${result.package.id}@${result.package.version}`,
    `Package digest: ${result.package.digest}`,
    `Workspace: ${result.output}`,
    `Agent instructions: ${result.paths.instructions}`,
    `Result record: ${result.paths.result}`,
    "Run this with a fresh agent context; use the observations to improve the package, not as a general quality score."
  ].join("\n");
}
