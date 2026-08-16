import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import { assertProjectAccess, getProjectMembership } from "./access.js";

export const projectCollaborationRouter = Router({ mergeParams: true });

projectCollaborationRouter.use(requireAuth);

function projectId(req: { params: Record<string, string | undefined> }) {
  return String(req.params.id ?? req.params.projectId);
}

const messageSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  assigneeId: z.string().uuid(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  assigneeId: z.string().uuid().optional(),
});

async function assertAssigneeIsMember(projectId: string, assigneeId: string) {
  const membership = await getProjectMembership(assigneeId, projectId);
  if (!membership) {
    throw new AppError(400, "Assignee must be a project member", "INVALID_ASSIGNEE");
  }
}

projectCollaborationRouter.get("/messages", async (req, res, next) => {
  try {
    const pid = projectId(req);
    await assertProjectAccess(req.user!.id, pid);

    const messages = await prisma.projectMessage.findMany({
      where: { projectId: pid },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

projectCollaborationRouter.post("/messages", async (req, res, next) => {
  try {
    const pid = projectId(req);
    await assertProjectAccess(req.user!.id, pid);
    const body = messageSchema.parse(req.body);

    const message = await prisma.projectMessage.create({
      data: {
        projectId: pid,
        authorId: req.user!.id,
        body: body.body,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

projectCollaborationRouter.get("/tasks", async (req, res, next) => {
  try {
    const pid = projectId(req);
    await assertProjectAccess(req.user!.id, pid);

    const tasks = await prisma.projectTask.findMany({
      where: { projectId: pid },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

projectCollaborationRouter.post("/tasks", async (req, res, next) => {
  try {
    const pid = projectId(req);
    await assertProjectAccess(req.user!.id, pid, "EDITOR");
    const body = createTaskSchema.parse(req.body);
    await assertAssigneeIsMember(pid, body.assigneeId);

    const task = await prisma.projectTask.create({
      data: {
        projectId: pid,
        title: body.title,
        assigneeId: body.assigneeId,
        createdById: req.user!.id,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "project.task.created",
        resource: `project:${pid}`,
      },
    });

    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

projectCollaborationRouter.patch("/tasks/:taskId", async (req, res, next) => {
  try {
    const pid = projectId(req);
    const taskId = String(req.params.taskId);
    const membership = await assertProjectAccess(req.user!.id, pid);
    const body = updateTaskSchema.parse(req.body);

    const existing = await prisma.projectTask.findFirst({
      where: { id: taskId, projectId: pid },
    });
    if (!existing) {
      throw new AppError(404, "Task not found", "NOT_FOUND");
    }

    const isAssignee = existing.assigneeId === req.user!.id;
    const canManage = membership.role === "OWNER" || membership.role === "EDITOR";

    if (!canManage && !isAssignee) {
      throw new AppError(403, "Insufficient project permissions", "FORBIDDEN");
    }

    if (!canManage && (body.title !== undefined || body.assigneeId !== undefined)) {
      throw new AppError(403, "Only editors can reassign or rename tasks", "FORBIDDEN");
    }

    if (body.assigneeId) {
      await assertAssigneeIsMember(pid, body.assigneeId);
    }

    const task = await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        title: body.title,
        status: body.status,
        assigneeId: body.assigneeId,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

projectCollaborationRouter.delete("/tasks/:taskId", async (req, res, next) => {
  try {
    const pid = projectId(req);
    const taskId = String(req.params.taskId);
    await assertProjectAccess(req.user!.id, pid, "EDITOR");

    const existing = await prisma.projectTask.findFirst({
      where: { id: taskId, projectId: pid },
    });
    if (!existing) {
      throw new AppError(404, "Task not found", "NOT_FOUND");
    }

    await prisma.projectTask.delete({ where: { id: taskId } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
