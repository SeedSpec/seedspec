const planningComponents = new Set([
  "compatibility",
  "deployment",
  "maintenance",
  "migration",
  "reference",
  "security"
]);

export function componentReview(name) {
  if (planningComponents.has(name)) return "before-planning";
  if (name === "acceptance" || name === "evals") return "before-completion-claim";
  if (name === "integration") return "before-integration";
  return "when-relevant";
}

export function artifactReview(artifact) {
  const concerns = new Set(artifact.concerns ?? []);
  if (
    concerns.has("org.seedspec.concern.design")
    || concerns.has("org.seedspec.concern.infrastructure")
  ) return "before-planning";
  if (concerns.has("org.seedspec.concern.execution")) return "before-activation";
  if (concerns.has("org.seedspec.concern.evidence")) return "before-completion-claim";
  return "when-relevant";
}
