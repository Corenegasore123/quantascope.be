import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { AppError } from "../../common/app-error";
import { WorkflowEngine } from "../workflows/engine.service";
import { decisionSchema } from "../../shared/validation";

@ApiTags("tasks")
@Controller("tasks")
export class TasksController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkflowEngine) private readonly engine: WorkflowEngine
  ) {}

  @Get()
  async list(@CurrentUser() user: User) {
    const where = user.role === "ADMIN" ? {} : { assigneeId: user.id };
    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        request: { include: { type: true, requester: true, currentStep: true } },
        step: true,
        assignee: true,
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 200,
    });
    const open = tasks.filter((t) => t.status === "OPEN");
    return {
      tasks,
      counts: {
        approvals: open.filter((t) => t.kind === "APPROVAL").length,
        tasks: open.filter((t) => t.kind === "ACTION").length,
        overdue: open.filter((t) => t.dueAt && t.dueAt < new Date()).length,
      },
    };
  }

  @Post(":id/complete")
  async complete(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    const input = decisionSchema.parse(body ?? {});
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new AppError(404, "Task not found", "NOT_FOUND");
    if (task.assigneeId !== user.id && user.role !== "ADMIN") {
      throw new AppError(403, "Not your task", "FORBIDDEN");
    }
    await this.engine.applyAction(task.requestId, "COMPLETE", user, input.comment);
    return { ok: true };
  }
}
