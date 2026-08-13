import { prisma } from "./db.js";
import { getStorage } from "../infrastructure/storage/local.storage.js";
import { publishJobStatus } from "../queues/job-events.js";
import { enqueueAnalysisJob } from "../queues/enqueue.js";
import { overallConfidence } from "./confidence.js";
import {
  executeRule,
  getRuleById,
  normalizeToMetres,
  type MappedVariable,
} from "@auto-measure/calculation-engine";
import {
  mapMeasurementsToVariables,
  selectCalculationPlan,
  type RawMeasurement,
} from "./variable-mapper.js";

const CV_SERVICE_URL = process.env.CV_SERVICE_URL ?? "http://localhost:8000";

interface CVMeasurement {
  id: string;
  value: number;
  unit: string;
  raw_text: string;
  confidence: number;
  bounding_box: { x: number; y: number; width: number; height: number };
  label?: string | null;
}

interface CVResponse {
  measurements: CVMeasurement[];
  warnings: string[];
}

async function updateDocumentStatus(imageId: string, status: string) {
  await prisma.image.update({
    where: { id: imageId },
    data: { status: status as never },
  });
}

async function updateStatus(jobId: string, status: string, message?: string) {
  await prisma.calculationJob.update({
    where: { id: jobId },
    data: { status: status as never },
  });
  await publishJobStatus(jobId, {
    status,
    message,
    at: new Date().toISOString(),
  });
}

async function failJob(jobId: string, imageId: string, errorMessage: string) {
  await updateDocumentStatus(imageId, "FAILED");
  await prisma.calculationJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorMessage },
  });
  await publishJobStatus(jobId, {
    status: "FAILED",
    message: errorMessage,
    at: new Date().toISOString(),
  });
}

async function callCVService(imageBuffer: Buffer, filename: string, imageId: string): Promise<CVResponse> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)]);
  formData.append("file", blob, filename);

  const response = await fetch(`${CV_SERVICE_URL}/process?image_id=${imageId}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CV service error: ${response.status} ${text}`);
  }

  return response.json() as Promise<CVResponse>;
}

export async function processCalculationJob(jobId: string): Promise<void> {
  try {
    const job = await prisma.calculationJob.findUnique({
      where: { id: jobId },
      include: { image: true },
    });
    if (!job) throw new Error("Job not found");

    await updateDocumentStatus(job.imageId, "PROCESSING");
    await updateStatus(jobId, "PROCESSING_IMAGE");

    const { readStoredFile } = await import("./storage.js");
    const imageBuffer = await readStoredFile(job.image.storagePath);

    await updateStatus(jobId, "EXTRACTING_MEASUREMENTS");
    let cvResult: CVResponse;

    try {
      cvResult = await callCVService(imageBuffer, job.image.filename, job.imageId);
    } catch (err) {
      if (process.env.CV_OCR_PROVIDER === "mock" || process.env.ALLOW_MOCK_CV === "true") {
        cvResult = { measurements: [], warnings: ["CV service unavailable, using empty result"] };
      } else {
        throw new Error(`Unable to process image: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    if (cvResult.measurements.length === 0) {
      await failJob(jobId, job.imageId, "No measurements detected in the uploaded image");
      return;
    }

    const rawMeasurements: RawMeasurement[] = cvResult.measurements.map((m) => ({
      id: m.id,
      value: m.value,
      unit: m.unit,
      rawText: m.raw_text,
      confidence: m.confidence,
      boundingBox: m.bounding_box,
      label: m.label ?? undefined,
    }));

    for (const m of rawMeasurements) {
      await prisma.detectedMeasurement.create({
        data: {
          id: m.id,
          jobId,
          value: m.value,
          unit: m.unit,
          rawText: m.rawText,
          confidence: m.confidence,
          boundingBox: m.boundingBox,
          label: m.label,
          normalizedValue: normalizeToMetres(m.value, m.unit),
          normalizedUnit: "m",
        },
      });
    }

    await updateStatus(jobId, "INTERPRETING_DIAGRAM");
    const mapping = mapMeasurementsToVariables(rawMeasurements);

    for (const [name, variable] of Object.entries(mapping.variables) as Array<
      [string, MappedVariable]
    >) {
      await prisma.variable.create({
        data: {
          jobId,
          name,
          value: variable.value,
          unit: variable.unit,
          confidence: variable.confidence,
          measurementId: variable.sourceMeasurementId,
        },
      });
    }

    await updateStatus(jobId, "VALIDATING");
    const plan = selectCalculationPlan(mapping);

    if (!plan) {
      await failJob(
        jobId,
        job.imageId,
        "Insufficient measurements to perform calculation. Required: external length, width, and depth."
      );
      return;
    }

    await updateStatus(jobId, "CALCULATING");
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

    const confidences = rawMeasurements.map((m) => m.confidence);
    const confidence = overallConfidence(confidences);

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
        validation: { status: "valid", warnings: cvResult.warnings },
      },
    });

    await prisma.calculationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        workItem: plan.workItem,
        method: plan.method,
        overallConfidence: confidence,
        completedAt: new Date(),
      },
    });

    await updateDocumentStatus(job.imageId, "PROCESSED");
    await publishJobStatus(jobId, {
      status: "COMPLETED",
      at: new Date().toISOString(),
    });
  } catch (error) {
    const job = await prisma.calculationJob.findUnique({ where: { id: jobId } });
    const msg = error instanceof Error ? error.message : "Processing failed";
    if (job) {
      await failJob(jobId, job.imageId, msg);
    } else {
      await prisma.calculationJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errorMessage: msg },
      });
      await publishJobStatus(jobId, {
        status: "FAILED",
        message: msg,
        at: new Date().toISOString(),
      });
    }
  }
}

export async function createCalculationFromUpload(
  filename: string,
  mimeType: string,
  buffer: Buffer,
  context: { userId: string; projectId?: string; existingImageId?: string }
): Promise<string> {
  const storage = getStorage();
  let imageId: string;

  if (context.existingImageId) {
    imageId = context.existingImageId;
    await prisma.image.update({
      where: { id: imageId },
      data: { status: "UPLOADED" },
    });
  } else {
    imageId = crypto.randomUUID();
    const storagePath = await storage.save("images", `${imageId}-${filename}`, buffer);

    await prisma.image.create({
      data: {
        id: imageId,
        filename,
        mimeType,
        sizeBytes: buffer.length,
        storagePath,
        status: "UPLOADED",
        uploadedById: context.userId,
        projectId: context.projectId,
      },
    });
  }

  const job = await prisma.calculationJob.create({
    data: {
      imageId,
      userId: context.userId,
      projectId: context.projectId,
      status: "UPLOADING",
    },
  });

  if (context.projectId) {
    await prisma.project.update({
      where: { id: context.projectId },
      data: { updatedAt: new Date() },
    });
  }

  await enqueueAnalysisJob(job.id);
  return job.id;
}
