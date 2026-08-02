// The workspace revision, finally given a consumer.
//
// `revisionDigest` has existed in authoring-workspace.js since the beginning and
// was only ever reported, never checked. Decision 0013 promises that mutations
// require an expected workspace revision and fail on concurrent modification;
// this is the value those operations compare.
//
// It deliberately re-exports rather than recomputing. An operation must compare
// against the exact value `author status` hands out, and a second
// implementation of the same digest would break that agreement silently.

export { computeWorkspaceRevision as computeAuthoringRevision } from "../authoring-workspace.js";
