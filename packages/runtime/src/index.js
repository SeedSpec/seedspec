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
export { beginPackage, formatPackageAgentPrompt, formatPackageBeginning } from "./begin.js";
export { discoverFeatures, formatFeatureDiscovery } from "./discovery.js";
export {
  PRODUCTSPEC_ARTIFACT_TYPE,
  formatAdapterListing,
  formatArtifactListing,
  formatArtifactValidation,
  listArtifactAdapters,
  listPackageArtifacts,
  validateArtifact
} from "./artifacts.js";
export { inspectPackage, formatInspection } from "./inspect.js";
export { formatPackageLint, lintPackage } from "./lint.js";
export { initPackage } from "./init.js";
export {
  AUTHORING_AREAS,
  AUTHORING_INSTRUCTION_FORMAT,
  AUTHORING_RESULT_FORMAT,
  AUTHORING_STATE_FORMAT,
  AUTHORING_TARGETS,
  auditPackage,
  formatAuthoringAudit,
  formatAuthoringDocumentation,
  formatAuthoringStarterPrompt,
  formatAuthoringGuidance,
  listAuthoringGuidanceTopics
} from "./authoring.js";
export {
  AUTHORING_OPERATION_FORMAT,
  answerQuestion,
  attachSource,
  recordObservations,
  reviewArea
} from "./authoring/operations.js";
export {
  AUTHORING_SCHEMA_FORMAT,
  listAuthoringSchemas,
  readAuthoringSchema
} from "./authoring-schemas.js";
export {
  AUTHORING_WORKSPACE_OPERATION_FORMAT,
  AUTHORING_WORKSPACE_REVISION_ALGORITHM,
  AUTHORING_WORKSPACE_SNAPSHOT_FORMAT,
  computeWorkspaceRevision,
  createAuthoringWorkspace,
  discoverAuthoringWorkspace,
  formatAuthoringWorkspaceCreation,
  formatAuthoringWorkspaceSnapshot,
  inspectAuthoringWorkspace
} from "./authoring-workspace.js";
export {
  computeDirectoryDigest,
  computeFileDigest,
  computePackageDigest,
  computeSelectedDirectoryDigest
} from "./integrity.js";
export {
  createResolutionReceipt,
  PROTOCOL_OWNED_RESOLUTION_PATHS
} from "./receipts.js";
export {
  createInitialImplementationResourceState,
  formatImplementationResourceListing,
  formatImplementationResourceResolution,
  implementationResourceIndexDigest,
  listPackageImplementationResources,
  materializeImplementationResources,
  reconcileImplementationResourceState,
  recordImplementationResourceUse,
  resolveImplementationResources,
  validateImplementationResourceDeclarations
} from "./resources.js";
export { verifyProjectLock } from "./lock.js";
export {
  completionScopeDigest,
  createInitialVerificationState,
  formatProjectCompletion,
  inspectProjectCompletion,
  resolveCompletionScope
} from "./completion.js";
export {
  analyzeCapabilityDeclarations,
  classifyCapabilityRevision,
  capabilityMatches,
  resolveCapabilityGraph
} from "./capabilities.js";
export {
  capabilityConformanceBinding,
  formatCapabilityConformance,
  inspectCapabilityConformance,
  validateCapabilityConformanceDeclarations
} from "./capability-conformance.js";
export { formatConformanceResult, runConformanceSuite } from "./conformance.js";
export {
  formatInstallationInspection,
  inspectInstallation,
  runBundledConformanceSuite
} from "./doctor.js";
export { resolveProject } from "./resolve.js";
export {
  PREPARATION_FORMAT,
  formatPreparation,
  preparePackage
} from "./preparation.js";
export {
  PACK_RECEIPT_FORMAT,
  PUBLISH_CHECK_FORMAT,
  formatPackResult,
  formatPublishCheck,
  packPackage,
  publishCheckPackage
} from "./publishing.js";
export {
  AUTHOR_EVAL_FORMAT,
  createAuthorEvaluation,
  formatAuthorEvaluation
} from "./evaluation.js";
export { formatUpgrade, upgradePackage } from "./upgrade.js";
export { formatResolvedIntentSummary, resolveAppliedIntent } from "./intent.js";
export { validatePackage } from "./validate.js";
export { materializeTasks, validateTaskRunbook } from "./tasks.js";
