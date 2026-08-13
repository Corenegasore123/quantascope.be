import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { createCalculationFromUpload } from "../../lib/pipeline.js";
import { getStorage } from "../../infrastructure/storage/local.storage.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import { assertProjectAccess } from "../projects/access.js";

export const projectDocumentsRouter = Router({ mergeParams: true });

function pid(req: Request): string {
  return String(req.params.projectId);
}

projectDocumentsRouter.use(requireAuth);

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "20", 10) * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

const intentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(MAX_SIZE),
});

function validateMime(mimeType: string) {
  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new AppError(400, "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF");
  }
}

projectDocumentsRouter.get("/", async (req, res, next) => {
  try {
    const projectId = pid(req);
    await assertProjectAccess(req.user!.id, projectId);

    const documents = await prisma.image.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        calculations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, overallConfidence: true },
        },
      },
    });

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

/** Reserve a document slot and return upload intent (SaaS-ready pattern) */
projectDocumentsRouter.post("/intent", async (req, res, next) => {
  try {
    const projectId = pid(req);
    await assertProjectAccess(req.user!.id, projectId);

    const body = intentSchema.parse(req.body);
    validateMime(body.mimeType);

    const doc = await prisma.image.create({
      data: {
        filename: body.filename,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        storagePath: "",
        status: "UPLOADING",
        uploadedById: req.user!.id,
        projectId,
      },
    });

    const storage = getStorage();
    const intent = await storage.createUploadIntent("images", body.filename, {
      documentId: doc.id,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });

    res.status(201).json({ document: doc, upload: intent });
  } catch (error) {
    next(error);
  }
});

/** Direct multipart upload + start analysis */
projectDocumentsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const projectId = pid(req);
    await assertProjectAccess(req.user!.id, projectId);

    const file = req.file;
    if (!file) throw new AppError(400, "No file uploaded");
    validateMime(file.mimetype);

    const jobId = await createCalculationFromUpload(file.originalname, file.mimetype, file.buffer, {
      userId: req.user!.id,
      projectId,
    });

    const job = await prisma.calculationJob.findUnique({
      where: { id: jobId },
      include: { image: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "document.uploaded",
        resource: `project:${projectId}`,
        metadata: { documentId: job?.imageId, jobId },
      },
    });

    res.status(201).json({
      jobId,
      document: job?.image,
      status: job?.status ?? "UPLOADING",
    });
  } catch (error) {
    next(error);
  }
});

projectDocumentsRouter.get("/:documentId", async (req, res, next) => {
  try {
    const projectId = pid(req);
    await assertProjectAccess(req.user!.id, projectId);

    const doc = await prisma.image.findFirst({
      where: { id: String(req.params.documentId), projectId },
      include: {
        calculations: {
          orderBy: { createdAt: "desc" },
          include: { result: { select: { result: true, unit: true } } },
        },
      },
    });
    if (!doc) throw new AppError(404, "Document not found", "NOT_FOUND");
    res.json({ document: doc });
  } catch (error) {
    next(error);
  }
});
