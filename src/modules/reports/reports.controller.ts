import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUser, Roles } from "../../common/decorators";
import type { User } from "@prisma/client";

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("overview")
  async overview(@CurrentUser() user: User) {
    const visibility =
      user.role === "STUDENT"
        ? { requesterId: user.id }
        : user.role === "STAFF"
          ? {
              OR: [
                { assignedOfficerId: user.id },
                { departmentId: user.departmentId ?? "__none__" },
                { requesterId: user.id },
              ],
            }
          : {};

    const [total, pending, overdue, completed, byStatus, byType, byStep] = await Promise.all([
      this.prisma.request.count({ where: visibility }),
      this.prisma.request.count({
        where: { ...visibility, status: { in: ["SUBMITTED", "UNDER_REVIEW", "PENDING_APPROVAL"] } },
      }),
      this.prisma.request.count({
        where: {
          ...visibility,
          slaBreachedAt: { not: null },
          status: { in: ["SUBMITTED", "UNDER_REVIEW", "PENDING_APPROVAL", "APPROVED"] },
        },
      }),
      this.prisma.request.count({ where: { ...visibility, status: "COMPLETED" } }),
      this.prisma.request.groupBy({ by: ["status"], where: visibility, _count: true }),
      this.prisma.request.groupBy({ by: ["typeId"], where: visibility, _count: true }),
      this.prisma.request.groupBy({
        by: ["currentStepId"],
        where: { ...visibility, currentStepId: { not: null } },
        _count: true,
      }),
    ]);

    const types = await this.prisma.requestType.findMany();
    const steps = await this.prisma.workflowStep.findMany();
    const completedRows = await this.prisma.request.findMany({
      where: { ...visibility, status: "COMPLETED", submittedAt: { not: null }, completedAt: { not: null } },
      select: { submittedAt: true, completedAt: true },
    });
    const avgMs =
      completedRows.length === 0
        ? 0
        : completedRows.reduce(
            (sum, r) => sum + (r.completedAt!.getTime() - r.submittedAt!.getTime()),
            0
          ) / completedRows.length;

    const slaTotal = await this.prisma.request.count({
      where: { ...visibility, submittedAt: { not: null } },
    });
    const slaBreached = await this.prisma.request.count({
      where: { ...visibility, slaBreachedAt: { not: null } },
    });

    const bottleneck = byStep
      .filter((s) => s.currentStepId)
      .sort((a, b) => b._count - a._count)[0];

    const volume = await this.prisma.request.findMany({
      where: { ...visibility, createdAt: { gte: new Date(Date.now() - 14 * 86400000) } },
      select: { createdAt: true },
    });
    const days = Array.from({ length: 14 }, (_, i) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (13 - i));
      const key = day.toISOString().slice(0, 10);
      return {
        date: key,
        count: volume.filter((v) => v.createdAt.toISOString().slice(0, 10) === key).length,
      };
    });

    return {
      totals: { total, pending, overdue, completed },
      avgProcessingMs: avgMs,
      slaCompliance: slaTotal === 0 ? 100 : Number((((slaTotal - slaBreached) / slaTotal) * 100).toFixed(1)),
      topBottleneck: bottleneck?.currentStepId
        ? steps.find((s) => s.id === bottleneck.currentStepId)?.name ?? "Unknown"
        : "None",
      byStatus,
      byType: byType.map((row) => ({
        typeId: row.typeId,
        name: types.find((t) => t.id === row.typeId)?.name ?? "Unknown",
        count: row._count,
      })),
      volume: days,
    };
  }
}

@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async search(@CurrentUser() user: User, @Query("q") q = "") {
    const query = q.trim();
    if (query.length < 1) return { requests: [], users: [], assets: [] };
    const requestWhere =
      user.role === "ADMIN"
        ? {}
        : user.role === "STAFF"
          ? { OR: [{ requesterId: user.id }, { assignedOfficerId: user.id }, { departmentId: user.departmentId }] }
          : { requesterId: user.id };

    const [requests, users, assets] = await Promise.all([
      this.prisma.request.findMany({
        where: {
          AND: [
            requestWhere,
            {
              OR: [
                { number: { contains: query, mode: "insensitive" } },
                { type: { name: { contains: query, mode: "insensitive" } } },
              ],
            },
          ],
        },
        include: { type: true, requester: true },
        take: 10,
      }),
      user.role === "STUDENT"
        ? []
        : this.prisma.user.findMany({
            where: {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { studentId: { contains: query, mode: "insensitive" } },
              ],
            },
            take: 10,
            select: { id: true, name: true, email: true, role: true },
          }),
      user.role === "STUDENT"
        ? []
        : this.prisma.asset.findMany({
            where: {
              OR: [
                { tag: { contains: query, mode: "insensitive" } },
                { name: { contains: query, mode: "insensitive" } },
              ],
            },
            take: 10,
          }),
    ]);
    return { requests, users, assets };
  }
}

@ApiTags("audit")
@Controller("audit-logs")
export class AuditController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Roles("ADMIN")
  @Get()
  list(@Query("take") take?: string) {
    return this.prisma.auditLog.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(take ?? 100), 500),
    });
  }
}
