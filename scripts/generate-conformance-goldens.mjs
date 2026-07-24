import {
  cp,
  mkdir,
  mkdtemp,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify as stringifyYaml } from "yaml";
import {
  PROTOCOL_OWNED_RESOLUTION_PATHS,
  resolveProject,
  validatePackage
} from "@seedspec/runtime";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarios = [
  {
    name: "minimal-handoff",
    root: "conformance/fixtures/portable-feature",
    additions: []
  },
  {
    name: "composed-handoff",
    root: "conformance/fixtures/comprehensive-application",
    additions: ["conformance/fixtures/portable-feature"]
  }
];

async function exists(target) {
  try {
    return await stat(target);
  } catch {
    return null;
  }
}

for (const scenario of scenarios) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "seedspec-golden-"));
  try {
    const rootPackage = path.join(root, scenario.root);
    const additions = scenario.additions.map((addition) => path.join(root, addition));
    const records = await Promise.all([
      validatePackage(rootPackage),
      ...additions.map(validatePackage)
    ]);
    const configurationSelectionsPath = path.join(
      temporaryRoot,
      "configuration-selections.yaml"
    );
    const appliedIntentPath = path.join(temporaryRoot, "applied-intent.yaml");
    await writeFile(configurationSelectionsPath, stringifyYaml({
      protocol_version: "0.2",
      packages: records.map((record) => ({
        package: record.manifest.id,
        selection: "example"
      }))
    }), "utf8");
    await writeFile(appliedIntentPath, stringifyYaml({
      protocol_version: "0.2",
      packages: records.map((record) => ({
        package: record.manifest.id,
        use: "as-authored"
      })),
      contributions: []
    }), "utf8");

    const projectRoot = path.join(temporaryRoot, "project");
    const result = await resolveProject(rootPackage, {
      additionPaths: additions,
      configurationSelectionsPath,
      appliedIntentPath,
      outputDirectory: projectRoot
    });
    const goldenWorkspace = path.join(
      root,
      "conformance/golden",
      scenario.name,
      ".seedspec"
    );
    await rm(goldenWorkspace, { recursive: true, force: true });
    await mkdir(goldenWorkspace, { recursive: true });

    for (const relativePath of [
      ...PROTOCOL_OWNED_RESOLUTION_PATHS,
      "resolution-receipt.json"
    ]) {
      const source = path.join(result.workspace, relativePath);
      if (!await exists(source)) continue;
      const destination = path.join(goldenWorkspace, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination, { recursive: true });
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
