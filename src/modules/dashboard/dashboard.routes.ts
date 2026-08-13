import { Router } from "express";
import { prisma } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const [projects, recentJobs, recentDocuments, stats, needsReviewCount, needsReviewJobs, correctedCount] =
      await Promise.all([
        prisma.project.findMany({
          where: { ownerId: userId },
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: { _count: { select: { calculationJobs: true, images: true } } },
        }),
        prisma.calculationJob.findMany({
          where: { userId, parentJobId: null },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            image: { select: { filename: true } },
            result: { select: { result: true, unit: true, validation: true } },
            project: { select: { id: true, name: true } },
          },
        }),
        prisma.image.findMany({
          where: { uploadedById: userId },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { project: { select: { id: true, name: true } } },
        }),
        prisma.$transaction([
          prisma.project.count({ where: { ownerId: userId } }),
          prisma.calculationJob.count({ where: { userId } }),
          prisma.calculationJob.count({ where: { userId, status: "COMPLETED" } }),
          prisma.calculationJob.count({
            where: { userId, status: { notIn: ["COMPLETED", "FAILED"] } },
          }),
          prisma.image.count({ where: { uploadedById: userId } }),
          prisma.calculationJob.count({ where: { userId, version: { gt: 1 } } }),
        ]),
        prisma.calculationJob.count({
          where: {
            userId,
            status: "COMPLETED",
            result: { validation: { path: ["status"], equals: "needs_review" } },
          },
        }),
        prisma.calculationJob.findMany({
          where: {
            userId,
            status: "COMPLETED",
            result: { validation: { path: ["status"], equals: "needs_review" } },
          },
          take: 5,
          include: {
            image: { select: { filename: true } },
            result: { select: { result: true, unit: true } },
          },
        }),
        prisma.detectedMeasurement.count({
          where: { userCorrected: true, job: { userId } },
        }),
      ]);

    const [
      projectCount,
      calculationCount,
      completedCount,
      pendingCount,
      documentCount,
      revisedCount,
    ] = stats;

    res.json({
      stats: {
        projects: projectCount,
        calculations: calculationCount,
        completedAnalyses: completedCount,
        pendingAnalyses: pendingCount,
        documents: documentCount,
        revisedCalculations: revisedCount,
        correctedMeasurements: correctedCount,
        needsReview: needsReviewCount,
      },
      recentProjects: projects,
      recentCalculations: recentJobs,
      recentDocuments,
      needsReview: needsReviewJobs,
    });
  } catch (error) {
    next(error);
  }
});
