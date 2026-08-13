import { prisma } from "../../lib/db.js";
import { AppError } from "../../shared/errors.js";

export async function assertJobAccess(userId: string, jobId: string) {
  const job = await prisma.calculationJob.findFirst({
    where: { id: jobId, userId },
    include: { image: true },
  });
  if (!job) {
    throw new AppError(404, "Calculation not found", "NOT_FOUND");
  }
  return job;
}

export async function assertImageAccess(userId: string, imageId: string) {
  const image = await prisma.image.findFirst({
    where: { id: imageId, uploadedById: userId },
  });
  if (!image) {
    throw new AppError(404, "Image not found", "NOT_FOUND");
  }
  return image;
}
