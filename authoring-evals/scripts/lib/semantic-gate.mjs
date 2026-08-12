export function semanticGate(grade) {
  if (!grade || typeof grade !== "object" || !Array.isArray(grade.reference_assessments)) {
    throw new Error("Semantic gate requires a semantic grade with reference assessments");
  }
  const eligible = grade.reference_assessments.filter(({ level }) => (
    level === "critical" || level === "material"
  ));
  const divergent = eligible.filter(({ alignment }) => alignment === "divergent");
  const critical = divergent.filter(({ level }) => level === "critical");
  const material = divergent.filter(({ level }) => level === "material");
  const variabilityRespected = grade.reference_assessments.every((assessment) => (
    assessment.permitted_variability_respected === true
  ));
  return {
    passed: eligible.length > 0 && divergent.length === 0 && variabilityRespected,
    basis: "frozen-reference-axes",
    eligible_axis_count: eligible.length,
    divergent_axes: divergent.map(({ axis_id: axisId }) => axisId),
    critical_divergences: critical.map(({ axis_id: axisId }) => axisId),
    material_divergences: material.map(({ axis_id: axisId }) => axisId),
    permitted_variability_respected: variabilityRespected,
    lexical_matching_used: false
  };
}
