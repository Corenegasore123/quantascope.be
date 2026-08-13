import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/db.js";
import { createCalculationFromUpload } from "../lib/pipeline.js";
import { readStoredFile, saveFile } from "../lib/storage.js";
import { generateTextPdf } from "../lib/pdf-report.js";

const router = Router();

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "20", 10) * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

router.get("/", async (_req, res) => {
  const jobs = await prisma.calculationJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      image: { select: { filename: true } },
      result: { select: { result: true, unit: true } },
    },
  });
  res.json(jobs);
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    if (!ALLOWED_TYPES.has(file.mimetype)) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    const jobId = await createCalculationFromUpload(
      file.originalname,
      file.mimetype,
      file.buffer
    );

    res.status(201).json({ jobId, status: "UPLOADING" });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Upload failed",
    });
  }
});

router.get("/:id", async (req, res) => {
  const job = await prisma.calculationJob.findUnique({
    where: { id: req.params.id },
    include: {
      image: true,
      measurements: true,
      variables: { include: { measurement: true } },
      steps: { orderBy: { stepOrder: "asc" } },
      result: true,
    },
  });

  if (!job) {
    res.status(404).json({ error: "Calculation not found" });
    return;
  }

  res.json(job);
});

router.get("/:id/result", async (req, res) => {
  const job = await prisma.calculationJob.findUnique({
    where: { id: req.params.id },
    include: { result: true, steps: { orderBy: { stepOrder: "asc" } } },
  });

  if (!job?.result) {
    res.status(404).json({ error: "Result not available" });
    return;
  }

  res.json({
    jobId: req.params.id,
    status: job.status,
    result: job.result,
    steps: job.steps,
    overallConfidence: job.overallConfidence,
  });
});

router.get("/:id/report", async (req, res) => {
  const { id } = req.params;
  const job = await prisma.calculationJob.findUnique({
    where: { id },
    include: {
      image: true,
      measurements: true,
      variables: true,
      steps: { orderBy: { stepOrder: "asc" } },
      result: true,
    },
  });

  if (!job) {
    res.status(404).json({ error: "Calculation not found" });
    return;
  }

  const format = (req.query.format as string) ?? "json";

  const report = {
    metadata: {
      jobId: job.id,
      timestamp: job.completedAt ?? job.createdAt,
      softwareVersion: job.softwareVersion,
      methodologyVersion: job.methodologyVersion,
      status: job.status,
    },
    image: { filename: job.image.filename, mimeType: job.image.mimeType },
    measurements: job.measurements,
    variables: job.variables,
    calculation: {
      workItem: job.workItem,
      method: job.method,
      steps: job.steps,
      result: job.result,
    },
    confidence: job.overallConfidence,
    validation: job.result?.validation,
  };

  if (format === "json") {
    const filename = `report-${id}.json`;
    const buffer = Buffer.from(JSON.stringify(report, null, 2));
    await saveFile("reports", filename, buffer);
    await prisma.report.create({
      data: { jobId: id, format: "json", storagePath: filename },
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
    return;
  }

  if (format === "csv") {
    const rows = [
      ["Variable", "Value", "Unit", "Confidence"],
      ...job.variables.map((v) => [v.name, v.value, v.unit, v.confidence]),
      [],
      ["Step", "Rule", "Result", "Unit"],
      ...job.steps.map((s) => [s.stepOrder + 1, s.ruleName, s.result, s.unit]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="report-${id}.csv"`);
    res.send(csv);
    return;
  }

  if (format === "pdf") {
    const sections = [
      {
        heading: "Metadata",
        lines: [
          `Job ID: ${job.id}`,
          `Status: ${job.status}`,
          `Software version: ${job.softwareVersion}`,
          `Methodology version: ${job.methodologyVersion}`,
          `Timestamp: ${(job.completedAt ?? job.createdAt).toISOString()}`,
        ],
      },
      {
        heading: "Detected Measurements",
        lines: job.measurements.map(
          (m) => `${m.rawText}: ${m.value} ${m.unit} (${(m.confidence * 100).toFixed(0)}%)`
        ),
      },
      {
        heading: "Variables",
        lines: job.variables.map(
          (v) => `${v.name}: ${v.value} ${v.unit} (${(v.confidence * 100).toFixed(0)}%)`
        ),
      },
      {
        heading: "Calculation Steps",
        lines: job.steps.map(
          (s) =>
            `${s.stepOrder + 1}. ${s.ruleName}: ${s.formula} => ${s.result} ${s.unit}`
        ),
      },
      {
        heading: "Final Result",
        lines: job.result
          ? [`${job.result.result} ${job.result.unit}`, `Formula: ${job.result.formula}`]
          : ["No result available"],
      },
    ];

    const pdfBuffer = generateTextPdf(`QuantScope Report — ${job.image.filename}`, sections);
    const filename = `report-${id}.pdf`;
    await saveFile("reports", filename, pdfBuffer);
    await prisma.report.create({
      data: { jobId: id, format: "pdf", storagePath: filename },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
    return;
  }

  res.json(report);
});

export { router as calculationsRouter };
