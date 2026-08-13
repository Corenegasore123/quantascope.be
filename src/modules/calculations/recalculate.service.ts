import { prisma } from "../../lib/db.js";
import { overallConfidence } from "../../lib/confidence.js";
import { buildValidationSummary } from "../../lib/validation.js";
import {
  executeRule,
  getRuleById,
  normalizeToMetres,
  type VariableMapping,
} from "@auto-measure/calculation-engine";
import { selectCalculationPlan } from "../../lib/variable-mapper.js";
import { AppError } from "../../shared/errors.js";

export async function archiveRevision(jobId: string, userId: string, label?: string) {
  const job = await prisma.calculationJob.findUnique({
    where: { id: jobId },
    include: {
      variables: true,
      measurements: true,
      steps: { orderBy: { stepOrder: "asc" } },
      result: true,
    },
  });
  if (!job?.result) return;

  await prisma.calculationRevision.upsert({
    where: { jobId_version: { jobId, version: job.version } },
    create: {
      jobId,
      version: job.version,
      label: label ?? `Version ${job.version}`,
      result: job.result.result,
      unit: job.result.unit,
      variables: job.variables as object,
      measurements: job.measurements as object,
      steps: job.steps as object,
      createdById: userId,
    },
    update: {
      label: label ?? `Version ${job.version}`,
      result: job.result.result,
      unit: job.result.unit,
      variables: job.variables as object,
      measurements: job.measurements as object,
      steps: job.steps as object,
    },
  });
}

function variablesToMapping(
  variables: Array<{ name: string; value: number; unit: string; confidence: number; measurementId: string | null }>
): VariableMapping {
  const mapping: VariableMapping["variables"] = {};
  for (const v of variables) {
    mapping[v.name] = {
      value: v.unit === "m" ? v.value : normalizeToMetres(v.value, v.unit),
      unit: "m",
      confidence: v.confidence,
      sourceMeasurementId: v.measurementId ?? "",
    };
  }
  return { variables: mapping, unmappedMeasurements: [], ambiguousMappings: [] };
}

export async function runDeterministicCalculation(jobId: string, userId: string) {
  const job = await prisma.calculationJob.findUnique({
    where: { id: jobId },
    include: { variables: true, measurements: true, result: true },
  });
  if (!job) throw new AppError(404, "Calculation not found");
  if (job.status !== "COMPLETED" && job.status !== "FAILED") {
    throw new AppError(400, "Calculation is not ready for recalculation");
  }

  if (job.result) {
    await archiveRevision(jobId, userId);
  }

  const mapping = variablesToMapping(job.variables);
  const plan = selectCalculationPlan(mapping);

  if (!plan) {
    throw new AppError(
      400,
      "Insufficient variables to perform calculation. Required: external length, width, and depth."
    );
  }

  await prisma.calculationStep.deleteMany({ where: { jobId } });
  if (job.result) {
    await prisma.calculationResult.delete({ where: { jobId } });
  }

  const context: Record<string, number> = {};
  let finalResult = 0;
  let finalUnit = "cum";
  let stepOrder = 0;

  for (const step of plan.steps) {
    const rule = getRuleById(step.ruleId);
    if (!rule) continue;

    const mergedInputs = { ...context, ...step.inputs };
    const result = executeRule(rule, mergedInputs);

    await prisma.calculationStep.create({
      data: {
        jobId,
        stepOrder: stepOrder++,
        ruleId: rule.id,
        ruleName: rule.name,
        formula: rule.formula.expression,
        inputs: mergedInputs,
        result: result.result,
        unit: result.unit,
      },
    });

    if (!Number.isNaN(result.result)) {
      finalResult = result.result;
      finalUnit = result.unit;
    }
  }

  const confidences = job.variables.map((v) => v.confidence);
  const confidence = overallConfidence(confidences);
  const existingValidation = (job.result?.validation as Record<string, unknown>) ?? {};
  const validationSummary = buildValidationSummary(
    job.measurements.map((m) => ({ id: m.id, confidence: m.confidence })),
    (existingValidation.warnings as string[]) ?? []
  );

  await prisma.calculationResult.create({
    data: {
      jobId,
      ruleId: plan.steps[plan.steps.length - 1].ruleId,
      ruleName: "Earthwork Excavation Quantity",
      formula: getRuleById(plan.steps[plan.steps.length - 1].ruleId)?.formula.expression ?? "",
      formulaLatex: getRuleById(plan.steps[plan.steps.length - 1].ruleId)?.formula.latex ?? "",
      result: finalResult,
      unit: finalUnit,
      inputs: mapping.variables as object,
      validation: {
        status: validationSummary.status,
        warnings: [...validationSummary.warnings, "Recalculated from corrected inputs"],
        lowConfidenceIds: validationSummary.lowConfidenceIds,
        provenance: existingValidation.provenance ?? null,
        recalculated: true,
      } as object,
    },
  });

  const nextVersion = job.version + 1;

  await prisma.calculationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      workItem: plan.workItem,
      method: plan.method,
      overallConfidence: confidence,
      version: nextVersion,
      completedAt: new Date(),
      errorMessage: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "calculation.recalculated",
      resource: `job:${jobId}`,
      metadata: { version: nextVersion },
    },
  });

  return { jobId, version: nextVersion, result: finalResult, unit: finalUnit };
}

