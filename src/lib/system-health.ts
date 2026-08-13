import { prisma } from "./db.js";
import { checkRedisConnection, isRedisEnabled } from "../infrastructure/redis/connection.js";
import { checkCVServiceHealth } from "../modules/vision/vision.service.js";

export async function getSystemHealth() {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const redisEnabled = isRedisEnabled();
  const redis = redisEnabled ? await checkRedisConnection() : null;
  const cv = await checkCVServiceHealth();

  const ready = database === "ok" && (redis === null || redis === true) && cv;

  return {
    status: ready ? ("ready" as const) : ("degraded" as const),
    database,
    redis: redisEnabled ? (redis ? ("ok" as const) : ("error" as const)) : ("disabled" as const),
    queue: redisEnabled ? (redis ? ("ok" as const) : ("unavailable" as const)) : ("inline" as const),
    cvService: cv ? ("ok" as const) : ("error" as const),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    env: process.env.NODE_ENV ?? "development",
  };
}

export async function getAdminStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    users,
    admins,
    projects,
    calculations,
    completedCalculations,
    pendingCalculations,
    failedCalculations,
    documents,
    auditLogs,
    recentUsers,
    activeSessions,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.project.count(),
    prisma.calculationJob.count(),
    prisma.calculationJob.count({ where: { status: "COMPLETED" } }),
    prisma.calculationJob.count({
      where: { status: { notIn: ["COMPLETED", "FAILED"] } },
    }),
    prisma.calculationJob.count({ where: { status: "FAILED" } }),
    prisma.image.count(),
    prisma.auditLog.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);

  return {
    users,
    admins,
    projects,
    calculations,
    completedCalculations,
    pendingCalculations,
    failedCalculations,
    documents,
    auditLogs,
    recentUsers,
    activeSessions,
  };
}
