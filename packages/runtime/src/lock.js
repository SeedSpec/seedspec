import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { pathExists } from "./files.js";
import { validatePackage } from "./validate.js";

export async function createLock(inputPaths) {
  const packages = [];
  for (const inputPath of inputPaths) {
    const record = await validatePackage(inputPath);
    packages.push({
      id: record.manifest.id,
      name: record.manifest.name,
      version: record.manifest.version,
      digest: record.digest,
      source: path.resolve(inputPath)
    });
  }
  return {
    lock_version: "0.4",
    generated_at: new Date().toISOString(),
    packages
  };
}

export async function verifyLock(lock) {
  const results = [];
  for (const entry of lock.packages ?? []) {
    const record = await validatePackage(entry.source);
    const mismatches = [
      record.manifest.id === entry.id
        ? null
        : `id: locked ${entry.id}; package ${record.manifest.id}`,
      record.manifest.version === entry.version
        ? null
        : `version: locked ${entry.version}; package ${record.manifest.version}`,
      record.digest === entry.digest
        ? null
        : `digest: locked ${entry.digest}; package ${record.digest}`
    ].filter(Boolean);
    results.push({
      id: entry.id,
      source: entry.source,
      digest: record.digest,
      status: mismatches.length === 0 ? "pass" : "fail",
      mismatches
    });
  }
  return {
    status: results.every(({ status }) => status === "pass") ? "pass" : "fail",
    results
  };
}

export async function getPackage(source, { digest, output } = {}) {
  if (!digest || !output) {
    throw new SeedSpecError("seedspec get requires --digest and --output", {
      code: "MISSING_OPTION_VALUE"
    });
  }
  const destination = path.resolve(output);
  if (await pathExists(destination)) {
    throw new SeedSpecError(`Get destination already exists: ${destination}`, {
      code: "GET_DESTINATION_EXISTS"
    });
  }
  await mkdir(path.dirname(destination), { recursive: true });
  try {
    await cp(path.resolve(source), destination, { recursive: true });
    const record = await validatePackage(destination);
    if (record.digest !== digest) {
      throw new SeedSpecError(
        `Fetched package digest ${record.digest} does not match ${digest}`,
        { code: "DIGEST_MISMATCH" }
      );
    }
    return {
      id: record.manifest.id,
      version: record.manifest.version,
      digest: record.digest,
      output: destination
    };
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
}

export function formatLock(lock) {
  const lines = [`SeedSpec lock ${lock.lock_version}`, `Generated: ${lock.generated_at}`];
  for (const entry of lock.packages) {
    lines.push(`${entry.id}@${entry.version} ${entry.digest}`, `  source: ${entry.source}`);
  }
  return lines.join("\n");
}

export function formatLockVerification(report) {
  const lines = report.results.map((result) => (
    `${result.status === "pass" ? "PASS" : "FAIL"} ${result.id}`
    + (result.mismatches.length ? ` — ${result.mismatches.join("; ")}` : "")
  ));
  lines.push("", `${report.status.toUpperCase()} ${report.results.length} locked package(s)`);
  return lines.join("\n");
}

export async function writeLock(lock, outputPath) {
  const destination = path.resolve(outputPath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  return destination;
}
