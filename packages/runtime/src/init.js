import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { validatePackage } from "./validate.js";

function starterDefinition(title, kind) {
  return `# ${title}\n\n> \`${kind}\` is an authoring hint, not a completeness checklist or implementation constraint.\n\n## Seed\n\nDescribe what should exist or change, who it is for, and why it matters. A short honest seed is valid; include only intent you actually want to communicate.\n\n## Boundaries and choices\n\nRecord boundaries, fixed decisions, configurable variation, or deliberate latitude only when you already know they matter. Do not fill this section from a generic product checklist.\n`;
}

function starterSuccess(title) {
  return `# ${title} success\n\nDescribe at least one result that someone could observe if the seed were realized successfully.\n\nKeep these observations aligned with the seed. They do not need to cover features or policies the seed never introduces, and they are a plan for judging a future realization rather than evidence that one exists.\n`;
}

function titleFromDirectory(directory) {
  return path.basename(directory)
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function idFromDirectory(directory) {
  const slug = path.basename(directory)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "package";
  return `org.example.${slug}`;
}

export async function initPackage(kind, outputDirectory) {
  const supportedKinds = [
    "solution",
    "application",
    "feature",
    "workflow",
    "automation",
    "configuration",
    "integration"
  ];
  if (!supportedKinds.includes(kind)) {
    throw new SeedSpecError(`Unknown package kind: ${kind}`, { code: "INVALID_KIND" });
  }

  const root = path.resolve(outputDirectory);
  const title = titleFromDirectory(root);
  const manifest = {
    protocol_version: "0.2",
    id: idFromDirectory(root),
    name: title,
    version: "0.1.0",
    kind,
    description: `Describe the ${kind}'s intended outcome.`,
    definition: {
      entrypoint: "seed.md"
    },
    configuration: {
      schema: "configuration/schema.json",
      example: "configuration/example.yaml"
    },
    ...(kind === "feature" ? {
      requires: { capabilities: [] }
    } : {}),
    provides: { capabilities: [] },
    ...(kind === "feature" ? {
      compatibility: { scope: "generic" }
    } : {}),
    components: {
      acceptance: "success.md"
    }
  };
  const definition = starterDefinition(title, kind);
  const configurationSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `${title} configuration`,
    type: "object",
    additionalProperties: false,
    properties: {}
  };

  await Promise.all([
    mkdir(path.join(root, "configuration"), { recursive: true })
  ]);
  await Promise.all([
    writeFile(path.join(root, "seedspec.yaml"), stringifyYaml(manifest), "utf8"),
    writeFile(path.join(root, manifest.definition.entrypoint), definition, "utf8"),
    writeFile(path.join(root, "configuration/schema.json"), `${JSON.stringify(configurationSchema, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "configuration/example.yaml"), "{}\n", "utf8"),
    writeFile(path.join(root, "success.md"), starterSuccess(title), "utf8")
  ]);

  await validatePackage(root);
  return { root, manifest };
}
