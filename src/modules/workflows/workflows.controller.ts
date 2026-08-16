import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser, Roles } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { createWorkflowSchema, upsertStepSchema, upsertTransitionSchema } from "../../shared/validation";
import { AppError } from "../../common/app-error";
import { AuditService } from "../audit/audit.service";

@ApiTags("workflows")
@Controller("workflows")
export class WorkflowsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Get()
  list() {
    return this.prisma.workflow.findMany({
      include: {
        steps: { include: { department: true }, orderBy: { sortOrder: "asc" } },
        transitions: true,
        requestTypes: true,
      },
      orderBy: { name: "asc" },
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: { include: { department: true }, orderBy: { sortOrder: "asc" } },
        transitions: true,
        requestTypes: true,
      },
    });
    if (!workflow) throw new AppError(404, "Workflow not found", "NOT_FOUND");
    return workflow;
  }

  @Roles("ADMIN")
  @Post()
  async create(@CurrentUser() user: User, @Body() body: unknown) {
    const input = createWorkflowSchema.parse(body);
    const workflow = await this.prisma.workflow.create({ data: input });
    await this.audit.record(user.id, "workflow.created", `workflow:${workflow.id}`);
    return workflow;
  }

  @Roles("ADMIN")
  @Post(":id/steps")
  async addStep(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    const input = upsertStepSchema.parse(body);
    const step = await this.prisma.workflowStep.create({
      data: { ...input, workflowId: id },
    });
    await this.audit.record(user.id, "workflow.step_added", `workflow:${id}`);
    return step;
  }

  @Roles("ADMIN")
  @Post(":id/transitions")
  async addTransition(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    const input = upsertTransitionSchema.parse(body);
    const transition = await this.prisma.workflowTransition.create({
      data: { ...input, workflowId: id },
    });
    await this.audit.record(user.id, "workflow.transition_added", `workflow:${id}`);
    return transition;
  }
}
