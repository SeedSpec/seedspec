import { readFile, writeFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { protocolRelease, protocolVersion } from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { resolvePackageLocation } from "./files.js";
import { validatePackage } from "./validate.js";

export async function upgradePackage(inputPath, {
  to = protocolRelease.release_id,
  write = false
} = {}) {
  if (to !== protocolRelease.release_id) {
    throw new SeedSpecError(`Unsupported SeedSpec upgrade target: ${to}`, {
      code: "UNSUPPORTED_UPGRADE_TARGET",
      details: [`supported target: ${protocolRelease.release_id}`]
    });
  }
  const { root, manifestPath } = await resolvePackageLocation(inputPath);
  const source = await readFile(manifestPath, "utf8");
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    throw new SeedSpecError(`Cannot parse SeedSpec manifest: ${manifestPath}`, {
      code: "INVALID_MANIFEST",
      details: document.errors.map(({ message }) => message)
    });
  }
  const from = document.get("protocol_version");
  if (from === protocolVersion) {
    return {
      upgrade_version: "1",
      source_protocol: from,
      target_release: to,
      target_protocol: protocolVersion,
      changes: [],
      written: false,
      package: root
    };
  }
  if (from !== "0.1" || protocolVersion !== "0.2") {
    throw new SeedSpecError(`No safe automatic migration from protocol ${String(from)}`, {
      code: "UNSUPPORTED_PROTOCOL_MIGRATION",
      details: [`target protocol: ${protocolVersion}`]
    });
  }

  const changes = [{
    path: "seedspec.yaml",
    field: "protocol_version",
    from,
    to: protocolVersion,
    reason: "Select the SeedSpec 0.2 package and handoff contract."
  }];
  if (write) {
    document.set("protocol_version", protocolVersion);
    await writeFile(manifestPath, document.toString(), "utf8");
    const record = await validatePackage(root);
    return {
      upgrade_version: "1",
      source_protocol: from,
      target_release: to,
      target_protocol: protocolVersion,
      changes,
      written: true,
      package: root,
      digest: record.digest
    };
  }
  return {
    upgrade_version: "1",
    source_protocol: from,
    target_release: to,
    target_protocol: protocolVersion,
    changes,
    written: false,
    package: root
  };
}

export function formatUpgrade(result) {
  const lines = [
    `SeedSpec upgrade: protocol ${result.source_protocol} -> ${result.target_protocol}`,
    `Target release: ${result.target_release}`,
    `Mode: ${result.written ? "written" : "dry run"}`,
    `Package: ${result.package}`
  ];
  if (result.changes.length === 0) {
    lines.push("No source change is required.");
  } else {
    for (const change of result.changes) {
      lines.push(`- ${change.path}: ${change.field} ${change.from} -> ${change.to}`);
    }
  }
  if (!result.written && result.changes.length > 0) {
    lines.push("Rerun with --write to apply this migration.");
  }
  if (result.digest) lines.push(`Digest: ${result.digest}`);
  return lines.join("\n");
}
