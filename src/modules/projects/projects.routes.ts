import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import {
  assertProjectAccess,
  accessibleJobsWhere,
  accessibleProjectsWhere,
  getProjectMembership,
} from "./access.js";
import {
  buildCalculationReport,
  jobReportInclude,
  parseReportTemplate,
  reportBatchCsvContent,
} from "../../lib/report-builder.js";
import { generateTextPdf } from "../../lib/pdf-report.js";

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
    const userId = req.user!.id;
    const projects = await prisma.project.findMany({
      where: accessibleProjectsWhere(userId),
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { calculationJobs: true, images: true, members: true } },
      },
    });

    const withRole = await Promise.all(
      projects.map(async (p) => {
        const membership = await getProjectMembership(userId, p.id);
        return {
          ...p,
          role: membership?.role ?? "VIEWER",
          isOwner: p.ownerId === userId,
        };
      })
    );

    res.json({ projects: withRole });
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

    res.status(201).json({ project: { ...project, role: "OWNER", isOwner: true } });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const membership = await assertProjectAccess(req.user!.id, req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { calculationJobs: true, images: true, members: true } },
      },
    });
    if (!project) throw new AppError(404, "Project not found", "NOT_FOUND");
    res.json({
      project: {
        ...project,
        role: membership.role,
        isOwner: membership.role === "OWNER",
      },
    });
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch("/:id", async (req, res, next) => {
  try {
    await assertProjectAccess(req.user!.id, req.params.id, "OWNER");
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

    res.json({ project: { ...project, role: "OWNER", isOwner: true } });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:id/calculations", async (req, res, next) => {
  try {
    await assertProjectAccess(req.user!.id, req.params.id);

    const calculations = await prisma.calculationJob.findMany({
      where: { projectId: req.params.id, parentJobId: null },
      orderBy: { createdAt: "desc" },
      include: {
        image: { select: { id: true, filename: true, status: true } },
        result: { select: { result: true, unit: true } },
        user: { select: { id: true, name: true } },
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

    const jobIds = await prisma.calculationJob.findMany({
      where: { projectId },
      select: { id: true },
    });
    const jobResources = jobIds.map((j) => `job:${j.id}`);

    const activity = await prisma.auditLog.findMany({
      where: {
        OR: [
          { resource: { startsWith: `project:${projectId}` } },
          ...(jobResources.length ? [{ resource: { in: jobResources } }] : []),
        ],
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

projectsRouter.get("/:id/report", async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const membership = await assertProjectAccess(req.user!.id, projectId);
    const format = (req.query.format as string) ?? "csv";
    const template = parseReportTemplate(req.query.template as string | undefined);

    const jobs = await prisma.calculationJob.findMany({
      where: { projectId, parentJobId: null, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      include: jobReportInclude,
    });

    if (jobs.length === 0) {
      throw new AppError(404, "No completed calculations to export", "NOT_FOUND");
    }

    const reports = jobs.map(buildCalculationReport);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="project-${projectId}-report.json"`
      );
      res.send(JSON.stringify({ project: membership.project.name, reports }, null, 2));
      return;
    }

    if (format === "pdf") {
      const sections = reports.flatMap((r, i) => [
        {
          heading: `${i + 1}. ${r.image.filename}`,
          lines: [
            `Result: ${r.calculation.result?.result ?? "—"} ${r.calculation.result?.unit ?? ""}`,
            `Version: ${r.metadata.version}`,
            `Confidence: ${r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : "—"}`,
          ],
        },
      ]);
      const pdf = generateTextPdf(`Project Report — ${membership.project.name}`, sections);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="project-${projectId}-report.pdf"`
      );
      res.send(pdf);
      return;
    }

    const csv = reportBatchCsvContent(reports, template);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="project-${projectId}-report.csv"`
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export { assertProjectAccess, getDefaultProjectId } from "./access.js";
