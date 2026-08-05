import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { protocolRelease, protocolVersion } from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { resolvePackageLocation } from "./files.js";

export async function upgradePackage(inputPath, {
  to = protocolRelease.release_id,
  // Accepted for the documented dry-run-first contract; no migration can
  // write yet because Protocol 0.3 is a clean cut.
  write: _write = false
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
  throw new SeedSpecError(`No safe automatic migration from protocol ${String(from)}`, {
    code: "UNSUPPORTED_PROTOCOL_MIGRATION",
    details: [
      `target protocol: ${protocolVersion}`,
      "Protocol 0.3 is a clean cut. Re-author the manifest with definition.module and context.modules."
    ]
  });
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
