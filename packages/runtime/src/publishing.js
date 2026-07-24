import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import {
  protocolRelease,
  protocolReleaseDigest
} from "@seedspec/protocol";
import { SeedSpecError } from "./errors.js";
import { auditPackage } from "./authoring.js";
import { computeFileDigest } from "./integrity.js";
import { inspectPackage } from "./inspect.js";
import { lintPackage } from "./lint.js";
import { validatePackage } from "./validate.js";

export const PUBLISH_CHECK_FORMAT = "1";
export const PACK_RECEIPT_FORMAT = "1";

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative));
}

function check(id, status, detail) {
  return { id, status, detail };
}

async function assertTargetsDoNotExist(paths) {
  for (const target of paths) {
    try {
      await access(target);
      throw new SeedSpecError(`Pack output already exists: ${target}`, {
        code: "PACK_OUTPUT_EXISTS",
        details: ["Choose another output directory or move the existing release artifact."]
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

export async function publishCheckPackage(inputPath, {
  stateDirectory,
  toolVersion = "unknown"
} = {}) {
  const record = await validatePackage(inputPath);
  const [secondRecord, inspection, lint, review] = await Promise.all([
    validatePackage(inputPath),
    inspectPackage(inputPath),
    lintPackage(inputPath),
    auditPackage(inputPath, {
      stateDirectory,
      toolVersion,
      statusOnly: true
    })
  ]);

  const checks = [
    check(
      "protocol-valid",
      "passed",
      `Protocol ${record.manifest.protocol_version}; exact release ${protocolRelease.release_id}`
    ),
    check(
      "digest-stable",
      record.digest === secondRecord.digest ? "passed" : "failed",
      record.digest === secondRecord.digest
        ? record.digest
        : `${record.digest} then ${secondRecord.digest}`
    ),
    check(
      "authoring-review",
      review.complete ? "passed" : "failed",
      review.complete
        ? `${review.areas.length} guided review areas completed`
        : `${review.areas.filter((area) => area.status === "completed").length}/${review.areas.length} guided review areas completed`
    ),
    check(
      "open-authoring-questions",
      review.questions.open === 0 ? "passed" : "failed",
      review.questions.open === 0
        ? "No open authoring questions"
        : `${review.questions.open} open authoring question(s)`
    ),
    check(
      "lint-advisories",
      lint.diagnostics.length === 0 ? "passed" : "advisory",
      lint.diagnostics.length === 0
        ? "No deterministic authoring advisory"
        : `${lint.counts.review} review, ${lint.counts.recommendation} recommendation, ${lint.counts.information} information`
    )
  ];

  return {
    publish_check_version: PUBLISH_CHECK_FORMAT,
    ready: checks.every(({ status }) => status !== "failed"),
    protocol_release: {
      id: protocolRelease.release_id,
      digest: protocolReleaseDigest
    },
    package: {
      id: record.manifest.id,
      version: record.manifest.version,
      protocol_version: record.manifest.protocol_version,
      digest: record.digest
    },
    checks,
    inspection,
    review: {
      state: review.state,
      complete: review.complete,
      open_questions: review.questions.open
    },
    limitations: [
      "Publish readiness confirms protocol integrity and completed review records; it does not certify package quality.",
      "Lint diagnostics are advisories unless a publisher applies a stricter policy.",
      "No implementation or outcome claim is created by this check."
    ]
  };
}

export function formatPublishCheck(result) {
  const lines = [
    `SeedSpec publish check: ${result.ready ? "READY" : "NOT READY"}`,
    `Package: ${result.package.id}@${result.package.version}`,
    `Digest: ${result.package.digest}`,
    `Protocol release: ${result.protocol_release.id}`,
    ""
  ];
  for (const item of result.checks) {
    lines.push(`[${item.status.toUpperCase()}] ${item.id}: ${item.detail}`);
  }
  lines.push(
    "",
    result.ready
      ? "The package can be packed. Readiness is not a certification of semantic completeness."
      : "Complete the failed checks before packing a distributable archive."
  );
  return lines.join("\n");
}

export async function packPackage(inputPath, {
  outputDirectory,
  stateDirectory,
  toolVersion = "unknown"
} = {}) {
  const record = await validatePackage(inputPath);
  const publishCheck = await publishCheckPackage(inputPath, {
    stateDirectory,
    toolVersion
  });
  if (!publishCheck.ready) {
    throw new SeedSpecError("SeedSpec package is not ready to pack", {
      code: "PACKAGE_NOT_READY_TO_PUBLISH",
      details: publishCheck.checks
        .filter(({ status }) => status === "failed")
        .map(({ id, detail }) => `${id}: ${detail}`)
    });
  }

  const destination = path.resolve(outputDirectory ?? `${record.root}.dist`);
  if (isWithin(record.root, destination)) {
    throw new SeedSpecError("Pack output must remain outside the SeedSpec package", {
      code: "PACK_OUTPUT_INSIDE_PACKAGE",
      details: [`package: ${record.root}`, `output: ${destination}`]
    });
  }
  await mkdir(destination, { recursive: true });

  const baseName = `${record.manifest.id}-${record.manifest.version}`;
  const archiveName = `${baseName}.seedspec.tgz`;
  const archivePath = path.join(destination, archiveName);
  const receiptPath = path.join(destination, `${baseName}.pack-receipt.json`);
  const publishCheckPath = path.join(destination, `${baseName}.publish-check.json`);
  const inspectionPath = path.join(destination, `${baseName}.inspection.json`);
  await assertTargetsDoNotExist([
    archivePath,
    receiptPath,
    publishCheckPath,
    inspectionPath
  ]);
  const topLevel = (await readdir(record.root, { withFileTypes: true }))
    .map(({ name }) => name)
    .sort();
  await tar.create({
    cwd: record.root,
    file: archivePath,
    gzip: { mtime: 0 },
    mtime: new Date(0),
    portable: true,
    prefix: "package",
    sync: false
  }, topLevel);

  const archiveDigest = await computeFileDigest(archivePath);
  const receipt = {
    pack_receipt_version: PACK_RECEIPT_FORMAT,
    protocol_release: {
      id: protocolRelease.release_id,
      digest: protocolReleaseDigest
    },
    producer: {
      name: "@seedspec/runtime",
      version: toolVersion
    },
    package: publishCheck.package,
    archive: {
      path: archiveName,
      digest: archiveDigest,
      format: "tar+gzip",
      root: "package/"
    },
    publish_check: `${baseName}.publish-check.json`,
    inspection: `${baseName}.inspection.json`
  };

  await Promise.all([
    writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" }),
    writeFile(publishCheckPath, `${JSON.stringify(publishCheck, null, 2)}\n`, { encoding: "utf8", flag: "wx" }),
    writeFile(inspectionPath, `${JSON.stringify(publishCheck.inspection, null, 2)}\n`, { encoding: "utf8", flag: "wx" })
  ]);

  return {
    ...receipt,
    output: destination,
    paths: {
      archive: archivePath,
      receipt: receiptPath,
      publish_check: publishCheckPath,
      inspection: inspectionPath
    }
  };
}

export function formatPackResult(result) {
  return [
    `Packed ${result.package.id}@${result.package.version}`,
    `Package digest: ${result.package.digest}`,
    `Archive: ${result.paths.archive}`,
    `Archive digest: ${result.archive.digest}`,
    `Receipt: ${result.paths.receipt}`,
    `Inspection: ${result.paths.inspection}`,
    `Publish check: ${result.paths.publish_check}`
  ].join("\n");
}