export async function correctMeasurement(
  jobId: string,
  measurementId: string,
  userId: string,
  value: number,
  unit: string
) {
  const measurement = await prisma.detectedMeasurement.findFirst({
    where: { id: measurementId, jobId },
  });
  if (!measurement) throw new AppError(404, "Measurement not found");

  const normalized = normalizeToMetres(value, unit);
  const rawText = `${value} ${unit}`;

  await prisma.detectedMeasurement.update({
    where: { id: measurementId },
    data: {
      value,
      unit,
      rawText,
      normalizedValue: normalized,
      normalizedUnit: "m",
      userCorrected: true,
      originalValue: measurement.userCorrected ? measurement.originalValue : measurement.value,
      originalUnit: measurement.userCorrected ? measurement.originalUnit : measurement.unit,
      confidence: 1.0,
    },
  });

  await prisma.variable.updateMany({
    where: { jobId, measurementId },
    data: { value: normalized, unit: "m", confidence: 1.0 },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "measurement.corrected",
      resource: `job:${jobId}`,
      metadata: { measurementId, value, unit },
    },
  });

  return runDeterministicCalculation(jobId, userId);
}

export async function correctVariable(
  jobId: string,
  variableName: string,
  userId: string,
  value: number,
  unit: string
) {
  const variable = await prisma.variable.findFirst({
    where: { jobId, name: variableName },
  });
  if (!variable) throw new AppError(404, "Variable not found");

  const normalized = normalizeToMetres(value, unit);

  await prisma.variable.update({
    where: { id: variable.id },
    data: { value: normalized, unit: "m", confidence: 1.0 },
  });

  if (variable.measurementId) {
    const measurement = await prisma.detectedMeasurement.findUnique({
      where: { id: variable.measurementId },
    });
    await prisma.detectedMeasurement.update({
      where: { id: variable.measurementId },
      data: {
        value,
        unit,
        rawText: `${value} ${unit}`,
        normalizedValue: normalized,
        userCorrected: true,
        originalValue: measurement?.userCorrected ? measurement.originalValue : measurement?.value,
        originalUnit: measurement?.userCorrected ? measurement.originalUnit : measurement?.unit,
        confidence: 1.0,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: "variable.corrected",
      resource: `job:${jobId}`,
      metadata: { variableName, value, unit },
    },
  });

  return runDeterministicCalculation(jobId, userId);
}

export async function createScenario(
  parentJobId: string,
  userId: string,
  scenarioName: string,
  overrides: Record<string, { value: number; unit?: string }>
) {
  const parent = await prisma.calculationJob.findUnique({
    where: { id: parentJobId },
    include: { variables: true, measurements: true },
  });
  if (!parent) throw new AppError(404, "Calculation not found");
  if (parent.status !== "COMPLETED") {
    throw new AppError(400, "Only completed calculations can be used for scenarios");
  }

  const newJob = await prisma.calculationJob.create({
    data: {
      imageId: parent.imageId,
      userId,
      projectId: parent.projectId,
      parentJobId: parent.id,
      scenarioName,
      status: "CALCULATING",
      version: 1,
      methodologyVersion: parent.methodologyVersion,
    },
  });

  for (const m of parent.measurements) {
    await prisma.detectedMeasurement.create({
      data: {
        id: crypto.randomUUID(),
        jobId: newJob.id,
        value: m.value,
        unit: m.unit,
        rawText: m.rawText,
        confidence: m.confidence,
        boundingBox: m.boundingBox as object,
        label: m.label,
        normalizedValue: m.normalizedValue,
        normalizedUnit: m.normalizedUnit,
        userCorrected: m.userCorrected,
        originalValue: m.originalValue,
        originalUnit: m.originalUnit,
      },
    });
  }

  for (const v of parent.variables) {
    const override = overrides[v.name];
    const value = override ? normalizeToMetres(override.value, override.unit ?? "m") : v.value;
    const unit = "m";
    await prisma.variable.create({
      data: {
        jobId: newJob.id,
        name: v.name,
        value,
        unit,
        confidence: override ? 1.0 : v.confidence,
        measurementId: null,
      },
    });
  }

  await runDeterministicCalculation(newJob.id, userId);

  await prisma.auditLog.create({
    data: {
      userId,
      action: "scenario.created",
      resource: `job:${parentJobId}`,
      metadata: { scenarioJobId: newJob.id, scenarioName },
    },
  });

  return newJob.id;
}
