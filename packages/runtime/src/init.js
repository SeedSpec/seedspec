import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { SeedSpecError } from "./errors.js";
import { validatePackage } from "./validate.js";

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
  if (!['application', 'feature'].includes(kind)) {
    throw new SeedSpecError(`Unknown package kind: ${kind}`, { code: "INVALID_KIND" });
  }

  const root = path.resolve(outputDirectory);
  const title = titleFromDirectory(root);
  const manifest = {
    protocol_version: "0.1",
    id: idFromDirectory(root),
    name: title,
    version: "0.1.0-alpha.1",
    kind,
    description: `Describe the ${kind}'s intended outcome.`,
    definition: {
      entrypoint: kind === "application" ? "definition/app.md" : "definition/feature.md"
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
      acceptance: "acceptance/"
    }
  };
  const definition = kind === "application"
    ? `# ${title}\n\n## Purpose\n\nDescribe the outcome this application creates.\n\n## Actors and permissions\n\nDefine who uses it and what each actor may do.\n\n## Domain concepts\n\nDefine product concepts without implementation details.\n\n## Core workflows\n\nDescribe observable workflows, rules, state changes, failures, and edge cases.\n`
    : `# ${title}\n\n## Outcome\n\nDescribe the portable feature outcome.\n\n## Required host capabilities\n\nExplain what the host must provide.\n\n## New concepts and workflows\n\nDefine behavior, permissions, state changes, failures, and integration expectations.\n\n## Portability boundary\n\nSeparate invariants from host-specific decisions.\n`;
  const configurationSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `${title} configuration`,
    type: "object",
    additionalProperties: false,
    properties: {}
  };

  await Promise.all([
    mkdir(path.join(root, "definition"), { recursive: true }),
    mkdir(path.join(root, "configuration"), { recursive: true }),
    mkdir(path.join(root, "acceptance"), { recursive: true })
  ]);
  await Promise.all([
    writeFile(path.join(root, "seedspec.yaml"), stringifyYaml(manifest), "utf8"),
    writeFile(path.join(root, manifest.definition.entrypoint), definition, "utf8"),
    writeFile(path.join(root, "configuration/schema.json"), `${JSON.stringify(configurationSchema, null, 2)}\n`, "utf8"),
    writeFile(path.join(root, "configuration/example.yaml"), "{}\n", "utf8"),
    writeFile(path.join(root, "acceptance/criteria.md"), `# ${title} acceptance criteria\n\n1. Replace this item with an observable product behavior.\n`, "utf8")
  ]);

  await validatePackage(root);
  return { root, manifest };
}
