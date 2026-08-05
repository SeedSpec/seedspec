import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { SeedSpecError } from "../errors.js";

export function authoringWorkspaceLockPath(stateRoot) {
  const absolute = path.resolve(stateRoot);
  return path.join(
    path.dirname(absolute),
    `.${path.basename(absolute)}.seedspec-mutation.lock`
  );
}

export async function withAuthoringWorkspaceMutationLock(stateRoot, operation) {
  const lockPath = authoringWorkspaceLockPath(stateRoot);
  const token = randomUUID();
  await mkdir(path.dirname(lockPath), { recursive: true });

  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ token, pid: process.pid })}\n`, "utf8");
  } catch (error) {
    await handle?.close().catch(() => {});
    if (handle) await unlink(lockPath).catch(() => {});
    if (error.code === "EEXIST") {
      throw new SeedSpecError("Another authoring mutation is already in progress", {
        code: "AUTHORING_WORKSPACE_BUSY",
        details: [lockPath]
      });
    }
    throw error;
  }

  try {
    return await operation();
  } finally {
    await handle.close();
    const owner = await readFile(lockPath, "utf8").catch(() => null);
    if (owner) {
      try {
        if (JSON.parse(owner).token === token) await unlink(lockPath);
      } catch {
        // Never remove a lock whose ownership cannot be verified.
      }
    }
  }
}
