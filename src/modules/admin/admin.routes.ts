import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { getAdminStats, getSystemHealth } from "../../lib/system-health.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const [stats, health] = await Promise.all([getAdminStats(), getSystemHealth()]);
    res.json({ stats, health });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/health", async (_req, res, next) => {
  try {
    const health = await getSystemHealth();
    res.status(health.status === "ready" ? 200 : 503).json(health);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          emailVerifiedAt: true,
          _count: {
            select: { projects: true, calculationJobs: true, sessions: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, limit });
  } catch (error) {
    next(error);
  }
});

const updateUserSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  name: z.string().min(1).max(120).optional(),
});

adminRouter.patch("/users/:id", async (req, res, next) => {
  try {
    const body = updateUserSchema.parse(req.body);
    const targetId = req.params.id;

    if (targetId === req.user!.id && body.role && body.role !== "ADMIN") {
      throw new AppError(400, "Cannot demote your own admin account", "INVALID_OPERATION");
    }

    const existing = await prisma.user.findUnique({ where: { id: targetId } });
    if (!existing) throw new AppError(404, "User not found", "NOT_FOUND");

    const user = await prisma.user.update({
      where: { id: targetId },
      data: body,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        emailVerifiedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: "admin.user_updated",
        resource: `user:${targetId}`,
        metadata: body,
      },
    });

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/audit", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;

    const where = {
      ...(action ? { action: { contains: action } } : {}),
      ...(userId ? { userId } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page, limit });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/audit/actions", async (_req, res, next) => {
  try {
    const actions = await prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    });
    res.json({ actions: actions.map((a) => a.action) });
  } catch (error) {
    next(error);
  }
});
