import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser, Roles } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { createDepartmentSchema, createRequestTypeSchema } from "../../shared/validation";
import { AuditService } from "../audit/audit.service";

@ApiTags("departments")
@Controller("departments")
export class DepartmentsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Get()
  list() {
    return this.prisma.department.findMany({
      include: { head: true, _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });
  }

  @Roles("ADMIN")
  @Post()
  async create(@CurrentUser() user: User, @Body() body: unknown) {
    const input = createDepartmentSchema.parse(body);
    const department = await this.prisma.department.create({ data: input });
    await this.audit.record(user.id, "department.created", `department:${department.id}`);
    return department;
  }
}

@ApiTags("request-types")
@Controller("request-types")
export class RequestTypesController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Get()
  list() {
    return this.prisma.requestType.findMany({
      where: { isActive: true },
      include: { workflow: { include: { steps: { orderBy: { sortOrder: "asc" } } } } },
      orderBy: { name: "asc" },
    });
  }

  @Roles("ADMIN")
  @Post()
  async create(@CurrentUser() user: User, @Body() body: unknown) {
    const input = createRequestTypeSchema.parse(body);
    const type = await this.prisma.requestType.create({
      data: {
        ...input,
        formSchema: (input.formSchema ?? undefined) as object | undefined,
      },
    });
    await this.audit.record(user.id, "request_type.created", `requestType:${type.id}`);
    return type;
  }
}
