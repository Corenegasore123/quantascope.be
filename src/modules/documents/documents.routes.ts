import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { createCalculationFromUpload } from "../../lib/pipeline.js";
import { getStorage } from "../../infrastructure/storage/local.storage.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import { assertProjectAccess } from "../projects/access.js";

export const documentsRouter = Router();

documentsRouter.use(requireAuth);

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "20", 10) * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

function validateFile(file: Express.Multer.File) {
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw new AppError(400, "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF");
  }
}

/** Complete upload for a document created via upload-intent */
documentsRouter.post("/:id/upload", upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new AppError(400, "No file uploaded");

    validateFile(file);

    const docId = String(req.params.id);
    const doc = await prisma.image.findFirst({
      where: { id: docId, uploadedById: req.user!.id },
    });
    if (!doc) throw new AppError(404, "Document not found", "NOT_FOUND");
    if (doc.status !== "UPLOADING") {
      throw new AppError(400, "Document upload already completed", "ALREADY_UPLOADED");
    }

    const storage = getStorage();
    const storagePath = await storage.save("images", `${doc.id}-${doc.filename}`, file.buffer);

    await prisma.image.update({
      where: { id: doc.id },
      data: {
        storagePath,
        sizeBytes: file.buffer.length,
        status: "UPLOADED",
      },
    });

    const jobId = await createCalculationFromUpload(
      doc.filename,
      doc.mimeType,
      file.buffer,
      {
        userId: req.user!.id,
        projectId: doc.projectId ?? undefined,
        existingImageId: doc.id,
      }
    );

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "document.uploaded",
        resource: doc.projectId ? `project:${doc.projectId}` : `document:${doc.id}`,
        metadata: { documentId: doc.id, jobId },
      },
    });

    res.status(201).json({ documentId: doc.id, jobId, status: "UPLOADED" });
  } catch (error) {
    next(error);
  }
});

documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    const docId = String(req.params.id);
    const doc = await prisma.image.findFirst({ where: { id: docId } });
    if (!doc) throw new AppError(404, "Document not found", "NOT_FOUND");

    if (doc.uploadedById === req.user!.id) {
      // owner of upload can delete
    } else if (doc.projectId) {
      await assertProjectAccess(req.user!.id, doc.projectId, "EDITOR");
    } else {
      throw new AppError(404, "Document not found", "NOT_FOUND");
    }

    const storage = getStorage();
    await storage.delete(doc.storagePath);

    await prisma.image.delete({ where: { id: doc.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "document.deleted",
        resource: doc.projectId ? `project:${doc.projectId}` : `document:${doc.id}`,
        metadata: { documentId: doc.id },
      },
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
