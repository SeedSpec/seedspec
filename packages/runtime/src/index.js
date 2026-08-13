import { readFileSync } from "node:fs";

export const runtimeVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
).version;

export {
  conformanceSuiteVersion,
  protocolPackageVersion,
  protocolRelease,
  protocolReleaseDigest,
  protocolVersion
} from "@seedspec/protocol";
export { SeedSpecError, formatError } from "./errors.js";
export { computePackageDigest } from "./integrity.js";
export { inspectPackage, formatInspection } from "./inspect.js";
export { flattenManifest, parseSpecSource } from "./manifest.js";
export {
  formatConformanceResult,
  runBundledConformanceSuite,
  runConformanceSuite
} from "./conformance.js";
export { validatePackage } from "./validate.js";
export {
  TRUSTED_EVIDENCE_RUNNERS,
  checkPackage,
  coverageFromInspection,
  evidenceFromEvaluation,
  formatCheck,
  loadEvidenceFile,
  parseEvidenceDocument,
  runEvaluator,
  verifyEvidence
} from "./check.js";
export {
  createLock,
  formatLock,
  formatLockVerification,
  getPackage,
  verifyLock,
  writeLock
} from "./lock.js";
export { startPreviewServer } from "./preview.js";
export { initPackage, renderInitSpec, slugIdentifier } from "./init.js";
export {
  DEFAULT_PROJECT_FILE,
  PROJECT_FILE_VERSION,
  applyProjectUpdates,
  emptyProject,
  formatProject,
  loadOrCreateProject,
  loadProject,
  parseProjectDocument,
  resolveProjectFile,
  saveProject,
  validateProject
} from "./project.js";
