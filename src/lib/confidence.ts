export function getConfidenceThresholds() {
  return {
    autoAccept: parseFloat(process.env.CONFIDENCE_AUTO_ACCEPT ?? "0.95"),
    flag: parseFloat(process.env.CONFIDENCE_FLAG ?? "0.80"),
  };
}

export function overallConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  return confidences.reduce((a, b) => a + b, 0) / confidences.length;
}
