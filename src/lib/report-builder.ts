import type {
  CalculationJob,
  CalculationResult,
  CalculationRevision,
  CalculationStep,
  DetectedMeasurement,
  Image,
  Variable,
} from "@prisma/client";

type JobForReport = CalculationJob & {
  image: Image;
  measurements: DetectedMeasurement[];
  variables: Variable[];
  steps: CalculationStep[];
  result: CalculationResult | null;
  revisions?: CalculationRevision[];
  scenarios?: Array<
    CalculationJob & { result: { result: number; unit: string } | null }
  >;
  parentJob?: { id: string; scenarioName: string | null; version: number } | null;
};

export function buildCalculationReport(full: JobForReport) {
  const validation = (full.result?.validation as Record<string, unknown>) ?? {};
  const corrected = full.measurements.filter((m) => m.userCorrected);

  return {
    metadata: {
      jobId: full.id,
      version: full.version,
      scenarioName: full.scenarioName,
      parentJobId: full.parentJobId,
      timestamp: full.completedAt ?? full.createdAt,
      softwareVersion: full.softwareVersion,
      methodologyVersion: full.methodologyVersion,
      status: full.status,
      workItem: full.workItem,
      method: full.method,
    },
    image: { filename: full.image.filename, mimeType: full.image.mimeType },
    measurements: full.measurements.map((m) => ({
      id: m.id,
      rawText: m.rawText,
      value: m.value,
      unit: m.unit,
      confidence: m.confidence,
      userCorrected: m.userCorrected,
      originalValue: m.originalValue,
      originalUnit: m.originalUnit,
      label: m.label,
    })),
    corrections: corrected.map((m) => ({
      id: m.id,
      rawText: m.rawText,
      correctedValue: m.value,
      correctedUnit: m.unit,
      originalValue: m.originalValue,
      originalUnit: m.originalUnit,
    })),
    variables: full.variables,
    calculation: {
      steps: full.steps,
      result: full.result,
    },
    confidence: full.overallConfidence,
    validation,
    provenance: validation.provenance ?? null,
    versionHistory: (full.revisions ?? []).map((r) => ({
      version: r.version,
      label: r.label,
      result: r.result,
      unit: r.unit,
      createdAt: r.createdAt,
    })),
    scenarios: (full.scenarios ?? []).map((s) => ({
      id: s.id,
      name: s.scenarioName,
      result: s.result?.result,
      unit: s.result?.unit,
    })),
    parentJob: full.parentJob,
  };
}

export function reportPdfSections(report: ReturnType<typeof buildCalculationReport>) {
  const sections: Array<{ heading: string; lines: string[] }> = [
    {
      heading: "Metadata",
      lines: [
        `Job ID: ${report.metadata.jobId}`,
        `Version: ${report.metadata.version}`,
        report.metadata.scenarioName ? `Scenario: ${report.metadata.scenarioName}` : "",
        `Status: ${report.metadata.status}`,
        `Method: ${report.metadata.method ?? "—"}`,
        `Software: ${report.metadata.softwareVersion}`,
        `Methodology: ${report.metadata.methodologyVersion}`,
        `Timestamp: ${new Date(report.metadata.timestamp as Date).toISOString()}`,
      ].filter(Boolean),
    },
  ];

  if (report.corrections.length > 0) {
    sections.push({
      heading: "Manual Corrections",
      lines: report.corrections.map(
        (c) =>
          `${c.rawText}: ${c.originalValue ?? "?"} ${c.originalUnit ?? ""} → ${c.correctedValue} ${c.correctedUnit}`
      ),
    });
  }

  sections.push({
    heading: "Detected Measurements",
    lines: report.measurements.map(
      (m) =>
        `${m.rawText}: ${m.value} ${m.unit} (${(m.confidence * 100).toFixed(0)}%)${m.userCorrected ? " [corrected]" : ""}`
    ),
  });

  sections.push({
    heading: "Variables",
    lines: report.variables.map(
      (v) => `${v.name}: ${v.value} ${v.unit} (${(v.confidence * 100).toFixed(0)}%)`
    ),
  });

  sections.push({
    heading: "Calculation Steps",
    lines: report.calculation.steps.map(
      (s) => `${s.stepOrder + 1}. ${s.ruleName}: ${s.formula} => ${s.result} ${s.unit}`
    ),
  });

  sections.push({
    heading: "Final Result",
    lines: report.calculation.result
      ? [
          `${report.calculation.result.result} ${report.calculation.result.unit}`,
          `Formula: ${report.calculation.result.formula}`,
        ]
      : ["No result available"],
  });

  if (report.versionHistory.length > 0) {
    sections.push({
      heading: "Version History",
      lines: report.versionHistory.map(
        (v) => `v${v.version}: ${v.result} ${v.unit} — ${v.label ?? ""}`
      ),
    });
  }

  if (report.scenarios.length > 0) {
    sections.push({
      heading: "What-if Scenarios",
      lines: report.scenarios.map(
        (s) => `${s.name ?? "Scenario"}: ${s.result ?? "—"} ${s.unit ?? ""}`
      ),
    });
  }

  if (report.validation && typeof report.validation === "object") {
    const warnings = (report.validation as { warnings?: string[] }).warnings;
    if (warnings?.length) {
      sections.push({ heading: "Warnings", lines: warnings });
    }
  }

  return sections;
}

export function reportCsvContent(report: ReturnType<typeof buildCalculationReport>): string {
  const rows: (string | number)[][] = [
    ["QuantScope Calculation Report"],
    ["Job ID", report.metadata.jobId],
    ["Version", report.metadata.version],
    ["Timestamp", new Date(report.metadata.timestamp as Date).toISOString()],
    [],
    ["Variable", "Value", "Unit", "Confidence"],
    ...report.variables.map((v) => [v.name, v.value, v.unit, v.confidence]),
    [],
    ["Measurement", "Value", "Unit", "Confidence", "Corrected"],
    ...report.measurements.map((m) => [
      m.rawText,
      m.value,
      m.unit,
      m.confidence,
      m.userCorrected ? "yes" : "no",
    ]),
    [],
    ["Step", "Rule", "Result", "Unit"],
    ...report.calculation.steps.map((s) => [s.stepOrder + 1, s.ruleName, s.result, s.unit]),
    [],
    ["Final Result", report.calculation.result?.result ?? "", report.calculation.result?.unit ?? ""],
  ];

  if (report.corrections.length > 0) {
    rows.push([], ["Correction", "Original", "Corrected"]);
    for (const c of report.corrections) {
      rows.push([
        c.rawText,
        `${c.originalValue ?? ""} ${c.originalUnit ?? ""}`,
        `${c.correctedValue} ${c.correctedUnit}`,
      ]);
    }
  }

  if (report.versionHistory.length > 0) {
    rows.push([], ["Version", "Result", "Unit", "Label"]);
    for (const v of report.versionHistory) {
      rows.push([v.version, v.result, v.unit, v.label ?? ""]);
    }
  }

  return rows.map((r) => r.join(",")).join("\n");
}
