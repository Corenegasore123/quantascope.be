import { Router } from "express";
import { readStoredFile } from "../lib/storage.js";
import { requireAuth } from "../middleware/auth.js";
import { assertJobAccess } from "../modules/calculations/access.js";

const router = Router();

router.use(requireAuth);

// `:id` is the calculation job id (used by the frontend detail view)
router.get("/:id", async (req, res, next) => {
  try {
    const job = await assertJobAccess(req.user!.id, req.params.id);
    const buffer = await readStoredFile(job.image.storagePath);
    res.setHeader("Content-Type", job.image.mimeType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export { router as imagesRouter };
