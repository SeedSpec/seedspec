import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { pathExists, readYamlFile, resolvePackagePath } from "./files.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";

function portablePath(...segments) {
  return segments.join("/");
}

function packageDirectoryName(packageId) {
  return packageId.replace(/[^a-z0-9.-]/g, "-");
}

export async function validateTaskRunbook(root, manifest) {
  if (!manifest.tasks) return null;

  const runbookPath = resolvePackagePath(root, manifest.tasks);
  const info = await pathExists(runbookPath);
  if (!info || !info.isFile()) {
    throw new SeedSpecError(`Task runbook must reference a file: ${manifest.tasks}`, {
      code: "INVALID_TASK_RUNBOOK"
    });
  }

  const runbook = await readYamlFile(runbookPath, "Task runbook");
  const validate = await compileProtocolSchema("task-runbook.schema.json");
  if (!validate(runbook)) {
    throw new SeedSpecError(`Task runbook is invalid: ${manifest.tasks}`, {
      code: "INVALID_TASK_RUNBOOK",
      details: formatSchemaErrors(validate.errors)
    });
  }

  const ids = new Set();
  const errors = [];
  for (const task of runbook.tasks) {
    if (ids.has(task.id)) errors.push(`task ID appears more than once: ${task.id}`);
    ids.add(task.id);

    for (const reference of task.references ?? []) {
      const referenceInfo = await pathExists(resolvePackagePath(root, reference));
      if (!referenceInfo) {
        errors.push(`tasks.${task.id}.references does not exist: ${reference}`);
      } else if (!referenceInfo.isFile()) {
        errors.push(`tasks.${task.id}.references must reference a file: ${reference}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new SeedSpecError(`Task runbook has invalid references or IDs: ${manifest.tasks}`, {
      code: "INVALID_TASK_RUNBOOK",
      details: errors
    });
  }

  return runbook;
}

export async function materializeTasks(records, workspace) {
  const referenceRoot = path.join(workspace, "task-references");
  await rm(referenceRoot, { recursive: true, force: true });
  await mkdir(referenceRoot, { recursive: true });

  const index = {
    protocol_version: "0.1",
    packages: []
  };

  for (const record of records) {
    if (!record.taskRunbook) continue;
    const packageDirectory = packageDirectoryName(record.manifest.id);
    const copied = new Set();
    const tasks = [];

    for (const task of record.taskRunbook.tasks) {
      const references = [];
      for (const sourcePath of task.references ?? []) {
        const resolvedPath = portablePath("task-references", packageDirectory, sourcePath);
        if (!copied.has(sourcePath)) {
          const destination = path.join(workspace, ...resolvedPath.split("/"));
          await mkdir(path.dirname(destination), { recursive: true });
          await cp(resolvePackagePath(record.root, sourcePath), destination);
          copied.add(sourcePath);
        }
        references.push({ source_path: sourcePath, path: resolvedPath });
      }
      tasks.push({
        id: task.id,
        instruction: task.instruction,
        references
      });
    }

    index.packages.push({
      package: record.manifest.id,
      source_path: record.manifest.tasks,
      tasks
    });
  }

  return index;
}
