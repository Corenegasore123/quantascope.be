import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import { assertProjectAccess } from "./access.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

projectsRouter.get("/", async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.user!.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { calculationJobs: true, images: true } },
      },
    });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        ownerId: req.user!.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "project.created",
        resource: `project:${project.id}`,
      },
    });

    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, ownerId: req.user!.id },
      include: {
        _count: { select: { calculationJobs: true, images: true } },
      },
    });
    if (!project) throw new AppError(404, "Project not found", "NOT_FOUND");
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch("/:id", async (req, res, next) => {
  try {
    await assertProjectAccess(req.user!.id, req.params.id);
    const body = updateSchema.parse(req.body);

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: body,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "project.updated",
        resource: `project:${project.id}`,
        metadata: body,
      },
    });

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id/calculations", async (req, res, next) => {
  try {
    await assertProjectAccess(req.user!.id, req.params.id);

    const calculations = await prisma.calculationJob.findMany({
      where: { projectId: req.params.id, userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        image: { select: { id: true, filename: true, status: true } },
        result: { select: { result: true, unit: true } },
      },
    });

    res.json({ calculations });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id/activity", async (req, res, next) => {
  try {
    const projectId = req.params.id;
    await assertProjectAccess(req.user!.id, projectId);

    const activity = await prisma.auditLog.findMany({
      where: {
        resource: { startsWith: `project:${projectId}` },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { id: true, name: true } } },
    });

    res.json({ activity });
  } catch (error) {
    next(error);
  }
});

export { assertProjectAccess, getDefaultProjectId } from "./access.js";
