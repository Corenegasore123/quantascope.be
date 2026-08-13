import { getConfidenceThresholds } from "./confidence.js";

export type ConfidenceClass = "accepted" | "flagged" | "review";

export function classifyConfidence(confidence: number): ConfidenceClass {
  const { autoAccept, flag } = getConfidenceThresholds();
  if (confidence >= autoAccept) return "accepted";
  if (confidence >= flag) return "flagged";
  return "review";
}

export function buildValidationSummary(
  measurements: Array<{ id: string; confidence: number }>,
  cvWarnings: string[]
) {
  const thresholds = getConfidenceThresholds();
  const lowConfidence = measurements.filter((m) => m.confidence < thresholds.flag);
  const needsReview = measurements.some((m) => m.confidence < thresholds.autoAccept);

  const warnings = [...cvWarnings];
  if (lowConfidence.length > 0) {
    warnings.push(
      `${lowConfidence.length} measurement(s) have low confidence — please verify before relying on results`
    );
  }

  return {
    status: needsReview ? ("needs_review" as const) : ("valid" as const),
    warnings,
    lowConfidenceIds: lowConfidence.map((m) => m.id),
    thresholds,
  };
}
