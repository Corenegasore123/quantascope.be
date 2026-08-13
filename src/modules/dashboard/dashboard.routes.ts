import { Router } from "express";
import { prisma } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const [projects, recentJobs, recentDocuments, stats] = await Promise.all([
      prisma.project.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: { _count: { select: { calculationJobs: true, images: true } } },
      }),
      prisma.calculationJob.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          image: { select: { filename: true } },
          result: { select: { result: true, unit: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.image.findMany({
        where: { uploadedById: userId },
        orderBy: { createdAt: "desc" },
        take: 8,
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
      ]),
    ]);

    const [projectCount, calculationCount, completedCount, pendingCount, documentCount] = stats;

    res.json({
      stats: {
        projects: projectCount,
        calculations: calculationCount,
        completedAnalyses: completedCount,
        pendingAnalyses: pendingCount,
        documents: documentCount,
      },
      recentProjects: projects,
      recentCalculations: recentJobs,
      recentDocuments,
    });
  } catch (error) {
    next(error);
  }
});
