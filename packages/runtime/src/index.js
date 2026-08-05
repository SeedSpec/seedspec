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
export {
  discoverFeatures,
  discoverProviders,
  formatFeatureDiscovery,
  formatProviderDiscovery
} from "./discovery.js";
export {
  formatArtifactListing,
  listPackageArtifacts
} from "./artifacts.js";
export {
  ADAPTER_API_VERSION,
  AdapterRegistry,
  createAdapterRegistry,
  formatAdapterListing
} from "./adapters.js";
export {
  discoverFormatIntegrations,
  formatIntegrationDiscovery,
  loadIntegrationAdapter,
  readIntegrationDescriptor
} from "./integrations.js";
export {
  applyIntegrationBridgePlan,
  formatIntegrationBridgePlan,
  planIntegrationBridges
} from "./integration-authoring.js";
export {
  applySkillImportPlan,
  formatSkillImportPlan,
  planSkillImport
} from "./skill-import.js";
export {
  formatContextValidation,
  validateContextModule
} from "./context-validation.js";
export {
  contextApplies,
  formatContextPreparation,
  prepareContext,
  recordContextUse
} from "./context-preparation.js";
export { inspectPackage, formatInspection } from "./inspect.js";
export { formatPackageLint, lintPackage } from "./lint.js";
export { buildSearchCorpus } from "./search-corpus.js";
export {
  createSearchIndex,
  extractMarkdownSections,
  readSearchSection,
  searchIndex,
  tokenizeSearchText
} from "./search.js";
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
  QUESTION_RESOLUTIONS,
  isResolvedQuestion
} from "./authoring/core/entries.js";
export {
  AUTHORING_CANDIDATE_AFFECTED_CONCERNS,
  AUTHORING_CANDIDATE_DECISIONS,
  AUTHORING_CANDIDATE_FORMAT,
  AUTHORING_CANDIDATE_KINDS,
  AUTHORING_CANDIDATE_MATERIALITY,
  AUTHORING_CANDIDATE_RECOMMENDATIONS,
  AUTHORING_CANDIDATE_STATUSES
} from "./authoring/core/candidates.js";
export {
  AUTHORING_PROBE_BRIEF_FORMAT,
  AUTHORING_PROBE_INSTRUCTION_ID,
  AUTHORING_PROBE_INSTRUCTION_VERSION,
  AUTHORING_PROBE_RESULT_FORMAT,
  AUTHORING_PROBE_RUN_FORMAT,
  clarificationProbeInstructions,
  clarificationProbeResultSchema,
  clarificationProbeTransportSchema,
  validateClarificationProbeResult,
  validateProbePreparationInput
} from "./authoring/core/probes.js";
export {
  AUTHORING_CHANGE_BASIS_KINDS,
  AUTHORING_CHANGE_DECISIONS,
  AUTHORING_CHANGE_PROPOSAL_FORMAT,
  AUTHORING_CHANGE_STATUSES
} from "./authoring/core/proposals.js";
export {
  AUTHORING_OPERATION_FORMAT,
  applyDocumentChange,
  answerQuestion,
  attachSource,
  decideClarificationCandidate,
  decideDocumentChange,
  proposeDocumentChange,
  recordClarificationCandidate,
  recordObservations,
  reviewArea
} from "./authoring/operations.js";
export {
  authoringWorkspaceLockPath,
  withAuthoringWorkspaceMutationLock
} from "./authoring/lock.js";
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
  AUTHORING_PROBE_EXECUTION_FORMAT,
  formatClarificationProbePreflight,
  formatClarificationProbePreparation,
  prepareClarificationProbe,
  recordClarificationProbeRun,
  verifyClarificationProbe
} from "./authoring-probes.js";
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
  readBundledResource,
  formatBundledResource,
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
