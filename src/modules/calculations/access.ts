import { prisma } from "../../lib/db.js";
import { getProjectMembership } from "../projects/access.js";
import { assertProjectAccess } from "../projects/access.js";
import { AppError } from "../../shared/errors.js";

export async function assertJobAccess(userId: string, jobId: string) {
  const job = await prisma.calculationJob.findFirst({
    where: { id: jobId },
    include: { image: true },
  });
  if (!job) {
    throw new AppError(404, "Calculation not found", "NOT_FOUND");
  }

  if (job.userId === userId) {
    return job;
  }

  if (job.projectId) {
    const membership = await getProjectMembership(userId, job.projectId);
    if (membership) {
      return job;
    }
  }

  throw new AppError(404, "Calculation not found", "NOT_FOUND");
}

export async function assertJobEditAccess(userId: string, jobId: string) {
  const job = await assertJobAccess(userId, jobId);
  if (job.userId === userId) return job;
  if (job.projectId) {
    await assertProjectAccess(userId, job.projectId, "EDITOR");
    return job;
  }
  throw new AppError(403, "Insufficient permissions to edit", "FORBIDDEN");
}

export async function assertImageAccess(userId: string, imageId: string) {
  const image = await prisma.image.findFirst({
    where: { id: imageId },
  });
  if (!image) {
    throw new AppError(404, "Image not found", "NOT_FOUND");
  }

  if (image.uploadedById === userId) {
    return image;
  }

  if (image.projectId) {
    const membership = await getProjectMembership(userId, image.projectId);
    if (membership) {
      return image;
    }
  }

  throw new AppError(404, "Image not found", "NOT_FOUND");
}
