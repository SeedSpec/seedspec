import path from "node:path";
import { SeedSpecError } from "./errors.js";
import { readYamlFile } from "./files.js";
import { compileProtocolSchema, formatSchemaErrors } from "./schema.js";

function packageIntentSource(record, applied) {
  const artifact = record.manifest.definition.artifact
    ? (record.manifest.artifacts ?? []).find(
        (candidate) => candidate.id === record.manifest.definition.artifact
      )
    : null;
  const format = artifact
    ? {
        type: artifact.type,
        artifact: artifact.id,
        ...(artifact.format_version ? { format_version: artifact.format_version } : {}),
        ...(artifact.conforms_to ? { conforms_to: artifact.conforms_to } : {})
      }
    : { type: "org.seedspec.intent.native" };

  return {
    package: record.manifest.id,
    version: record.manifest.version,
    digest: record.digest,
    entrypoint: record.manifest.definition.entrypoint,
    provenance: "package-author",
    format,
    use: applied?.use ?? "unreviewed",
    ...(applied?.note ? { note: applied.note } : {})
  };
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

export async function resolveAppliedIntent(inputPath, records) {
  let input = null;
  if (inputPath) {
    input = await readYamlFile(path.resolve(inputPath), "Applied intent");
    const validateInput = await compileProtocolSchema("applied-intent-input.schema.json");
    if (!validateInput(input)) {
      throw new SeedSpecError("Applied intent is invalid", {
        code: "INVALID_APPLIED_INTENT",
        details: formatSchemaErrors(validateInput.errors)
      });
    }
  }

  const selected = new Map(records.map((record) => [record.manifest.id, record]));
  const packageUses = new Map();
  const unresolved = [];

  for (const packageId of duplicates((input?.packages ?? []).map((item) => item.package))) {
    throw new SeedSpecError(`Applied intent repeats package: ${packageId}`, {
      code: "INVALID_APPLIED_INTENT"
    });
  }
  for (const item of input?.packages ?? []) {
    if (!selected.has(item.package)) {
      throw new SeedSpecError(`Applied intent references an unselected package: ${item.package}`, {
        code: "INVALID_APPLIED_INTENT"
      });
    }
    packageUses.set(item.package, item);
  }

  for (const packageId of selected.keys()) {
    if (!packageUses.has(packageId)) {
      unresolved.push(`The end user has not affirmed how package ${packageId} applies to this realization.`);
    }
  }

  for (const contributionId of duplicates(
    (input?.contributions ?? []).map((item) => item.id)
  )) {
    throw new SeedSpecError(`Applied intent repeats contribution: ${contributionId}`, {
      code: "INVALID_APPLIED_INTENT"
    });
  }
  for (const contribution of input?.contributions ?? []) {
    if (contribution.status === "proposed") {
      unresolved.push(
        `Agent-proposed intent contribution ${contribution.id} still requires end-user affirmation.`
      );
    }
  }

  const resolved = {
    protocol_version: "0.2",
    status: unresolved.length > 0 ? "review" : "affirmed",
    packages: records.map((record) => packageIntentSource(
      record,
      packageUses.get(record.manifest.id)
    )),
    contributions: input?.contributions ?? [],
    unresolved
  };
  const validateResolved = await compileProtocolSchema("resolved-intent.schema.json");
  if (!validateResolved(resolved)) {
    throw new SeedSpecError("Resolved intent is invalid", {
      code: "INVALID_APPLIED_INTENT",
      details: formatSchemaErrors(validateResolved.errors)
    });
  }
  return resolved;
}

export function formatResolvedIntentSummary(intent) {
  const lines = [
    `Applied intent: ${intent.status}`,
    ...intent.packages.map((item) => (
      `- ${item.package}: ${item.use}; primary source ${item.format.type} at ${item.entrypoint}`
    ))
  ];
  if (intent.contributions.length > 0) {
    for (const item of intent.contributions) {
      lines.push(`- ${item.category}/${item.id} [${item.status}; ${item.source}]: ${item.statement}`);
      if (item.verification) {
        lines.push(
          `  plan: ${item.verification.subject} via ${item.verification.method} at ${item.verification.timing}; evidence ${item.verification.evidence}`
        );
      }
      for (const evidence of item.evidence ?? []) {
        lines.push(`  baseline evidence [${evidence.source}]: ${evidence.reference}`);
      }
    }
  }
  if (intent.unresolved.length > 0) {
    lines.push(...intent.unresolved.map((item) => `- REVIEW: ${item}`));
  }
  return lines.join("\n");
}
