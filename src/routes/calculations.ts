import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { createCalculationFromUpload } from "../lib/pipeline.js";
import { saveFile } from "../lib/storage.js";
import { generateTextPdf } from "../lib/pdf-report.js";
import {
  buildCalculationReport,
  reportCsvContent,
  reportPdfSections,
} from "../lib/report-builder.js";
import { requireAuth } from "../middleware/auth.js";
import { assertJobAccess } from "../modules/calculations/access.js";
import {
  runDeterministicCalculation,
  correctVariable,
  correctMeasurement,
  createScenario,
} from "../modules/calculations/recalculate.service.js";
import { getDefaultProjectId } from "../modules/projects/access.js";
import { AppError } from "../shared/errors.js";

const router = Router();

router.use(requireAuth);

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "20", 10) * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

router.get("/", async (req, res, next) => {
  try {
    const jobs = await prisma.calculationJob.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        image: { select: { filename: true } },
        result: { select: { result: true, unit: true } },
      },
    });
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

router.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError(400, "No file uploaded");
    }

    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw new AppError(400, "Unsupported file type");
    }

    const projectId =
      typeof req.body?.projectId === "string" && req.body.projectId.length > 0
        ? req.body.projectId
        : await getDefaultProjectId(req.user!.id);

    const jobId = await createCalculationFromUpload(file.originalname, file.mimetype, file.buffer, {
      userId: req.user!.id,
      projectId,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "calculation.created",
        resource: `job:${jobId}`,
      },
    });

    res.status(201).json({ jobId, status: "UPLOADING" });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/stream", async (req, res, next) => {
  try {
    const job = await assertJobAccess(req.user!.id, String(req.params.id));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send({ status: job.status, at: new Date().toISOString() });

    if (job.status === "COMPLETED" || job.status === "FAILED") {
      res.end();
      return;
    }

    const { isRedisEnabled } = await import("../infrastructure/redis/connection.js");

    if (!isRedisEnabled()) {
      send({ status: job.status, fallback: "poll" });
      res.end();
      return;
    }

    const { subscribeJobStatus } = await import("../queues/job-events.js");
    let closed = false;

    const unsub = await subscribeJobStatus(job.id, (payload) => {
      if (closed) return;
      send(payload);
      if (payload.status === "COMPLETED" || payload.status === "FAILED") {
        closed = true;
        unsub()
          .then(() => res.end())
          .catch(() => res.end());
      }
    });

    req.on("close", () => {
      closed = true;
      unsub().catch(() => undefined);
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/revisions", async (req, res, next) => {
  try {
    await assertJobAccess(req.user!.id, String(req.params.id));
    const revisions = await prisma.calculationRevision.findMany({
      where: { jobId: String(req.params.id) },
      orderBy: { version: "desc" },
    });
    res.json({ revisions });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/scenarios", async (req, res, next) => {
  try {
    await assertJobAccess(req.user!.id, String(req.params.id));
    const scenarios = await prisma.calculationJob.findMany({
      where: { parentJobId: String(req.params.id), userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: { result: { select: { result: true, unit: true } } },
    });
    res.json({ scenarios });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/recalculate", async (req, res, next) => {
  try {
    await assertJobAccess(req.user!.id, String(req.params.id));
    const result = await runDeterministicCalculation(String(req.params.id), req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/scenarios", async (req, res, next) => {
  try {
    await assertJobAccess(req.user!.id, String(req.params.id));
    const body = z
      .object({
        name: z.string().min(1).max(120),
        overrides: z.record(
          z.object({ value: z.number(), unit: z.string().optional() })
        ),
      })
      .parse(req.body);

    const scenarioJobId = await createScenario(
      String(req.params.id),
      req.user!.id,
      body.name,
      body.overrides
    );
    res.status(201).json({ jobId: scenarioJobId });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/variables/:name", async (req, res, next) => {
  try {
    await assertJobAccess(req.user!.id, String(req.params.id));
    const body = z
      .object({ value: z.number(), unit: z.string().default("m") })
      .parse(req.body);

    const result = await correctVariable(
      String(req.params.id),
      String(req.params.name),
      req.user!.id,
      body.value,
      body.unit
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/measurements/:measurementId", async (req, res, next) => {
  try {
    await assertJobAccess(req.user!.id, String(req.params.id));
    const body = z
      .object({ value: z.number(), unit: z.string().default("m") })
      .parse(req.body);

    const result = await correctMeasurement(
      String(req.params.id),
      String(req.params.measurementId),
      req.user!.id,
      body.value,
      body.unit
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const job = await assertJobAccess(req.user!.id, req.params.id);
    const full = await prisma.calculationJob.findUnique({
      where: { id: job.id },
      include: {
        image: true,
        measurements: true,
        variables: { include: { measurement: true } },
        steps: { orderBy: { stepOrder: "asc" } },
        result: true,
        revisions: { orderBy: { version: "desc" }, take: 10 },
        scenarios: {
          orderBy: { createdAt: "desc" },
          include: { result: { select: { result: true, unit: true } } },
        },
        parentJob: { select: { id: true, scenarioName: true, version: true } },
      },
    });
    res.json(full);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/result", async (req, res, next) => {
  try {
    const job = await assertJobAccess(req.user!.id, req.params.id);
    const full = await prisma.calculationJob.findUnique({
      where: { id: job.id },
      include: { result: true, steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (!full?.result) {
      throw new AppError(404, "Result not available");
    }

    res.json({
      jobId: req.params.id,
      status: full.status,
      result: full.result,
      steps: full.steps,
      overallConfidence: full.overallConfidence,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/report", async (req, res, next) => {
  try {
    const job = await assertJobAccess(req.user!.id, req.params.id);
    const full = await prisma.calculationJob.findUnique({
      where: { id: job.id },
      include: {
        image: true,
        measurements: true,
        variables: true,
        steps: { orderBy: { stepOrder: "asc" } },
        result: true,
        revisions: { orderBy: { version: "desc" } },
        scenarios: {
          include: { result: { select: { result: true, unit: true } } },
        },
        parentJob: { select: { id: true, scenarioName: true, version: true } },
      },
    });

    if (!full) throw new AppError(404, "Calculation not found");

    const format = (req.query.format as string) ?? "json";
    const report = buildCalculationReport(full);

    if (format === "json") {
      const filename = `report-${full.id}.json`;
      const buffer = Buffer.from(JSON.stringify(report, null, 2));
      await saveFile("reports", filename, buffer);
      await prisma.report.create({
        data: { jobId: full.id, format: "json", storagePath: filename },
      });
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }

    if (format === "csv") {
      const csv = reportCsvContent(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="report-${full.id}.csv"`);
      res.send(csv);
      return;
    }

    if (format === "pdf") {
      const sections = reportPdfSections(report);
      const pdfBuffer = generateTextPdf(`QuantScope Report — ${full.image.filename}`, sections);
      const filename = `report-${full.id}.pdf`;
      await saveFile("reports", filename, pdfBuffer);
      await prisma.report.create({
        data: { jobId: full.id, format: "pdf", storagePath: filename },
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
      return;
    }

    res.json(report);
  } catch (error) {
    next(error);
  }
});

export { router as calculationsRouter };
