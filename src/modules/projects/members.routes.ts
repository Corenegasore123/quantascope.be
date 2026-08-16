import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";
import { createNotification } from "../notifications/notification.service.js";
import { assertProjectAccess } from "./access.js";

export const projectMembersRouter = Router({ mergeParams: true });

projectMembersRouter.use(requireAuth);

function projectId(req: { params: Record<string, string | undefined> }) {
  return String(req.params.id ?? req.params.projectId);
}

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["EDITOR", "VIEWER"]).default("VIEWER"),
});

const updateRoleSchema = z.object({
  role: z.enum(["EDITOR", "VIEWER"]),
});

projectMembersRouter.get("/", async (req, res, next) => {
  try {
    const pid = projectId(req);
    const membership = await assertProjectAccess(req.user!.id, pid);

    const [owner, members] = await Promise.all([
      prisma.user.findUnique({
        where: { id: membership.project.ownerId },
        select: { id: true, name: true, email: true },
      }),
      prisma.projectMember.findMany({
        where: { projectId: pid },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    res.json({
      owner: owner ? { ...owner, role: "OWNER" as const } : null,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        name: m.user.name,
        email: m.user.email,
        createdAt: m.createdAt,
      })),
      currentRole: membership.role,
    });
  } catch (error) {
    next(error);
  }
});

projectMembersRouter.post("/", async (req, res, next) => {
  try {
    const pid = projectId(req);
    await assertProjectAccess(req.user!.id, pid, "OWNER");
    const body = addMemberSchema.parse(req.body);

    const invitee = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!invitee) {
      throw new AppError(404, "No user found with that email", "USER_NOT_FOUND");
    }

    const project = await prisma.project.findUniqueOrThrow({ where: { id: pid } });
    if (invitee.id === project.ownerId) {
      throw new AppError(400, "Project owner is already a member", "ALREADY_MEMBER");
    }

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: pid, userId: invitee.id } },
    });
    if (existing) {
      throw new AppError(409, "User is already a project member", "ALREADY_MEMBER");
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: pid,
        userId: invitee.id,
        role: body.role,
        invitedById: req.user!.id,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "project.member_added",
        resource: `project:${pid}/member:${invitee.id}`,
        metadata: { role: body.role, email: invitee.email },
      },
    });

    await createNotification({
      userId: invitee.id,
      type: "PROJECT_INVITE",
      title: `Added to ${project.name}`,
      body: `${req.user!.name} added you as ${body.role.toLowerCase()}`,
      link: `/projects/${pid}`,
      metadata: { projectId: pid, role: body.role },
    });

    res.status(201).json({
      member: {
        id: member.id,
        userId: member.userId,
        role: member.role,
        name: member.user.name,
        email: member.user.email,
        createdAt: member.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

projectMembersRouter.patch("/:userId", async (req, res, next) => {
  try {
    const pid = projectId(req);
    await assertProjectAccess(req.user!.id, pid, "OWNER");
    const body = updateRoleSchema.parse(req.body);

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: pid, userId: req.params.userId } },
    });
    if (!member) throw new AppError(404, "Member not found", "NOT_FOUND");

    const updated = await prisma.projectMember.update({
      where: { id: member.id },
      data: { role: body.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "project.member_updated",
        resource: `project:${pid}/member:${updated.userId}`,
        metadata: { role: body.role },
      },
    });

    res.json({
      member: {
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        name: updated.user.name,
        email: updated.user.email,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

projectMembersRouter.delete("/:userId", async (req, res, next) => {
  try {
    const pid = projectId(req);
    const membership = await assertProjectAccess(req.user!.id, pid, "OWNER");
    const targetUserId = req.params.userId;

    if (targetUserId === membership.project.ownerId) {
      throw new AppError(400, "Cannot remove project owner", "INVALID_OPERATION");
    }

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: pid, userId: targetUserId } },
    });
    if (!member) throw new AppError(404, "Member not found", "NOT_FOUND");

    await prisma.projectMember.delete({ where: { id: member.id } });

    const project = await prisma.project.findUniqueOrThrow({ where: { id: pid } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "project.member_removed",
        resource: `project:${pid}/member:${targetUserId}`,
      },
    });

    await createNotification({
      userId: targetUserId,
      type: "MEMBER_REMOVED",
      title: `Removed from ${project.name}`,
      body: "You no longer have access to this project",
      link: "/projects",
      metadata: { projectId: pid },
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
