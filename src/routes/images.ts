import { Router } from "express";
import { prisma } from "../lib/db.js";
import { readStoredFile } from "../lib/storage.js";

const router = Router();

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  const job = await prisma.calculationJob.findUnique({
    where: { id },
    include: { image: true },
  });

  const image = job?.image ?? (await prisma.image.findUnique({ where: { id } }));

  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  const buffer = await readStoredFile(image.storagePath);
  res.setHeader("Content-Type", image.mimeType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(buffer);
});

export { router as imagesRouter };
