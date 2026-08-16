import { Router } from "express";
import { prisma } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { accessibleProjectsWhere, accessibleJobsWhere } from "../projects/access.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const jobsWhere = await accessibleJobsWhere(userId);

    const [projects, recentJobs, recentDocuments, stats, needsReviewCount, needsReviewJobs, correctedCount] =
      await Promise.all([
        prisma.project.findMany({
          where: accessibleProjectsWhere(userId),
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: {
            owner: { select: { name: true } },
            _count: { select: { calculationJobs: true, images: true } },
          },
        }),
        prisma.calculationJob.findMany({
          where: { ...jobsWhere, parentJobId: null },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            image: { select: { filename: true } },
            result: { select: { result: true, unit: true, validation: true } },
            project: { select: { id: true, name: true } },
          },
        }),
        prisma.image.findMany({
          where: {
            OR: [{ uploadedById: userId }, { project: accessibleProjectsWhere(userId) }],
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { project: { select: { id: true, name: true } } },
        }),
        prisma.$transaction([
          prisma.project.count({ where: accessibleProjectsWhere(userId) }),
          prisma.calculationJob.count({ where: jobsWhere }),
          prisma.calculationJob.count({ where: { ...jobsWhere, status: "COMPLETED" } }),
          prisma.calculationJob.count({
            where: { ...jobsWhere, status: { notIn: ["COMPLETED", "FAILED"] } },
          }),
          prisma.image.count({
            where: {
              OR: [{ uploadedById: userId }, { project: accessibleProjectsWhere(userId) }],
            },
          }),
          prisma.calculationJob.count({ where: { ...jobsWhere, version: { gt: 1 } } }),
        ]),
        prisma.calculationJob.count({
          where: {
            ...jobsWhere,
            status: "COMPLETED",
            result: { validation: { path: ["status"], equals: "needs_review" } },
          },
        }),
        prisma.calculationJob.findMany({
          where: {
            ...jobsWhere,
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
          where: { userCorrected: true, job: jobsWhere },
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
