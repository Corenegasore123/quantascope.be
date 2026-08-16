import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { CurrentUser, Public } from "../../common/decorators";
import { NotificationsService } from "../notifications/notifications.service";
import { CONSENT_COOKIE, setConsentCookie } from "../../common/cookies";
import { PrismaService } from "../../prisma/prisma.service";
import { assistantAskSchema } from "../../shared/validation";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.notifications.list(user.id);
  }

  @Post("read-all")
  markAll(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(":id/read")
  mark(@CurrentUser() user: User, @Param("id") id: string) {
    return this.notifications.markRead(user.id, id);
  }
}

@ApiTags("consent")
@Controller("consent")
export class ConsentController {
  @Public()
  @Get("cookies")
  get(@Req() req: Request) {
    return { accepted: req.cookies?.[CONSENT_COOKIE] === "accepted" };
  }

  @Public()
  @Post("cookies")
  post(@Body() body: { accepted?: boolean }, @Res({ passthrough: true }) res: Response) {
    if (body?.accepted) setConsentCookie(res);
    return { ok: true, accepted: Boolean(body?.accepted) };
  }
}

@ApiTags("assistant")
@Controller("assistant")
export class AssistantController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post("ask")
  async ask(@Body() body: unknown) {
    const { question } = assistantAskSchema.parse(body);
    const completed = await this.prisma.request.findMany({
      where: { status: "COMPLETED", submittedAt: { not: null }, completedAt: { not: null } },
      include: { type: true, approvals: { include: { step: true } } },
    });
    const open = await this.prisma.request.groupBy({
      by: ["currentStepId"],
      where: { currentStepId: { not: null }, status: { in: ["UNDER_REVIEW", "PENDING_APPROVAL"] } },
      _count: true,
    });
    const steps = await this.prisma.workflowStep.findMany();
    const durations: Record<string, number[]> = {};
    for (const req of completed) {
      const total = req.completedAt!.getTime() - req.submittedAt!.getTime();
      (durations._total ??= []).push(total);
      for (const approval of req.approvals) {
        const name = approval.step?.name ?? "Unknown";
        (durations[name] ??= []).push(0);
      }
    }
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const avgTotal = avg(durations._total ?? []);
    const bottleneck = open.sort((a, b) => b._count - a._count)[0];
    const bottleneckName = steps.find((s) => s.id === bottleneck?.currentStepId)?.name ?? "None";
    const fmt = (ms: number) => `${(ms / 86400000).toFixed(1)} days`;

    const lines = [
      `Average processing time: ${fmt(avgTotal) || "n/a"} (${completed.length} completed requests).`,
      `Current top bottleneck: ${bottleneckName} (${bottleneck?._count ?? 0} open items).`,
      ...steps
        .slice(0, 6)
        .map((s) => `${s.name}: ${open.find((o) => o.currentStepId === s.id)?._count ?? 0} waiting`),
    ];

    return {
      question,
      answer: lines.join("\n"),
      provider: process.env.OLLAMA_URL || process.env.OPENAI_API_KEY ? "configured" : "rules",
    };
  }
}
