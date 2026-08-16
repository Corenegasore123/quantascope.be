import type {
  CalculationJob,
  CalculationResult,
  CalculationRevision,
  CalculationStep,
  DetectedMeasurement,
  Image,
  Prisma,
  Variable,
} from "@prisma/client";
import { prisma } from "./db.js";

export const REPORT_TEMPLATES = ["full", "summary", "audit", "client"] as const;
export type ReportTemplate = (typeof REPORT_TEMPLATES)[number];

export type JobForReport = CalculationJob & {
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

export const jobReportInclude = {
  image: true,
  measurements: true,
  variables: true,
  steps: { orderBy: { stepOrder: "asc" as const } },
  result: true,
  revisions: { orderBy: { version: "desc" as const } },
  scenarios: {
    include: { result: { select: { result: true, unit: true } } },
  },
  parentJob: { select: { id: true, scenarioName: true, version: true } },
} satisfies Prisma.CalculationJobInclude;

export async function loadJobForReport(jobId: string): Promise<JobForReport | null> {
  return prisma.calculationJob.findUnique({
    where: { id: jobId },
    include: jobReportInclude,
  });
}

export function parseReportTemplate(value: string | undefined): ReportTemplate {
  if (value && REPORT_TEMPLATES.includes(value as ReportTemplate)) {
    return value as ReportTemplate;
  }
  return "full";
}

export type CalculationReport = ReturnType<typeof buildCalculationReport>;

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

export function applyReportTemplate(
  report: CalculationReport,
  template: ReportTemplate
): CalculationReport | Record<string, unknown> {
  if (template === "full" || template === "audit") return report;

  if (template === "summary") {
    return {
      metadata: {
        filename: report.image.filename,
        timestamp: report.metadata.timestamp,
        status: report.metadata.status,
        method: report.metadata.method,
        version: report.metadata.version,
      },
      result: report.calculation.result
        ? {
            value: report.calculation.result.result,
            unit: report.calculation.result.unit,
            formula: report.calculation.result.formula,
          }
        : null,
      confidence: report.confidence,
      validationStatus: (report.validation as { status?: string })?.status ?? null,
    };
  }

  // client — professional deliverable without internal IDs
  return {
    document: report.image.filename,
    date: new Date(report.metadata.timestamp as Date).toISOString(),
    workItem: report.metadata.workItem?.replace(/_/g, " ") ?? null,
    method: report.metadata.method?.replace(/_/g, " ") ?? null,
    quantity: report.calculation.result?.result ?? null,
    unit: report.calculation.result?.unit ?? null,
    formula: report.calculation.result?.formula ?? null,
    confidence: report.confidence
      ? `${(report.confidence * 100).toFixed(0)}%`
      : null,
    correctionsApplied: report.corrections.length,
    preparedBy: "QuantScope",
  };
}

export interface ComparisonRow {
  id: string;
  label: string;
  type: "baseline" | "scenario" | "version";
  version?: number;
  result: number | null;
  unit: string | null;
  delta: number | null;
  deltaPercent: number | null;
}

export function buildComparisonView(full: JobForReport) {
  const report = buildCalculationReport(full);
  const baselineResult = report.calculation.result?.result ?? null;
  const baselineUnit = report.calculation.result?.unit ?? null;

  const row = (
    id: string,
    label: string,
    type: ComparisonRow["type"],
    result: number | null,
    unit: string | null,
    version?: number
  ): ComparisonRow => {
    const delta =
      baselineResult !== null && result !== null && unit === baselineUnit
        ? result - baselineResult
        : null;
    const deltaPercent =
      delta !== null && baselineResult !== null && baselineResult !== 0
        ? (delta / baselineResult) * 100
        : null;
    return { id, label, type, version, result, unit, delta, deltaPercent };
  };

  const baseline = row(
    full.id,
    full.scenarioName ?? "Current",
    "baseline",
    baselineResult,
    baselineUnit,
    full.version
  );

  const scenarios = (full.scenarios ?? []).map((s) =>
    row(
      s.id,
      s.scenarioName ?? "Scenario",
      "scenario",
      s.result?.result ?? null,
      s.result?.unit ?? null,
      s.version
    )
  );

  const versions = (full.revisions ?? []).map((r) =>
    row(r.id, r.label ?? `Version ${r.version}`, "version", r.result, r.unit, r.version)
  );

  return {
    baseline,
    scenarios,
    versions,
    variables: report.variables.map((v) => ({
      name: v.name,
      value: v.value,
      unit: v.unit,
    })),
  };
}

export function reportPdfSections(
  report: CalculationReport,
  template: ReportTemplate = "full"
) {
  const effective = template === "client" ? applyReportTemplate(report, "client") : report;
  if (template === "client") {
    const c = effective as Record<string, unknown>;
    return [
      {
        heading: "Quantity Report",
        lines: [
          `Document: ${c.document}`,
          `Date: ${c.date}`,
          c.workItem ? `Work item: ${c.workItem}` : "",
          c.method ? `Method: ${c.method}` : "",
          `Quantity: ${c.quantity} ${c.unit}`,
          c.formula ? `Formula: ${c.formula}` : "",
          c.confidence ? `Confidence: ${c.confidence}` : "",
          c.correctionsApplied ? `Manual corrections: ${c.correctionsApplied}` : "",
        ].filter(Boolean) as string[],
      },
    ];
  }

  if (template === "summary") {
    const s = effective as ReturnType<typeof applyReportTemplate> & {
      result?: { value: number; unit: string; formula: string } | null;
    };
    return [
      {
        heading: "Summary",
        lines: [
          `File: ${(s as { metadata?: { filename?: string } }).metadata?.filename ?? report.image.filename}`,
          `Status: ${report.metadata.status}`,
          `Version: ${report.metadata.version}`,
          report.metadata.scenarioName ? `Scenario: ${report.metadata.scenarioName}` : "",
          s.result
            ? `Result: ${s.result.value} ${s.result.unit}`
            : "No result",
          s.result?.formula ? `Formula: ${s.result.formula}` : "",
          report.confidence
            ? `Confidence: ${(report.confidence * 100).toFixed(0)}%`
            : "",
        ].filter(Boolean),
      },
    ];
  }

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

  if (template === "audit" || report.corrections.length > 0) {
    if (report.corrections.length > 0) {
      sections.push({
        heading: "Manual Corrections",
        lines: report.corrections.map(
          (c) =>
            `${c.rawText}: ${c.originalValue ?? "?"} ${c.originalUnit ?? ""} → ${c.correctedValue} ${c.correctedUnit}`
        ),
      });
    }
  }

  if (template !== "audit") {
    sections.push({
      heading: "Detected Measurements",
      lines: report.measurements.map(
        (m) =>
          `${m.rawText}: ${m.value} ${m.unit} (${(m.confidence * 100).toFixed(0)}%)${m.userCorrected ? " [corrected]" : ""}`
      ),
    });
  }

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

  if (template === "audit" && report.provenance) {
    const p = report.provenance as Record<string, unknown>;
    sections.push({
      heading: "OCR Provenance",
      lines: [
        `Provider: ${p.provider ?? "—"}`,
        `Pipeline: ${p.pipelineVersion ?? "—"}`,
        p.fallbackUsed ? "Aggressive preprocessing used" : "Standard preprocessing",
      ],
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

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function reportCsvContent(
  report: CalculationReport,
  template: ReportTemplate = "full"
): string {
  if (template === "client") {
    const c = applyReportTemplate(report, "client") as Record<string, unknown>;
    const rows = Object.entries(c).map(([k, v]) => [k, csvEscape(v as string)]);
    return rows.map((r) => r.join(",")).join("\n");
  }

  if (template === "summary") {
    const rows: (string | number)[][] = [
      ["File", report.image.filename],
      ["Version", report.metadata.version],
      ["Status", report.metadata.status],
      ["Timestamp", new Date(report.metadata.timestamp as Date).toISOString()],
      [],
      ["Result", report.calculation.result?.result ?? ""],
      ["Unit", report.calculation.result?.unit ?? ""],
      ["Formula", report.calculation.result?.formula ?? ""],
      ["Confidence", report.confidence ?? ""],
    ];
    return rows.map((r) => r.map((c) => csvEscape(c)).join(",")).join("\n");
  }

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

  return rows.map((r) => r.map((c) => csvEscape(c)).join(",")).join("\n");
}

export function reportBatchCsvContent(
  reports: CalculationReport[],
  template: ReportTemplate = "summary"
): string {
  if (template === "client") {
    const header = ["document", "date", "workItem", "method", "quantity", "unit", "confidence"];
    const rows = reports.map((r) => {
      const c = applyReportTemplate(r, "client") as Record<string, unknown>;
      return header.map((h) => csvEscape(c[h] as string));
    });
    return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  const header = [
    "jobId",
    "filename",
    "version",
    "status",
    "method",
    "result",
    "unit",
    "confidence",
    "needsReview",
    "corrections",
  ];
  const rows = reports.map((r) => [
    r.metadata.jobId,
    r.image.filename,
    r.metadata.version,
    r.metadata.status,
    r.metadata.method ?? "",
    r.calculation.result?.result ?? "",
    r.calculation.result?.unit ?? "",
    r.confidence ?? "",
    (r.validation as { status?: string })?.status === "needs_review" ? "yes" : "no",
    r.corrections.length,
  ]);
  return [header.join(","), ...rows.map((r) => r.map((c) => csvEscape(c)).join(","))].join("\n");
}

export function reportComparisonCsvContent(comparison: ReturnType<typeof buildComparisonView>): string {
  const header = ["label", "type", "version", "result", "unit", "delta", "deltaPercent"];
  const allRows = [comparison.baseline, ...comparison.scenarios, ...comparison.versions];
  const rows = allRows.map((r) => [
    r.label,
    r.type,
    r.version ?? "",
    r.result ?? "",
    r.unit ?? "",
    r.delta ?? "",
    r.deltaPercent !== null ? `${r.deltaPercent.toFixed(1)}%` : "",
  ]);
  return [header.join(","), ...rows.map((r) => r.map((c) => csvEscape(c)).join(","))].join("\n");
}
